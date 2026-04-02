import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import ApiResponseUtil from "./utils/apiResponse.js";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/auth.route.js";
import conversationRouter from "./routes/conversations.route.js";
import { cleanupExpiredTokens } from "./utils/tokenBlacklist.js";
import { initSocketHandlers } from "./socket/sockets.handler.js";

dotenv.config();

const app = express();
const httpServer = createServer(app); // wrap express in http server for socket.io

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Make io accessible in controllers/routes via req.app.get("io")
app.set("io", io);

if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  ApiResponseUtil.success(
    res,
    { status: "live", timestamp: new Date().toISOString(), version: "1.0.0" },
    "🚀 Synkro Server is Live!",
  );
});

app.use("/api/auth", userRouter);
app.use("/api/conversations", conversationRouter);

app.get("/api/health", (_req, res) => {
  ApiResponseUtil.success(
    res,
    {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    "Server is healthy",
  );
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
initSocketHandlers(io);

// ─── Start ────────────────────────────────────────────────────────────────────
const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    // Cleanup expired blacklisted tokens on startup, then every hour
    cleanupExpiredTokens();
    setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

    httpServer.listen(port, () => {
      console.log("\n🚀 ========================================");
      console.log(`✅ Server running on port ${port}`);
      console.log(`🌐 http://localhost:${port}`);
      console.log(`🔌 Socket.io enabled`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log("========================================\n");
    });
  } catch (error) {
    console.error(
      "❌ Failed to connect to MongoDB. Server not started.",
      error,
    );
    process.exit(1);
  }
}
startServer();

process.on("SIGTERM", () => {
  console.log("👋 Shutting down...");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  process.exit(0);
});
