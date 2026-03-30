// middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { isTokenBlacklisted } from "../utils/tokenBlacklist.js";
import ApiResponseUtil from "../utils/apiResponse.js";

export const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.synkroKey || req.headers.authorization?.split(" ")[1];

    if (!token) return ApiResponseUtil.unauthorized(res, "No token provided");

    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted)
      return ApiResponseUtil.unauthorized(res, "Token has been invalidated");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return ApiResponseUtil.unauthorized(res, "User not found");

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError")
      return ApiResponseUtil.unauthorized(res, "Token expired");
    if (error.name === "JsonWebTokenError")
      return ApiResponseUtil.unauthorized(res, "Invalid token");
    return ApiResponseUtil.serverError(res, "Auth check failed");
  }
};

// Public routes()
export const attachUser = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.synkroKey || req.headers.authorization?.split(" ")[1];

    if (token) {
      const blacklisted = await isTokenBlacklisted(token);
      if (!blacklisted) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select("-password");
        if (user) req.user = user;
      }
    }
  } catch {
    // Silently fail
  }
  next();
};
