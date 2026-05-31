import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { logSecurityEvent } from "../lib/logger.js";

const router = express.Router();

// POST /ai-proxy/generate - Proxy AI requests to keep API keys server-side
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { prompt, provider, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        };
        break;

      case "openrouter":
        apiKey = process.env.OPENROUTER_API_KEY;
        const openrouterModel = model || "qwen/qwen-2.5-7b-instruct";
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
          "X-Title": "Scholar's Circle",
        };
        requestBody = {
          model: openrouterModel,
          messages: [{ role: "user", content: prompt }],
        };
        break;

      case "openai":
        apiKey = process.env.OPENAI_API_KEY;
        const openaiModel = model || "gpt-4o-mini";
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        };
        requestBody = {
          model: openaiModel,
          messages: [{ role: "user", content: prompt }],
        };
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
    logSecurityEvent(req.user.sub, 'ai_proxy_success', { provider, model, promptLength: prompt.length }, req);

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

export default router;
