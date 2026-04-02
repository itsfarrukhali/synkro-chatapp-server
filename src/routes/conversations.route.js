import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getOrCreateDM,
  createGroup,
  getMyConversations,
  getConversationById,
  updateGroup,
  addParticipants,
  leaveGroup,
  toggleMute,
} from "../controllers/conversations.controller.js";
import {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  toggleReaction,
  markAsSeen,
  searchMessages,
} from "../controllers/messages.controller.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// ─── Conversations ───────────────────────────────────────────────────────────
router.get("/", getMyConversations);
router.post("/dm", getOrCreateDM);
router.post("/group", createGroup);
router.get("/:conversationId", getConversationById);
router.put("/:conversationId/group", updateGroup);
router.post("/:conversationId/participants", addParticipants);
router.delete("/:conversationId/leave", leaveGroup);
router.post("/:conversationId/mute", toggleMute);

// ─── Messages ────────────────────────────────────────────────────────────────
router.get("/search/messages", searchMessages);
router.get("/:conversationId/messages", getMessages);
router.post("/:conversationId/messages", sendMessage);
router.put("/messages/:messageId", editMessage);
router.delete("/messages/:messageId", deleteMessage);
router.post("/messages/:messageId/reactions", toggleReaction);
router.post("/:conversationId/seen", markAsSeen);

export default router;
