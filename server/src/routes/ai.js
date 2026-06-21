import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";

const router = Router();

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

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

// Individual provider call helpers. Each returns { ok, text, status, error, retriable }.
async function tryGemini(prompt, model) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, status: 503, error: "No Gemini key", retriable: true };
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || DEFAULT_GEMINI_MODEL)}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `Gemini error ${r.status}`;
      // 429 / 403 quota & rate limit are retriable on another provider
      const retriable = r.status === 429 || r.status === 403 || r.status === 503 || r.status >= 500;
      return { ok: false, status: r.status, error: msg, retriable };
    }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { ok: true, text, provider: "gemini", model: model || DEFAULT_GEMINI_MODEL };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, retriable: true };
  }
}

async function tryOpenRouter(prompt, model) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, status: 503, error: "No OpenRouter key", retriable: true };
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://scholars-circle.vercel.app",
        "X-Title": "Scholar's Circle",
      },
      body: JSON.stringify({
        model: model || DEFAULT_OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `OpenRouter error ${r.status}`;
      const retriable = r.status === 429 || r.status === 402 || r.status === 503 || r.status >= 500;
      return { ok: false, status: r.status, error: msg, retriable };
    }
    const text = data.choices?.[0]?.message?.content || "";
    return { ok: true, text, provider: "openrouter", model: model || DEFAULT_OPENROUTER_MODEL };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, retriable: true };
  }
}

async function tryOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, status: 503, error: "No OpenAI key", retriable: true };
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || DEFAULT_OPENAI_MODEL, input: prompt }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `OpenAI error ${r.status}`;
      const retriable = r.status === 429 || r.status === 503 || r.status >= 500;
      return { ok: false, status: r.status, error: msg, retriable };
    }
    const text = data.output_text || "";
    return { ok: true, text, provider: "openai", model: model || DEFAULT_OPENAI_MODEL };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, retriable: true };
  }
}

function providersAvailable() {
  const list = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.OPENROUTER_API_KEY) list.push("openrouter");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

router.post("/generate", async (req, res) => {
  const { prompt, provider, model } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  const available = providersAvailable();
  if (available.length === 0) {
    return res.status(503).json({ error: "AI is temporarily unavailable: no provider configured on the server." });
  }

  // Build try-order: requested provider first (if available), then the rest as fallbacks.
  const tryOrder = [];
  if (provider && available.includes(provider)) tryOrder.push(provider);
  for (const p of available) if (!tryOrder.includes(p)) tryOrder.push(p);

  const errors = [];
  for (const p of tryOrder) {
    let result;
    if (p === "gemini") result = await tryGemini(prompt, p === provider ? model : null);
    else if (p === "openrouter") result = await tryOpenRouter(prompt, p === provider ? model : null);
    else if (p === "openai") result = await tryOpenAI(prompt, p === provider ? model : null);
    else continue;

    if (result.ok) {
      return res.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        fallback: p !== (provider || tryOrder[0]) ? true : undefined
      });
    }

    errors.push({ provider: p, status: result.status, error: result.error });
    // Only fall through on retriable errors (quota / rate / 5xx / network).
    if (!result.retriable) break;
  }

  // All providers failed.
  const last = errors[errors.length - 1] || { error: "AI request failed" };
  const userMsg =
    last.status === 429 ? "AI usage limit reached. Please try again in a minute."
    : last.status === 401 || last.status === 403 ? "AI authentication issue on the server. Please contact admin."
    : last.status === 402 ? "AI quota exhausted. Please contact admin."
    : last.status === 503 ? "AI service temporarily unavailable. Try again shortly."
    : `AI request failed: ${last.error}`;

  return res.status(last.status || 502).json({
    error: userMsg,
    detail: errors,
    triedProviders: tryOrder
  });
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
