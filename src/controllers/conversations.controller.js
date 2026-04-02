import Conversation from "../models/conversations.model.js";
import User from "../models/user.model.js";
import ApiResponseUtil from "../utils/apiResponse.js";

// ─── Create or get DM conversation ───────────────────────────────────────────
export const getOrCreateDM = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId)
      return ApiResponseUtil.badRequest(res, "targetUserId is required");

    if (targetUserId === currentUserId.toString())
      return ApiResponseUtil.badRequest(res, "Cannot start a DM with yourself");

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return ApiResponseUtil.notFound(res, "User not found");

    // Check if DM already exists between these two users
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, targetUserId], $size: 2 },
    }).populate(
      "participants",
      "fullName userName profilePicture status lastSeen",
    );

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, targetUserId],
        isGroup: false,
      });
      await conversation.populate(
        "participants",
        "fullName userName profilePicture status lastSeen",
      );
    }

    return ApiResponseUtil.success(res, conversation, "Conversation ready");
  } catch (error) {
    console.error("getOrCreateDM error:", error);
    return ApiResponseUtil.serverError(res, "Failed to get conversation");
  }
};

// ─── Create group conversation ────────────────────────────────────────────────
export const createGroup = async (req, res) => {
  try {
    const { groupName, participantIds } = req.body;
    const currentUserId = req.user._id;

    if (!groupName?.trim())
      return ApiResponseUtil.badRequest(res, "Group name is required");

    if (!participantIds || participantIds.length < 2)
      return ApiResponseUtil.badRequest(
        res,
        "A group needs at least 2 other participants",
      );

    const allParticipants = [
      ...new Set([currentUserId.toString(), ...participantIds]),
    ];

    const conversation = await Conversation.create({
      isGroup: true,
      groupName: groupName.trim(),
      participants: allParticipants,
      admins: [currentUserId],
    });

    await conversation.populate(
      "participants",
      "fullName userName profilePicture status",
    );

    return ApiResponseUtil.created(res, conversation, "Group created");
  } catch (error) {
    console.error("createGroup error:", error);
    return ApiResponseUtil.serverError(res, "Failed to create group");
  }
};

// ─── Get all conversations for current user ───────────────────────────────────
export const getMyConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate(
        "participants",
        "fullName userName profilePicture status lastSeen",
      )
      .populate("lastMessage.sender", "fullName userName")
      .sort({ updatedAt: -1 })
      .lean();

    // Attach unread count as a plain number for each conversation
    const result = conversations.map((conv) => ({
      ...conv,
      unreadCount:
        conv.unreadCounts instanceof Map
          ? conv.unreadCounts.get(userId.toString()) || 0
          : conv.unreadCounts?.[userId.toString()] || 0,
    }));

    return ApiResponseUtil.success(res, result, "Conversations fetched");
  } catch (error) {
    console.error("getMyConversations error:", error);
    return ApiResponseUtil.serverError(res, "Failed to fetch conversations");
  }
};

// ─── Get single conversation ──────────────────────────────────────────────────
export const getConversationById = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    }).populate(
      "participants",
      "fullName userName profilePicture status lastSeen",
    );

    if (!conversation)
      return ApiResponseUtil.notFound(res, "Conversation not found");

    return ApiResponseUtil.success(res, conversation);
  } catch (error) {
    console.error("getConversationById error:", error);
    return ApiResponseUtil.serverError(res, "Failed to fetch conversation");
  }
};

// ─── Update group (name / avatar) ────────────────────────────────────────────
export const updateGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { groupName, groupAvatar } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: userId,
    });

    if (!conversation) return ApiResponseUtil.notFound(res, "Group not found");

    const isAdmin = conversation.admins.some(
      (a) => a.toString() === userId.toString(),
    );
    if (!isAdmin)
      return ApiResponseUtil.forbidden(res, "Only admins can update the group");

    if (groupName) conversation.groupName = groupName.trim();
    if (groupAvatar) conversation.groupAvatar = groupAvatar;

    await conversation.save();
    await conversation.populate(
      "participants",
      "fullName userName profilePicture status",
    );

    return ApiResponseUtil.success(res, conversation, "Group updated");
  } catch (error) {
    console.error("updateGroup error:", error);
    return ApiResponseUtil.serverError(res, "Failed to update group");
  }
};

// ─── Add participants to group ────────────────────────────────────────────────
export const addParticipants = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userIds } = req.body;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      admins: userId,
    });

    if (!conversation)
      return ApiResponseUtil.notFound(res, "Group not found or not an admin");

    const newIds = userIds.filter(
      (id) => !conversation.participants.map((p) => p.toString()).includes(id),
    );
    conversation.participants.push(...newIds);
    await conversation.save();
    await conversation.populate(
      "participants",
      "fullName userName profilePicture status",
    );

    return ApiResponseUtil.success(res, conversation, "Participants added");
  } catch (error) {
    console.error("addParticipants error:", error);
    return ApiResponseUtil.serverError(res, "Failed to add participants");
  }
};

// ─── Leave group ──────────────────────────────────────────────────────────────
export const leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      isGroup: true,
      participants: userId,
    });

    if (!conversation) return ApiResponseUtil.notFound(res, "Group not found");

    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== userId.toString(),
    );

    // If leaving admin was the only admin and group still has members, promote first member
    if (
      conversation.participants.length > 0 &&
      !conversation.admins.some((a) =>
        conversation.participants
          .map((p) => p.toString())
          .includes(a.toString()),
      )
    ) {
      conversation.admins = [conversation.participants[0]];
    }

    // Delete group if empty
    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(conversationId);
      return ApiResponseUtil.success(res, null, "Left and deleted empty group");
    }

    await conversation.save();
    return ApiResponseUtil.success(res, null, "Left group successfully");
  } catch (error) {
    console.error("leaveGroup error:", error);
    return ApiResponseUtil.serverError(res, "Failed to leave group");
  }
};

// ─── Mute / unmute conversation ───────────────────────────────────────────────
export const toggleMute = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation)
      return ApiResponseUtil.notFound(res, "Conversation not found");

    const isMuted = conversation.mutedBy.some(
      (u) => u.toString() === userId.toString(),
    );
    if (isMuted) {
      conversation.mutedBy = conversation.mutedBy.filter(
        (u) => u.toString() !== userId.toString(),
      );
    } else {
      conversation.mutedBy.push(userId);
    }

    await conversation.save();
    return ApiResponseUtil.success(
      res,
      { muted: !isMuted },
      isMuted ? "Conversation unmuted" : "Conversation muted",
    );
  } catch (error) {
    console.error("toggleMute error:", error);
    return ApiResponseUtil.serverError(res, "Failed to toggle mute");
  }
};
