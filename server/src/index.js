import "dotenv/config";
import express from "express";
import cors from "cors";
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
import { configurePush } from "./lib/pushSender.js";
import { startStudyReminderJob } from "./lib/studyReminderJob.js";
import { seedBadges } from "./lib/badges.js";
import { prisma } from "./db.js";

// Initialize Web Push (VAPID). Safe to call even if keys are missing.
configurePush();
// Start daily motivation + reminder cron (no-op if no subscribers yet).
startStudyReminderJob();

const app = express();

// CORS configuration - allow all origins for development/production
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow all origins
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Health endpoint - always returns ok even if DB is not ready
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

// Serve uploaded files statically
app.use("/uploads", express.static("uploads"));

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
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

// Start server first, then sync database
app.listen(port, "0.0.0.0", async () => {
  console.log(`API running on port ${port}`);
  console.log("Environment:", process.env.NODE_ENV || "development");
  console.log("Database URL exists:", !!process.env.DATABASE_URL);
  
  // Try to connect to database in background
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
    // Seed badge catalogue
    await seedBadges().catch(e => console.error("Badge seed error:", e.message));
  } catch (err) {
    console.error("Database connection failed:", err.message);
    // Don't exit - let the container stay up for debugging
  }
});
