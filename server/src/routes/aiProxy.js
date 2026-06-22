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
        const openrouterModel = model || "google/gemini-2.5-flash";
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

// POST /ai-proxy/generate-multimodal - Proxy multimodal (image+text) AI requests
// Supports conversation history for follow-up turns
router.post("/generate-multimodal", requireAuth, async (req, res) => {
  try {
    const { prompt, image, history, provider, model } = req.body;

    if (!prompt && !image) {
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
        const openrouterModel = model || "google/gemini-2.5-flash";
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
        if (image) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: prompt || "Explain what's shown in this image." },
              { type: "image_url", image_url: { url: image } },
            ],
          });
        } else {
          messages.push({ role: "user", content: prompt });
        }

        requestBody = {
          model: openrouterModel,
          messages,
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
        if (image) {
          currentParts.push({
            inline_data: {
              mime_type: "image/png",
              data: image.split(",")[1] || image,
            },
          });
        }
        geminiContents.push({ role: "user", parts: currentParts });

        requestBody = {
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
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
