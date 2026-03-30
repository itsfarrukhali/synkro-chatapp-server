import mongoose from "mongoose";

//  Schema
const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const TokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

// Functions

// Add token to blacklist on logout
export const addToTokenBlacklist = async (token) => {
  try {
    const { default: jwt } = await import("jsonwebtoken");
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return;

    const expiresAt = new Date(decoded.exp * 1000);

    await TokenBlacklist.create({ token, expiresAt });
  } catch (error) {
    // Duplicate key = token already blacklisted, ignore silently
    if (error.code !== 11000) {
      console.error("Error blacklisting token:", error);
    }
  }
};

// Check if token is blacklisted (used in protect middleware)
export const isTokenBlacklisted = async (token) => {
  try {
    const found = await TokenBlacklist.exists({ token });
    return !!found;
  } catch (error) {
    console.error("Error checking token blacklist:", error);
    return false; // fail open
  }
};

// Manual cleanup (optional — TTL index already handles this automatically)
export const cleanupExpiredTokens = async () => {
  try {
    const result = await TokenBlacklist.deleteMany({
      expiresAt: { $lte: new Date() },
    });
    if (result.deletedCount > 0) {
      console.log(
        `🧹 Cleaned up ${result.deletedCount} expired blacklisted tokens`
      );
    }
  } catch (error) {
    console.error("Error cleaning up token blacklist:", error);
  }
};
