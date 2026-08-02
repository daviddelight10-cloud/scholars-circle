import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import subjectRoutes from "./routes/subjects.js";
import questionRoutes from "./routes/questions.js";
import sessionRoutes from "./routes/sessions.js";
import assignmentRoutes from "./routes/assignments.js";
import challengeRoutes from "./routes/challenges.js";
import analyticsRoutes from "./routes/analytics.js";
import userRoutes from "./routes/users.js";
import aiRoutes from "./routes/ai.js";
import userDataRoutes from "./routes/userData.js";
import keyRoutes from "./routes/keys.js";
import classroomRoutes from "./routes/classroom.js";
import lecturerRoutes from "./routes/lecturers.js";
import teacherInviteRoutes from "./routes/teacherInvites.js";
import liveSessionRoutes from "./routes/liveSessions.js";
import classroomAssignmentRoutes from "./routes/classroomAssignments.js";
import pollRoutes from "./routes/polls.js";
import pushRoutes from "./routes/push.js";
import gamificationRoutes from "./routes/gamification.js";
import wallRoutes from "./routes/wall.js";
import youtubeRoutes from "./routes/youtube.js";
import announcementRoutes from "./routes/announcements.js";
import aiProxyRoutes from "./routes/aiProxy.js";
import resourcesRoutes from "./routes/resources.js";
import foldersRoutes from "./routes/folders.js";
import departmentsRoutes from "./routes/departments.js";
import universitiesRoutes from "./routes/universities.js";
import profileRoutes from "./routes/profile.js";
import topicsRoutes from "./routes/topics.js";
import masteryRoutes from "./routes/mastery.js";
import paymentRoutes from "./routes/payment.js";
import voiceSessionRoutes, { getActiveSession, deleteActiveSession, getActiveSessions, consumeTicket, rebuildGeminiSession } from "./routes/voiceSession.js";
import curriculumRoutes from "./routes/curriculum.js";
import { buildPageContextMessage } from "./lib/voiceGrounding.js";
import { configurePush } from "./lib/pushSender.js";
import { startStudyReminderJob } from "./lib/studyReminderJob.js";
import { seedBadges } from "./lib/badges.js";
import { prisma } from "./db.js";
import { WebSocketServer, WebSocket } from "ws";
import { verifySupabaseToken } from "./lib/verifySupabaseToken.js";

// Initialize Firebase Admin for FCM push notifications. Safe to call even if credentials are missing.
configurePush();
// Start daily motivation + reminder cron (no-op if no subscribers yet).
startStudyReminderJob();

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:5173"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Cookie parser
app.use(cookieParser());

// Body parsing with size limits
// Capture raw body for Paystack webhook signature verification
app.use(express.json({ limit: '10mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health endpoint - MUST be before CORS for Railway health checks
app.get("/health", async (_req, res) => {
  try {
    // Try to ping the database
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    // Still return ok for healthcheck, but note DB status
    res.json({ ok: true, database: "connecting" });
  }
});

// CORS configuration - whitelist specific origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',');

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use("/auth", authRoutes);
app.use("/subjects", subjectRoutes);
app.use("/questions", questionRoutes);
app.use("/sessions", sessionRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/challenges", challengeRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/users", userRoutes);
app.use("/ai", aiRoutes);
app.use("/user-data", userDataRoutes);
app.use("/keys", keyRoutes);
app.use("/classroom", classroomRoutes);
app.use("/lecturers", lecturerRoutes);
app.use("/teacher-invites", teacherInviteRoutes);
app.use("/live-sessions", liveSessionRoutes);
app.use("/classroom-assignments", classroomAssignmentRoutes);
app.use("/polls", pollRoutes);
app.use("/push", pushRoutes);
app.use("/gamification", gamificationRoutes);
app.use("/wall", wallRoutes);
app.use("/youtube", youtubeRoutes);
app.use("/announcements", announcementRoutes);
app.use("/ai-proxy", aiProxyRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/folders", foldersRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/universities", universitiesRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/topics", topicsRoutes);
app.use("/api/mastery", masteryRoutes);
app.use("/payment", paymentRoutes);
app.use("/api/voice-session", voiceSessionRoutes);
app.use("/api/curriculum", curriculumRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

// ── WebSocket server for voice tutor audio relay ──────────────────────────────
const wss = new WebSocketServer({ noServer: true });

// NOTE: the "upgrade" event is emitted by the underlying http.Server instance
// (the one returned by app.listen()), NOT by the Express `app` function itself.
// The actual listener is attached to `server` further below, after app.listen().
async function handleVoiceWsUpgrade(request, socket, head) {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  const voiceWsMatch = pathname.match(/^\/api\/voice-session\/([^/]+)\/ws$/);
  if (!voiceWsMatch) {
    socket.destroy();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const ticket = url.searchParams.get("ticket");

  if (!ticket) {
    socket.destroy();
    return;
  }

  const ticketInfo = consumeTicket(ticket);
  if (!ticketInfo) {
    socket.destroy();
    return;
  }

  const sessionId = ticketInfo.sessionId;
  const userId = ticketInfo.userId;

  const session = getActiveSession(ticketInfo.sessionId);
  if (!session || session.userId !== userId) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    // Clear any existing grace timer (this is a reconnection)
    if (session.graceTimerId) {
      clearTimeout(session.graceTimerId);
      session.graceTimerId = null;
    }
    session.clientWs = ws;
    console.log(`Client WebSocket connected for voice session ${sessionId}`);

    // If Gemini setup already completed before client connected (race condition),
    // send setup_complete immediately so the client transitions to READY
    if (session.setupComplete) {
      console.log(`Setup already complete for session ${sessionId}, notifying client`);
      ws.send(JSON.stringify({ type: "setup_complete" }));
    }

    ws.on("message", (data, isBinary) => {
      if (!session.setupComplete) return;
      session.lastActivityAt = Date.now();

      // Binary frames = raw PCM audio from client mic
      if (isBinary) {
        if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
          const audioMsg = {
            realtimeInput: {
              audio: {
                data: data.toString("base64"),
                mimeType: "audio/pcm;rate=16000",
              },
            },
          };
          session.geminiWs.send(JSON.stringify(audioMsg));
        }
        return;
      }

      // Text frames = JSON control messages
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }

      // Handle ping/pong keepalive
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", t: parsed.t }));
        return;
      }

      // Handle mode switch — opens a new Gemini session with fresh system instructions
      if (parsed.type === "mode_switch" && parsed.mode) {
        const validModes = ["teach", "quiz", "discuss"];
        if (!validModes.includes(parsed.mode)) return;
        console.log(`Mode switch requested for session ${sessionId}: ${session.mode} -> ${parsed.mode}`);
        ws.send(JSON.stringify({ type: "mode_switching", from: session.mode, to: parsed.mode }));
        rebuildGeminiSession(session, parsed.mode);
        return;
      }

      if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
        if (parsed.type === "text" && parsed.text) {
          const textMsg = {
            clientContent: {
              turns: [{ parts: [{ text: parsed.text }] }],
            },
          };
          session.geminiWs.send(JSON.stringify(textMsg));
        } else if (parsed.type === "interrupt") {
          const interruptMsg = {
            clientContent: { turns: [] },
          };
          session.geminiWs.send(JSON.stringify(interruptMsg));
        } else if (parsed.type === "page_change" && parsed.page) {
          const pageMsg = buildPageContextMessage(parsed.page, parsed.text || "");
          session.geminiWs.send(JSON.stringify(pageMsg));
          session.currentPage = parsed.page;
        }
      }
    });

    ws.on("close", () => {
      console.log(`Client WebSocket disconnected for voice session ${sessionId}`);
      // Start grace period instead of immediately closing Gemini WS
      // This allows the client to reconnect without losing the Gemini session
      session.graceTimerId = setTimeout(() => {
        console.log(`Voice session ${sessionId} grace period expired, cleaning up`);
        if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
          try { session.geminiWs.close(); } catch {}
        }
        deleteActiveSession(sessionId);
      }, 30000);
    });

    ws.on("error", (err) => {
      console.error(`Client WebSocket error for session ${sessionId}:`, err.message);
    });
  });
}

