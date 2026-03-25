import express from "express";
import {
  signUp,
  verifyEmail,
  resendVerificationEmail,
  login,
  checkUsername,
} from "../controllers/auth.controller.js";
import { rateLimit } from "express-rate-limit";

// Rate limiting for signup
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: "Too many accounts created from this IP. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post("/signup", signupLimiter, signUp);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/login", login);
router.get("/check-username/:username", checkUsername);

export default router;
