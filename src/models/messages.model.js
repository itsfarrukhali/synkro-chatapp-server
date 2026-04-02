import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false },
);

const deliverySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deliveredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const seenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    seenAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "voice"],
      default: "text",
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaMeta: {
      filename: String,
      size: Number, // bytes
      mimeType: String,
      duration: Number, // seconds (for voice)
      width: Number, // for images
      height: Number,
    },
    // Reply threading
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    // Snapshot of parent at send time — so it's preserved even if parent is deleted
    replyPreview: {
      content: { type: String },
      type: { type: String },
      senderName: { type: String },
      mediaUrl: { type: String },
    },
    // Emoji reactions: [{emoji: "👍", users: [userId, userId]}]
    reactions: [reactionSchema],
    // Delivery receipts
    deliveredTo: [deliverySchema],
    seenBy: [seenSchema],
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Edit tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Text index for full-text search
messageSchema.index({ content: "text" });
// Compound index for paginated conversation queries
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Virtual: compute delivery status for a specific user
messageSchema.methods.getStatusFor = function (userId) {
  const uid = userId.toString();
  if (this.seenBy.some((s) => s.userId.toString() === uid)) return "seen";
  if (this.deliveredTo.some((d) => d.userId.toString() === uid))
    return "delivered";
  return "sent";
};

const Message = mongoose.model("Message", messageSchema);
export default Message;