// ── Zombie session sweep ──────────────────────────────────────────────────────
// Closes upstream Gemini Live connections that are idle or have no active client,
// preventing wasted API spend on leaked sessions.
const ZOMBIE_SWEEP_INTERVAL_MS = 30 * 1000;
const ZOMBIE_IDLE_THRESHOLD_MS = 120 * 1000;

let zombieSessionsSwept = 0;

setInterval(() => {
  const sessions = getActiveSessions();
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    const clientConnected = session.clientWs && session.clientWs.readyState === WebSocket.OPEN;
    const idleMs = now - (session.lastActivityAt || session.startTime);

    // Case 1: Client disconnected, no grace timer running (grace expired but not cleaned up)
    const graceActive = session.graceTimerId !== null && session.graceTimerId !== undefined;
    if (!clientConnected && !graceActive) {
      console.warn(`Zombie session ${sessionId} swept: client disconnected, no grace timer. idle ${Math.round(idleMs / 1000)}s`);
      if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
        try { session.geminiWs.close(); } catch {}
      }
      zombieSessionsSwept++;
      deleteActiveSession(sessionId);
      continue;
    }

    // Case 2: Client connected but no activity for 120s
    if (clientConnected && idleMs > ZOMBIE_IDLE_THRESHOLD_MS) {
      console.warn(`Zombie session ${sessionId} swept: idle ${Math.round(idleMs / 1000)}s with client connected`);
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        try {
          session.clientWs.send(JSON.stringify({ type: "session_timeout", message: "Session ended due to inactivity" }));
          session.clientWs.close();
        } catch {}
      }
      if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
        try { session.geminiWs.close(); } catch {}
      }
      zombieSessionsSwept++;
      deleteActiveSession(sessionId);
    }
  }
  if (zombieSessionsSwept > 0 && sessions.size === 0) {
    console.log(`Zombie sweep: ${zombieSessionsSwept} total sessions swept so far`);
  }
}, ZOMBIE_SWEEP_INTERVAL_MS);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(err.status || 500).json({ 
      error: 'Internal server error' 
    });
  } else {
    res.status(err.status || 500).json({ 
      error: err.message,
      stack: err.stack 
    });
  }
});

const port = Number(process.env.PORT || 4000);

// Handle uncaught errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

// Graceful shutdown - close Prisma connections
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing database connections...`);
  try {
    await prisma.$disconnect();
    console.log("Database connections closed successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error closing database connections:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server first, then sync database
const server = app.listen(port, "0.0.0.0", async () => {
  console.log(`API running on port ${port}`);
  console.log("Environment:", process.env.NODE_ENV || "development");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);

  // Don't connect to database on startup - use lazy connection
  // This prevents connection pool exhaustion during container restarts
  console.log("Server started. Database will connect on first request.");
});

// Attach the WebSocket upgrade handler to the actual http.Server instance.
// (Express `app` does not emit "upgrade" — only the underlying http.Server does.)
server.on("upgrade", handleVoiceWsUpgrade);
