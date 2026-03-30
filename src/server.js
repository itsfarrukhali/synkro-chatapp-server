import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import ApiResponseUtil from "./utils/apiResponse.js";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/auth.route.js";
import { cleanupExpiredTokens } from "./utils/tokenBlacklist.js";

dotenv.config();
const app = express();

if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  ApiResponseUtil.success(
    res,
    {
      status: "live",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    "🚀 Synkro Server is Live!"
  );
});

app.use("/api/auth", userRouter);

app.get("/api/health", (_req, res) => {
  ApiResponseUtil.success(
    res,
    {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    "Server is healthy"
  );
});

const port = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();

  // Cleanup expired blacklisted tokens on startup, then every hour
  await cleanupExpiredTokens();
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

  app.listen(port, () => {
    console.log("\n🚀 ========================================");
    console.log(`✅ Server running on port ${port}`);
    console.log(`🌐 http://localhost:${port}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("========================================\n");
  });
};

startServer();

process.on("SIGTERM", () => {
  console.log("👋 Shutting down...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  process.exit(0);
});
