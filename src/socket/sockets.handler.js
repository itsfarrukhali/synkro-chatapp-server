import Message from "../models/messages.model.js";
import Conversation from "../models/conversations.model.js";

const buildLastMessageSnapshot = ({
  type,
  content,
  senderId,
  senderName,
  createdAt,
}) => ({
  content: type === "text" ? content : `[${type}]`,
  type,
  sender: senderId,
  senderName,
  createdAt,
});

const setConversationLastMessage = (conversation, snapshot) => {
  const lastMessagePath = conversation?.schema?.path("lastMessage");
  if (lastMessagePath?.instance === "String") {
    conversation.lastMessage = snapshot.content;
    return;
  }

  conversation.lastMessage = snapshot;
};

// In-memory presence map: userId → { socketId, status, conversationId }
// For production scale: replace with Redis
const onlineUsers = new Map();

export const initSocketHandlers = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication required"));

      const { default: jwt } = await import("jsonwebtoken");
      const { isTokenBlacklisted } = await import("../utils/tokenBlacklist.js");
      const { default: User } = await import("../models/user.model.js");

      const blacklisted = await isTokenBlacklisted(token);
      if (blacklisted) return next(new Error("Token invalidated"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 Socket connected: ${socket.user.userName} (${socket.id})`);

    // ─── Online presence ──────────────────────────────────────────────────
    onlineUsers.set(userId, {
      socketId: socket.id,
      status: "online",
      activeConversation: null,
    });

    // Update DB status
    socket.user.constructor
      .findByIdAndUpdate(userId, { status: "online", socketId: socket.id })
      .exec();

    // Broadcast online status to all connected clients
    socket.broadcast.emit("user:online", {
      userId,
      status: "online",
    });

    // Send current online users list to the newly connected user
    const onlineList = Array.from(onlineUsers.keys());
    socket.emit("users:online", onlineList);

    // ─── Join conversation rooms ──────────────────────────────────────────
    socket.on("join:conversation", async ({ conversationId }) => {
      try {
        // Verify user is a participant in this conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) {
          socket.emit("error", {
            message: "Not a participant in this conversation",
          });
          return;
        }

        socket.join(conversationId);
        const presence = onlineUsers.get(userId);
        if (presence) {
          presence.activeConversation = conversationId;
          onlineUsers.set(userId, presence);
        }

        const pendingMessages = await Message.find({
          conversationId,
          sender: { $ne: userId },
          "seenBy.userId": { $ne: userId },
          isDeleted: false,
        })
          .populate("sender", "fullName userName profilePicture")
          .lean();

        if (pendingMessages.length > 0) {
          socket.emit("messages:pending", pendingMessages);
        }
      } catch (error) {
        console.error("join:conversation error:", error);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    // ─── Leave conversation room ──────────────────────────────────────────
    socket.on("leave:conversation", ({ conversationId }) => {
      socket.leave(conversationId);
      const presence = onlineUsers.get(userId);
      if (presence && presence.activeConversation === conversationId) {
        presence.activeConversation = null;
        onlineUsers.set(userId, presence);
      }
    });

    // ─── Send message ─────────────────────────────────────────────────────
    socket.on(
      "message:send",
      async ({
        conversationId,
        content,
        type = "text",
        replyTo,
        mediaUrl,
        mediaMeta,
      }) => {
        try {
          if (!conversationId) return;
          if (type === "text" && !content?.trim()) return;

          // Verify participant
          const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
          });
          if (!conversation) {
            socket.emit("error", { message: "Not a participant" });
            return;
          }

          // Build reply preview
          let replyPreview = null;
          if (replyTo) {
            const parentMsg = await Message.findOne({
              _id: replyTo,
              conversationId,
            })
              .populate("sender", "fullName")
              .lean();
            if (parentMsg) {
              replyPreview = {
                content: parentMsg.isDeleted
                  ? "Message deleted"
                  : parentMsg.content,
                type: parentMsg.type,
                senderName: parentMsg.sender.fullName,
                mediaUrl: parentMsg.mediaUrl,
              };
            }
          }

          const message = await Message.create({
            conversationId,
            sender: userId,
            content: content?.trim() || "",
            type,
            mediaUrl,
            mediaMeta,
            replyTo,
            replyPreview,
          });

          await message.populate("sender", "fullName userName profilePicture");

          // Update conversation
          const lastMessageSnapshot = buildLastMessageSnapshot({
            type,
            content: message.content,
            senderId: userId,
            senderName: socket.user.fullName,
            createdAt: message.createdAt,
          });
          setConversationLastMessage(conversation, lastMessageSnapshot);
          conversation.incrementUnread(userId);
          await conversation.save();

          // Broadcast new message to all room members (convert to plain JSON)
          const messagePayload = message.toObject
            ? message.toObject()
            : message;
          io.to(conversationId).emit("message:new", messagePayload);

          // Broadcast updated conversation (for sidebar list refresh)
          const conversationUpdatePayload = {
            conversationId,
            lastMessage: conversation.lastMessage?.toObject
              ? conversation.lastMessage.toObject()
              : conversation.lastMessage,
            unreadCounts: Object.fromEntries(conversation.unreadCounts),
          };

          io.to(conversationId).emit(
            "conversation:updated",
            conversationUpdatePayload,
          );

          // Ensure participants not joined to the room still receive updates.
          for (const participantId of conversation.participants) {
            const pid = participantId.toString();
            const presence = onlineUsers.get(pid);
            if (!presence) continue;

            // Skip direct emits for users already active in this conversation room.
            if (presence.activeConversation === conversationId) continue;

            io.to(presence.socketId).emit("message:new", messagePayload);
            io.to(presence.socketId).emit(
              "conversation:updated",
              conversationUpdatePayload,
            );
          }
        } catch (error) {
          console.error("message:send error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      },
    );

    // ─── Edit message ─────────────────────────────────────────────────────
    socket.on("message:delivered", async ({ conversationId, messageId }) => {
      try {
        if (!conversationId || !messageId) return;

        const message = await Message.findOne({
          _id: messageId,
          conversationId,
          sender: { $ne: userId },
          isDeleted: false,
        });
        if (!message) return;

        const alreadyDelivered = message.deliveredTo.some(
          (d) => d.userId.toString() === userId,
        );
        if (!alreadyDelivered) {
          message.deliveredTo.push({ userId, deliveredAt: new Date() });
          await message.save();
        }

        // Notify sender that recipient device has received the message.
        const senderPresence = onlineUsers.get(message.sender.toString());
        if (senderPresence) {
          io.to(senderPresence.socketId).emit("message:delivered", {
            conversationId,
            messageId,
            userId,
          });
        }
      } catch (error) {
        console.error("message:delivered error:", error);
      }
    });

    socket.on("message:edit", async ({ messageId, content }) => {
      try {
        if (!content?.trim()) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }

        const message = await Message.findOne({
          _id: messageId,
          sender: userId,
          isDeleted: false,
          type: "text",
        }).populate("conversationId");

        if (!message) {
          socket.emit("error", { message: "Cannot edit this message" });
          return;
        }

        // Verify user is still a conversation participant
        const isParticipant = message.conversationId.participants.some(
          (p) => p.toString() === userId,
        );
        if (!isParticipant) {
          socket.emit("error", {
            message: "Cannot edit: not a conversation participant",
          });
          return;
        }

        // Enforce edit time limit (30 minutes)
        const editTimeLimit = 30 * 60 * 1000;
        if (
          Date.now() - new Date(message.createdAt).getTime() >
          editTimeLimit
        ) {
          socket.emit("error", {
            message: "Cannot edit messages older than 30 minutes",
          });
          return;
        }

        message.content = content.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(message.conversationId._id.toString()).emit("message:updated", {
          messageId: message._id,
          conversationId: message.conversationId._id,
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
        });
      } catch (error) {
        console.error("message:edit error:", error);
        socket.emit("error", { message: "Failed to edit message" });
      }
    });

    // ─── Delete message ───────────────────────────────────────────────────
    socket.on("message:delete", async ({ messageId }) => {
      try {
        const message = await Message.findOne({
          _id: messageId,
          sender: userId,
        }).populate("conversationId");

        if (!message) {
          socket.emit("error", { message: "Cannot delete this message" });
          return;
        }

        // Verify user is still a conversation participant
        const isParticipant = message.conversationId.participants.some(
          (p) => p.toString() === userId,
        );
        if (!isParticipant) {
          socket.emit("error", {
            message: "Cannot delete: not a conversation participant",
          });
          return;
        }

        // Mark message as deleted (soft delete)
        message.isDeleted = true;
        message.content = "";
        message.mediaUrl = null;
        await message.save();

        io.to(message.conversationId._id.toString()).emit("message:updated", {
          messageId: message._id,
          conversationId: message.conversationId._id,
          isDeleted: true,
          content: "",
        });
      } catch (error) {
        console.error("message:delete error:", error);
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // ─── Mark as seen ─────────────────────────────────────────────────────
    socket.on("message:seen", async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
        });
        if (!conversation) return;

        const now = new Date();

        // Find messages not yet seen by this user
        const unseenMessages = await Message.find({
          conversationId,
          sender: { $ne: userId },
          "seenBy.userId": { $ne: userId },
          isDeleted: false,
        }).select("_id sender");

        if (unseenMessages.length === 0) return;

        await Message.updateMany(
          {
            _id: { $in: unseenMessages.map((m) => m._id) },
          },
          { $push: { seenBy: { userId, seenAt: now } } },
        );

        // Reset unread count
        conversation.resetUnread(userId);
        await conversation.save();

        // Notify senders that their messages were seen - emit individual message updates
        for (const msg of unseenMessages) {
          const senderId = msg.sender.toString();
          const senderPresence = onlineUsers.get(senderId);
          if (senderPresence) {
            io.to(senderPresence.socketId).emit("message:updated", {
              messageId: msg._id,
              conversationId,
              seenBy: [{ userId, seenAt: now }],
            });
          }
        }
      } catch (error) {
        console.error("message:seen error:", error);
      }
    });

    // ─── Reactions ────────────────────────────────────────────────────────
    socket.on("reaction:toggle", async ({ messageId, emoji }) => {
      try {
        if (!emoji) return;

        const message = await Message.findOne({
          _id: messageId,
          isDeleted: false,
        });
        if (!message) return;
        // Verify user is a participant in the message's conversation
        const conversation = await Conversation.findOne({
          _id: message.conversationId,
          participants: userId,
        }).select("_id");
        if (!conversation) return;

        // One reaction per user per message:
        // - If user clicks same emoji again => unreact
        // - If user clicks a different emoji => replace old with new
        const uid = userId.toString();
        const currentReactionIndex = message.reactions.findIndex((r) =>
          r.users.some((u) => u.toString() === uid),
        );

        if (currentReactionIndex !== -1) {
          const currentReaction = message.reactions[currentReactionIndex];
          if (currentReaction.emoji === emoji) {
            currentReaction.users = currentReaction.users.filter(
              (u) => u.toString() !== uid,
            );
            if (currentReaction.users.length === 0) {
              message.reactions.splice(currentReactionIndex, 1);
            }
          } else {
            currentReaction.users = currentReaction.users.filter(
              (u) => u.toString() !== uid,
            );
            if (currentReaction.users.length === 0) {
              message.reactions.splice(currentReactionIndex, 1);
            }

            const targetIndex = message.reactions.findIndex(
              (r) => r.emoji === emoji,
            );
            if (targetIndex === -1) {
              message.reactions.push({ emoji, users: [userId] });
            } else {
              message.reactions[targetIndex].users.push(userId);
            }
          }
        } else {
          const targetIndex = message.reactions.findIndex(
            (r) => r.emoji === emoji,
          );
          if (targetIndex === -1) {
            message.reactions.push({ emoji, users: [userId] });
          } else {
            message.reactions[targetIndex].users.push(userId);
          }
        }

        // Explicitly mark reactions as modified for Mongoose to save array changes
        message.markModified("reactions");
        await message.save();

        io.to(message.conversationId.toString()).emit("reaction:updated", {
          messageId,
          conversationId: message.conversationId.toString(),
          reactions: message.reactions,
        });
      } catch (error) {
        console.error("reaction:toggle error:", error);
      }
    });

    // ─── Typing indicators ────────────────────────────────────────────────
    const typingTimeouts = new Map(); // conversationId → timeout

    socket.on("typing:start", ({ conversationId }) => {
      // Broadcast to everyone in room EXCEPT the typer
      socket.to(conversationId).emit("typing:status", {
        userId,
        userName: socket.user.fullName,
        isTyping: true,
        conversationId,
      });

      // Auto-stop after 3 seconds of silence
      const existing = typingTimeouts.get(conversationId);
      if (existing) clearTimeout(existing);

      const timeout = setTimeout(() => {
        socket.to(conversationId).emit("typing:status", {
          userId,
          userName: socket.user.fullName,
          isTyping: false,
          conversationId,
        });
        typingTimeouts.delete(conversationId);
      }, 3000);

      typingTimeouts.set(conversationId, timeout);
    });

    socket.on("typing:stop", ({ conversationId }) => {
      const existing = typingTimeouts.get(conversationId);
      if (existing) {
        clearTimeout(existing);
        typingTimeouts.delete(conversationId);
      }

      socket.to(conversationId).emit("typing:status", {
        userId,
        userName: socket.user.fullName,
        isTyping: false,
        conversationId,
      });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.user.userName}`);

      // Clear all typing timeouts
      for (const [, timeout] of typingTimeouts) clearTimeout(timeout);
      typingTimeouts.clear();

      onlineUsers.delete(userId);

      const now = new Date();
      await socket.user.constructor.findByIdAndUpdate(userId, {
        status: "offline",
        socketId: null,
        lastSeen: now,
      });

      socket.broadcast.emit("user:online", {
        userId,
        status: "offline",
        lastSeen: now,
      });
    });
  });

  console.log("✅ Socket.io handlers initialized");
};

// Utility: get online users list (for REST endpoints)
export const getOnlineUsers = () => Array.from(onlineUsers.keys());
