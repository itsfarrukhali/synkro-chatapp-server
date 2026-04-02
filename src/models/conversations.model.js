import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    // Group fields (only relevant when isGroup: true)
    groupName: {
      type: String,
      trim: true,
      default: null,
    },
    groupAvatar: {
      type: String,
      default: null,
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Denormalized last message for conversation list — avoids extra join
    lastMessage: {
      content: String,
      type: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      senderName: String,
      createdAt: Date,
    },
    // Per-user unread counts: { "userId": count }
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // Users who muted this conversation
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index for fetching user's conversations efficiently
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Prevent duplicate DMs — unique pair index
conversationSchema.index(
  { participants: 1, isGroup: 1 },
  {
    unique: false, // allow groups with same members but not duplicate DMs (handled in controller)
  },
);

// Virtual: get unread count for a specific user
conversationSchema.methods.getUnreadFor = function (userId) {
  return this.unreadCounts.get(userId.toString()) || 0;
};

// Increment unread for all participants except the sender
conversationSchema.methods.incrementUnread = function (senderId) {
  this.participants.forEach((participantId) => {
    const pid = participantId.toString();
    if (pid !== senderId.toString()) {
      const current = this.unreadCounts.get(pid) || 0;
      this.unreadCounts.set(pid, current + 1);
    }
  });
};

// Reset unread for a specific user
conversationSchema.methods.resetUnread = function (userId) {
  this.unreadCounts.set(userId.toString(), 0);
};

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
