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

const app = express();

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://adorable-alpaca-de885b.netlify.app",
  "https://*.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes("*")) {
        const pattern = allowed.replace("*", ".*");
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
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

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});
