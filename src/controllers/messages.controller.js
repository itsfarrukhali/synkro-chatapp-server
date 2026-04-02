import Message from "../models/messages.model.js";
import Conversation from "../models/conversations.model.js";
import ApiResponseUtil from "../utils/apiResponse.js";

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

// ─── Send message (REST fallback — primary path is socket) ────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = "text", replyTo, mediaUrl, mediaMeta } = req.body;

    if (!req.user?._id)
      return ApiResponseUtil.unauthorized(res, "Authentication required");

    const senderId = req.user._id;

    if (!conversationId)
      return ApiResponseUtil.badRequest(res, "conversationId is required");

    if (type === "text" && !content?.trim())
      return ApiResponseUtil.badRequest(res, "Message content cannot be empty");

    // Ensure sender is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId,
    });
    if (!conversation)
      return ApiResponseUtil.forbidden(
        res,
        "Not a participant in this conversation",
      );

    // Build reply preview snapshot if replying
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
          content: parentMsg.isDeleted ? "Message deleted" : parentMsg.content,
          type: parentMsg.type,
          senderName: parentMsg.sender.fullName,
          mediaUrl: parentMsg.mediaUrl,
        };
      }
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      content: content?.trim() || "",
      type,
      mediaUrl,
      mediaMeta,
      replyTo,
      replyPreview,
    });

    // Populate sender for response
    await message.populate("sender", "fullName userName profilePicture");

    // Update conversation: lastMessage + unreadCounts
    const lastMessageSnapshot = buildLastMessageSnapshot({
      type,
      content: message.content,
      senderId,
      senderName: req.user.fullName,
      createdAt: message.createdAt,
    });
    setConversationLastMessage(conversation, lastMessageSnapshot);
    conversation.incrementUnread(senderId);
    conversation.updatedAt = new Date();
    await conversation.save();

    const io = req.app.get("io");
    if (io) {
      io.to(conversationId).emit(
        "message:new",
        message.toObject ? message.toObject() : message,
      );
    }

    return ApiResponseUtil.created(res, message, "Message sent");
  } catch (error) {
    console.error("sendMessage error:", error);
    return ApiResponseUtil.serverError(res, "Failed to send message");
  }
};

// ─── Get messages (cursor-based pagination) ───────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { cursor, limit = 30 } = req.query;
    const userId = req.user._id;

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) return ApiResponseUtil.forbidden(res, "Access denied");

    const query = { conversationId };
    if (cursor) {
      // cursor = createdAt of last loaded message; load older messages
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .populate("sender", "fullName userName profilePicture")
      .populate("replyTo", "content type sender isDeleted")
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1) // fetch one extra to know if there's more
      .lean();

    const hasMore = messages.length > Number(limit);
    if (hasMore) messages.pop();

    // Return in chronological order for the client
    messages.reverse();

    const nextCursor =
      messages.length > 0 ? messages[0].createdAt.toISOString() : null;

    return ApiResponseUtil.success(res, {
      messages,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return ApiResponseUtil.serverError(res, "Failed to fetch messages");
  }
};

// ─── Edit message ─────────────────────────────────────────────────────────────
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content?.trim())
      return ApiResponseUtil.badRequest(res, "Content cannot be empty");

    const message = await Message.findOne({
      _id: messageId,
      sender: userId,
      isDeleted: false,
      type: "text", // only text messages can be edited
    });

    if (!message)
      return ApiResponseUtil.notFound(
        res,
        "Message not found or cannot be edited",
      );

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();
    await message.populate("sender", "fullName userName profilePicture");

    return ApiResponseUtil.success(res, message, "Message edited");
  } catch (error) {
    console.error("editMessage error:", error);
    return ApiResponseUtil.serverError(res, "Failed to edit message");
  }
};

// ─── Delete message (soft delete) ────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      sender: userId,
    });

    if (!message) return ApiResponseUtil.notFound(res, "Message not found");

    message.isDeleted = true;
    message.content = "";
    message.mediaUrl = null;
    await message.save();

    return ApiResponseUtil.success(res, { messageId }, "Message deleted");
  } catch (error) {
    console.error("deleteMessage error:", error);
    return ApiResponseUtil.serverError(res, "Failed to delete message");
  }
};

// ─── Toggle reaction ──────────────────────────────────────────────────────────
export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) return ApiResponseUtil.badRequest(res, "Emoji is required");

    const message = await Message.findOne({
      _id: messageId,
      isDeleted: false,
    });

    if (!message) return ApiResponseUtil.notFound(res, "Message not found");

    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId,
    }).select("_id");

    if (!conversation) {
      return ApiResponseUtil.forbidden(
        res,
        "Not authorized to react to this message",
      );
    }

    const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

    if (reactionIndex === -1) {
      // New emoji — create reaction entry
      message.reactions.push({ emoji, users: [userId] });
    } else {
      const reaction = message.reactions[reactionIndex];
      const userIndex = reaction.users.findIndex(
        (u) => u.toString() === userId.toString(),
      );

      if (userIndex === -1) {
        // Add user to existing emoji
        reaction.users.push(userId);
      } else {
        // Remove user's reaction
        reaction.users.splice(userIndex, 1);
        // Remove emoji entirely if no users left
        if (reaction.users.length === 0) {
          message.reactions.splice(reactionIndex, 1);
        }
      }
    }

    await message.save();

    return ApiResponseUtil.success(
      res,
      { messageId, reactions: message.reactions },
      "Reaction updated",
    );
  } catch (error) {
    console.error("toggleReaction error:", error);
    return ApiResponseUtil.serverError(res, "Failed to update reaction");
  }
};

// ─── Mark messages as seen ────────────────────────────────────────────────────
export const markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Verify participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) return ApiResponseUtil.forbidden(res, "Access denied");

    const now = new Date();

    // Mark all unseen messages from others as seen
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        "seenBy.userId": { $ne: userId },
        isDeleted: false,
      },
      {
        $push: { seenBy: { userId, seenAt: now } },
      },
    );

    // Reset unread count
    conversation.resetUnread(userId);
    await conversation.save();

    return ApiResponseUtil.success(res, null, "Marked as seen");
  } catch (error) {
    console.error("markAsSeen error:", error);
    return ApiResponseUtil.serverError(res, "Failed to mark as seen");
  }
};

// ─── Search messages ──────────────────────────────────────────────────────────
export const searchMessages = async (req, res) => {
  try {
    const { q, conversationId } = req.query;
    const userId = req.user._id;

    if (!q?.trim())
      return ApiResponseUtil.badRequest(res, "Search query is required");

    const query = {
      $text: { $search: q.trim() },
      isDeleted: false,
    };

    // If scoped to a conversation, verify access first
    if (conversationId) {
      const conv = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });
      if (!conv) return ApiResponseUtil.forbidden(res, "Access denied");
      query.conversationId = conversationId;
    } else {
      // Search across all user's conversations
      const userConvs = await Conversation.find({
        participants: userId,
      }).select("_id");
      query.conversationId = { $in: userConvs.map((c) => c._id) };
    }

    const messages = await Message.find(query, {
      score: { $meta: "textScore" },
    })
      .populate("sender", "fullName userName profilePicture")
      .populate("conversationId", "isGroup groupName participants")
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .lean();

    return ApiResponseUtil.success(res, messages, "Search results");
  } catch (error) {
    console.error("searchMessages error:", error);
    return ApiResponseUtil.serverError(res, "Search failed");
  }
};
