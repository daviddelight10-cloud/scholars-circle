import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";

const router = Router();

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENROUTER_MODEL = "qwen/qwen-2.5-7b-instruct";

router.get("/status", (_req, res) => {
  res.json({
    enabled: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    },
    defaultProvider: process.env.GEMINI_API_KEY ? "gemini" : 
                     (process.env.OPENAI_API_KEY ? "openai" : 
                     (process.env.OPENROUTER_API_KEY ? "openrouter" : null)),
  });
});

router.post("/generate", async (req, res) => {
  const { prompt, provider, model } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  const requestedProvider = provider || 
    (process.env.GEMINI_API_KEY ? "gemini" : 
     process.env.OPENAI_API_KEY ? "openai" : 
     process.env.OPENROUTER_API_KEY ? "openrouter" : "openai");

  try {
    if (requestedProvider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return res.status(503).json({ error: "Server has no Gemini key configured" });
      const useModel = model || DEFAULT_GEMINI_MODEL;
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(useModel)}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Gemini error" });
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return res.json({ text, provider: "gemini", model: useModel });
    }

    if (requestedProvider === "openai") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return res.status(503).json({ error: "Server has no OpenAI key configured" });
      const useModel = model || DEFAULT_OPENAI_MODEL;
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: useModel, input: prompt }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenAI error" });
      const text = data.output_text || "";
      return res.json({ text, provider: "openai", model: useModel });
    }

    if (requestedProvider === "openrouter") {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return res.status(503).json({ error: "Server has no OpenRouter key configured" });
      const useModel = model || DEFAULT_OPENROUTER_MODEL;
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://scholars-circle.vercel.app",
          "X-Title": "Scholar's Circle",
        },
        body: JSON.stringify({
          model: useModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenRouter error" });
      const text = data.choices?.[0]?.message?.content || "";
      return res.json({ text, provider: "openrouter", model: useModel });
    }

    return res.status(400).json({ error: `Unknown provider: ${requestedProvider}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || "AI request failed" });
  }
});

// Adaptive Learning: Analyze performance and provide personalized recommendations
router.post("/adaptive-learning", requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { subjects } = req.body;

    // Get user progress and session history
    const [progress, sessions] = await Promise.all([
      prisma.userProgress.findUnique({ where: { userId } }),
      prisma.sessionAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    if (!progress) {
      return res.status(404).json({ error: "User progress not found" });
    }

    const mastery = progress.mastery || {};
    const wrongCounts = progress.wrongCounts || {};

    // Detect weak areas (subjects with low mastery or high wrong counts)
    const weakAreas = [];
    for (const subject of subjects) {
      const subjectMastery = mastery[subject.id] || 0;
      const subjectWrong = wrongCounts[subject.id] || 0;

      if (subjectMastery < 60 || subjectWrong > 5) {
        weakAreas.push({
          subjectId: subject.id,
          subjectName: subject.label,
          mastery: subjectMastery,
          wrongCount: subjectWrong,
          priority: subjectMastery < 40 ? "high" : "medium",
        });
      }
    }

    // Sort weak areas by priority and wrong count
    weakAreas.sort((a, b) => {
      const priorityWeight = a.priority === "high" ? 2 : 1;
      const priorityWeightB = b.priority === "high" ? 2 : 1;
      return (priorityWeightB * b.wrongCount) - (priorityWeight * a.wrongCount);
    });

    // Calculate exam readiness score
    const avgMastery = Object.values(mastery).length > 0
      ? Object.values(mastery).reduce((a, b) => a + b, 0) / Object.values(mastery).length
      : 0;

    const recentPerformance = sessions.slice(0, 10);
    const avgRecentScore = recentPerformance.length > 0
      ? recentPerformance.reduce((sum, s) => sum + s.percentage, 0) / recentPerformance.length
      : 0;

    const examReadiness = Math.round((avgMastery * 0.6) + (avgRecentScore * 0.4));

    // Generate personalized recommendations
    const recommendations = [];
    if (weakAreas.length > 0) {
      const topWeak = weakAreas[0];
      recommendations.push({
        type: "focus",
        subject: topWeak.subjectName,
        message: `Focus on ${topWeak.subjectName} - mastery at ${topWeak.mastery}% with ${topWeak.wrongCount} incorrect answers`,
      });
    }

    if (progress.streak < 3) {
      recommendations.push({
        type: "streak",
        message: "Build a consistent study habit - aim for at least 3 consecutive days",
      });
    }

    if (sessions.length < 5) {
      recommendations.push({
        type: "practice",
        message: "Complete more practice sessions to improve your exam readiness",
      });
    }

    // Adaptive difficulty suggestion
    const difficulty = avgMastery < 50 ? "easy" : avgMastery < 75 ? "medium" : "hard";

    res.json({
      weakAreas: weakAreas.slice(0, 5), // Top 5 weak areas
      examReadiness,
      avgMastery: Math.round(avgMastery),
      avgRecentScore: Math.round(avgRecentScore),
      recommendations,
      suggestedDifficulty: difficulty,
      totalSessions: sessions.length,
      streak: progress.streak,
    });
  } catch (error) {
    console.error("Error in adaptive learning:", error);
    res.status(500).json({ error: "Failed to analyze performance" });
  }
});

export default router;
