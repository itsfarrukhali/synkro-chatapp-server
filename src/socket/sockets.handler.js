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
          io.to(conversationId).emit(
            "message:new",
            message.toObject ? message.toObject() : message,
          );

          // Broadcast updated conversation (for sidebar list refresh)
          io.to(conversationId).emit("conversation:updated", {
            conversationId,
            lastMessage: conversation.lastMessage?.toObject
              ? conversation.lastMessage.toObject()
              : conversation.lastMessage,
            unreadCounts: Object.fromEntries(conversation.unreadCounts),
          });
        } catch (error) {
          console.error("message:send error:", error);
          socket.emit("error", { message: "Failed to send message" });
        }
      },
    );

    // ─── Edit message ─────────────────────────────────────────────────────
    socket.on("message:edit", async ({ messageId, content }) => {
      try {
        if (!content?.trim()) return;

        const message = await Message.findOne({
          _id: messageId,
          sender: userId,
          isDeleted: false,
          type: "text",
        });

        if (!message) {
          socket.emit("error", { message: "Cannot edit this message" });
          return;
        }

        message.content = content.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();
        await message.populate("sender", "fullName userName profilePicture");

        io.to(message.conversationId.toString()).emit(
          "message:updated",
          message,
        );
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
        });

        if (!message) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        message.isDeleted = true;
        message.content = "";
        message.mediaUrl = null;
        await message.save();

        io.to(message.conversationId.toString()).emit("message:updated", {
          _id: message._id,
          conversationId: message.conversationId,
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

        // Notify each unique sender that their messages were seen
        const senderIds = [
          ...new Set(unseenMessages.map((m) => m.sender.toString())),
        ];
        for (const senderId of senderIds) {
          const senderPresence = onlineUsers.get(senderId);
          if (senderPresence) {
            io.to(senderPresence.socketId).emit("message:seen", {
              conversationId,
              userId,
              seenAt: now,
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
        const reactionIndex = message.reactions.findIndex(
          (r) => r.emoji === emoji,
        );

        if (reactionIndex === -1) {
          message.reactions.push({ emoji, users: [userId] });
        } else {
          const reaction = message.reactions[reactionIndex];
          const userIdx = reaction.users.findIndex(
            (u) => u.toString() === userId.toString(),
          );
          if (userIdx === -1) {
            reaction.users.push(userId);
          } else {
            reaction.users.splice(userIdx, 1);
            if (reaction.users.length === 0)
              message.reactions.splice(reactionIndex, 1);
          }
        }

        await message.save();

        io.to(message.conversationId.toString()).emit("reaction:updated", {
          messageId,
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
