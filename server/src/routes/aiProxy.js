import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimit, FREE_TRIAL_AI_DAILY_LIMIT, getResetAt } from "../middleware/aiRateLimit.js";
import { logSecurityEvent } from "../lib/logger.js";
import { prisma } from "../db.js";

const router = express.Router();

// GET /ai-proxy/usage — Returns today's AI usage count and limit for the frontend
router.get("/usage", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { isActivated: true },
    });
    const isActivated = user?.isActivated ?? false;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const used = await prisma.aiUsageLog.count({
      where: { userId: req.user.sub, createdAt: { gte: startOfDay } },
    });
    res.json({ used, limit: FREE_TRIAL_AI_DAILY_LIMIT, isActivated, resetAt: getResetAt() });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch usage" });
  }
});

// POST /ai-proxy/generate - Proxy AI requests to keep API keys server-side
router.post("/generate", requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, provider, model, system, messages } = req.body;

    const hasPrompt = prompt && typeof prompt === "string";
    const hasMessages = messages && Array.isArray(messages) && messages.length > 0;
    if (!hasPrompt && !hasMessages) {
      return res.status(400).json({ error: "Prompt or messages is required" });
    }

    // Get API key from environment based on provider
    let apiKey;
    let apiUrl;
    let requestBody;
    let headers;

    switch (provider) {
      case "gemini":
        apiKey = process.env.GEMINI_API_KEY;
        const geminiModel = model || "gemini-2.0-flash-exp";
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        requestBody = {
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        };
        if (system) {
          requestBody.systemInstruction = { parts: [{ text: system }] };
        }
        if (hasMessages) {
          requestBody.contents = messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));
        } else {
          requestBody.contents = [{ parts: [{ text: prompt }] }];
        }
        break;

      case "openrouter":
        apiKey = process.env.OPENROUTER_API_KEY;
        const openrouterModel = model || "z-ai/glm-5.3-flash";
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Scholar's Circle",
        };
        {
          const msgs = [];
          if (system) msgs.push({ role: "system", content: system });
          if (hasMessages) {
            msgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
          } else {
            msgs.push({ role: "user", content: prompt });
          }
          requestBody = {
            model: openrouterModel,
            messages: msgs,
            max_tokens: 32768,
            reasoning: { effort: "low" },
          };
        }
        break;

      case "openai":
        apiKey = process.env.OPENAI_API_KEY;
        const openaiModel = model || "gpt-4o-mini";
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        };
        {
          const msgs = [];
          if (system) msgs.push({ role: "system", content: system });
          if (hasMessages) {
            msgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
          } else {
            msgs.push({ role: "user", content: prompt });
          }
          requestBody = {
            model: openaiModel,
            messages: msgs,
            max_tokens: 8192,
          };
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid provider. Use 'gemini', 'openrouter', or 'openai'" });
    }

    if (!apiKey) {
      logSecurityEvent(req.user.sub, 'ai_proxy_missing_key', { provider }, req);
      return res.status(500).json({ error: `${provider} API key not configured on server` });
    }

    // Make request to AI provider
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Provider Error (${provider}):`, errorText);
      logSecurityEvent(req.user.sub, 'ai_proxy_error', { provider, status: response.status }, req);
      return res.status(response.status).json({ 
        error: `AI provider error: ${response.statusText}`,
        details: process.env.NODE_ENV === 'development' ? errorText : undefined
      });
    }

    const data = await response.json();

    // Extract text based on provider response format
    let text;
    if (provider === "gemini") {
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (provider === "openrouter" || provider === "openai") {
      text = data.choices?.[0]?.message?.content || "";
    }

    // Log successful AI usage
    logSecurityEvent(req.user.sub, 'ai_proxy_success', { provider, model, promptLength: prompt?.length || 0 }, req);

    return res.json({ text, rawResponse: data });

  } catch (error) {
    console.error("AI Proxy Error:", error);
    logSecurityEvent(req.user.sub, 'ai_proxy_exception', { error: error.message }, req);
    return res.status(500).json({ 
      error: "Failed to process AI request",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /ai-proxy/tutor - Tutor call: server-side Research Hub retrieval + SSE streaming.
// The client embeds a {{DOC_CATALOG}} placeholder in its prompt; we replace it with
// documents matching the student's query, then stream the model response back as
// normalized SSE events: meta (matched docs) → token* → done.
router.post("/tutor", requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, provider, model, query } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // ── Research Hub retrieval: match documents to the student's question ──
    let matchedDocs = [];
    let docBlock = "";
    if (query && typeof query === "string") {
      const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2).slice(0, 8);
      if (words.length) {
        try {
          matchedDocs = await prisma.resource.findMany({
            where: {
              status: "approved",
              OR: [
                ...words.map(w => ({ title: { contains: w, mode: "insensitive" } })),
                ...words.map(w => ({ subject: { contains: w, mode: "insensitive" } })),
                ...words.map(w => ({ courseCode: { contains: w, mode: "insensitive" } })),
                ...words.map(w => ({ tags: { has: w } })),
              ],
            },
            select: {
              id: true, shareToken: true, title: true, subject: true, contentType: true,
              courseCode: true, fileUrl: true, fileName: true, mimeType: true, mcqData: true,
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          });
          if (matchedDocs.length) {
            docBlock =
              "## Scholar's Circle Research Hub (documents matching this question — cite exact titles)\n" +
              matchedDocs.map(r =>
                `- "${r.title}" [${r.contentType}${r.contentType === "mcq" && Array.isArray(r.mcqData) ? ` · ${r.mcqData.length} questions` : ""}${r.subject ? ` · ${r.subject}` : ""}${r.courseCode ? ` · ${r.courseCode}` : ""}]`
              ).join("\n");
          }
        } catch (e) {
          console.error("Tutor doc search failed:", e.message);
        }
      }
    }

    const finalPrompt = prompt.replace("{{DOC_CATALOG}}", docBlock);

    // ── Provider setup (streaming variants) ──
    const useProvider = provider || "openrouter";
    let apiKey, apiUrl, requestBody, headers;
    switch (useProvider) {
      case "openrouter": {
        apiKey = process.env.OPENROUTER_API_KEY;
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Scholar's Circle",
        };
        requestBody = {
          model: model || "z-ai/glm-5.3-flash",
          messages: [{ role: "user", content: finalPrompt }],
          max_tokens: 32768,
          reasoning: { effort: "low" },
          stream: true,
        };
        break;
      }
      case "openai": {
        apiKey = process.env.OPENAI_API_KEY;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        };
        requestBody = {
          model: model || "gpt-4o-mini",
          messages: [{ role: "user", content: finalPrompt }],
          max_tokens: 8192,
          stream: true,
        };
        break;
      }
      case "gemini": {
        apiKey = process.env.GEMINI_API_KEY;
        const geminiModel = model || "gemini-2.5-flash";
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        requestBody = {
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        };
        break;
      }
      default:
        return res.status(400).json({ error: "Invalid provider. Use 'gemini', 'openrouter', or 'openai'" });
    }

    if (!apiKey) {
      logSecurityEvent(req.user.sub, 'ai_proxy_missing_key', { provider: useProvider }, req);
      return res.status(500).json({ error: `${useProvider} API key not configured on server` });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Provider Error (${useProvider} tutor):`, errorText);
      logSecurityEvent(req.user.sub, 'ai_proxy_error', { provider: useProvider, status: response.status }, req);
      return res.status(response.status).json({
        error: `AI provider error: ${response.statusText}`,
        details: process.env.NODE_ENV === 'development' ? errorText : undefined,
      });
    }

    // Upstream confirmed — switch to SSE mode
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const emit = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };
    emit({
      type: "meta",
      documents: matchedDocs.map(r => ({
        id: r.id, shareToken: r.shareToken, title: r.title,
        contentType: r.contentType, subject: r.subject || null, courseCode: r.courseCode || null,
        fileUrl: r.fileUrl || null, fileName: r.fileName || null, mimeType: r.mimeType || null,
        mcqData: r.mcqData || null,
      })),
    });

    // Pipe upstream SSE chunks → normalized token events
    const reader = response.body.getReader();
    req.on("close", () => { try { reader.cancel(); } catch {} });
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let chunk;
          try { chunk = JSON.parse(payload); } catch { continue; }
          const text = useProvider === "gemini"
            ? (chunk.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("")
            : chunk.choices?.[0]?.delta?.content;
          if (text) emit({ type: "token", text });
        }
      }
      emit({ type: "done" });
      logSecurityEvent(req.user.sub, 'ai_proxy_tutor_success', { provider: useProvider, model, docsMatched: matchedDocs.length }, req);
    } catch (streamErr) {
      console.error("Tutor stream error:", streamErr.message);
      emit({ type: "error", message: "The response was interrupted. Please try again." });
    }
    res.end();

  } catch (error) {
    console.error("AI Tutor Proxy Error:", error);
    if (res.headersSent) {
      try { res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to process AI request" })}\n\n`); res.end(); } catch {}
      return;
    }
    logSecurityEvent(req.user.sub, 'ai_proxy_exception', { error: error.message }, req);
    return res.status(500).json({
      error: "Failed to process AI request",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// POST /ai-proxy/generate-multimodal - Proxy multimodal (image+text) AI requests
// Supports conversation history for follow-up turns
router.post("/generate-multimodal", requireAuth, aiRateLimit, async (req, res) => {
  try {
    const { prompt, image, images, history, provider, model } = req.body;

    // Normalize images into an array
    const allImages = [];
    if (Array.isArray(images)) allImages.push(...images);
    if (image) allImages.push(image);

    if (!prompt && allImages.length === 0) {
      return res.status(400).json({ error: "Prompt or image is required" });
    }

    const useProvider = provider || "openrouter";
    let apiKey;
    let apiUrl;
    let requestBody;
    let headers;

    switch (useProvider) {
      case "openrouter":
        apiKey = process.env.OPENROUTER_API_KEY;
        const openrouterModel = model || "z-ai/glm-5.3-flash";
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Scholar's Circle",
        };

        // Build messages array from history + current prompt
        const messages = [];

        // Add conversation history if provided
        if (history && Array.isArray(history)) {
          for (const msg of history) {
            if (msg.role === "user" && msg.image) {
              // User message with image (first turn from circle-to-ask)
              const content = [{ type: "text", text: msg.content }];
              if (msg.image) {
                content.push({
                  type: "image_url",
                  image_url: { url: msg.image },
                });
              }
              messages.push({ role: "user", content });
            } else {
              messages.push({ role: msg.role, content: msg.content });
            }
          }
        }

        // Add current message
        if (allImages.length > 0) {
          const content = [{ type: "text", text: prompt || "Explain what's shown in this image." }];
          for (const img of allImages) {
            content.push({ type: "image_url", image_url: { url: img } });
          }
          messages.push({ role: "user", content });
        } else {
          messages.push({ role: "user", content: prompt });
        }

        requestBody = {
          model: openrouterModel,
          messages,
          max_tokens: 16384,
          reasoning: { effort: "low" },
        };
        break;

      case "gemini":
        apiKey = process.env.GEMINI_API_KEY;
        const geminiModel = model || "gemini-2.5-flash";
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };

        // Build Gemini format with history
        const geminiContents = [];
        if (history && Array.isArray(history)) {
          for (const msg of history) {
            const parts = [{ text: msg.content }];
            if (msg.role === "user" && msg.image) {
              parts.push({
                inline_data: {
                  mime_type: "image/png",
                  data: msg.image.split(",")[1] || msg.image,
                },
              });
            }
            geminiContents.push({
              role: msg.role === "assistant" ? "model" : "user",
              parts,
            });
          }
        }

        // Add current message
        const currentParts = [{ text: prompt || "Explain what's shown in this image." }];
        for (const img of allImages) {
          currentParts.push({
            inline_data: {
              mime_type: "image/png",
              data: img.split(",")[1] || img,
            },
          });
        }
        geminiContents.push({ role: "user", parts: currentParts });

        requestBody = {
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        };
        break;

      default:
        return res.status(400).json({ error: "Multimodal support requires 'openrouter' or 'gemini' provider" });
    }

    if (!apiKey) {
      logSecurityEvent(req.user.sub, 'ai_proxy_missing_key', { provider: useProvider }, req);
      return res.status(500).json({ error: `${useProvider} API key not configured on server` });
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Provider Error (${useProvider} multimodal):`, errorText);
      logSecurityEvent(req.user.sub, 'ai_proxy_error', { provider: useProvider, status: response.status }, req);
      return res.status(response.status).json({
        error: `AI provider error: ${response.statusText}`,
        details: process.env.NODE_ENV === 'development' ? errorText : undefined
      });
    }

    const data = await response.json();

    let text;
    if (useProvider === "gemini") {
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      text = data.choices?.[0]?.message?.content || "";
    }

    logSecurityEvent(req.user.sub, 'ai_proxy_multimodal_success', { provider: useProvider, model, promptLength: prompt?.length || 0, hasImage: !!image }, req);

    return res.json({ text });
  } catch (error) {
    console.error("AI Proxy Multimodal Error:", error);
    logSecurityEvent(req.user.sub, 'ai_proxy_exception', { error: error.message }, req);
    return res.status(500).json({
      error: "Failed to process multimodal AI request",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
