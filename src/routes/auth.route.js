import express from "express";
import { rateLimit } from "express-rate-limit";
import { protect } from "../middleware/auth.middleware.js";
import {
  signUp,
  verifyEmail,
  resendVerificationEmail,
  login,
  checkUsername,
  searchUsers,
  logout,
  forgotPassword,
  resetPassword,
  updateProfile,
  getUserById,
  refreshToken,
  deleteAccount,
  getCurrentUser,
} from "../controllers/auth.controller.js";

// Rate Limiters

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many signup attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Public Routes

router.post("/signup", signupLimiter, signUp);
router.post("/login", loginLimiter, login);
router.get("/verify-email/:token", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/check-username/:username", checkUsername);
router.get("/users/:userId", getUserById);

// refresh-token
router.post("/refresh-token", refreshToken);

//  Protected Routes─

router.use(protect);

router.post("/logout", logout);
router.get("/search/users", searchUsers);
router.get("/me", getCurrentUser);
router.put("/profile", updateProfile);
router.delete("/account", deleteAccount);

export default router;
