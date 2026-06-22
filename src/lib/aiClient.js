// Unified AI caller. Prefers the backend proxy when available so the API key
// never leaves the server. Falls back to a direct browser-side call only if
// the user explicitly stored their own API key client-side.

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

let _proxyStatus = null; // { enabled, providers, defaultProvider }
let _proxyStatusPromise = null;

export async function getProxyStatus() {
  // Return cached status if available
  if (_proxyStatus !== null) return _proxyStatus;
  
  // If a request is already in progress, wait for it
  if (_proxyStatusPromise) return _proxyStatusPromise;
  
  _proxyStatusPromise = (async () => {
    try {
      // Check if backend is reachable
      const res = await fetch(`${API_BASE}/health`, { 
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        // Proxy is enabled by default - API keys are server-side
        _proxyStatus = { 
          enabled: true, 
          providers: ["gemini", "openrouter", "openai"],
          defaultProvider: "openrouter"
        };
      } else {
        _proxyStatus = { enabled: false };
      }
    } catch (e) {
      console.log("AI proxy status check failed:", e.message);
      // Default to enabled - will fail gracefully if backend is down
      _proxyStatus = { enabled: true, defaultProvider: "openrouter" };
    }
    _proxyStatusPromise = null;
    return _proxyStatus;
  })();
  
  return _proxyStatusPromise;
}

export function resetProxyStatusCache() {
  _proxyStatus = null;
}

async function callViaProxy(prompt, provider, model) {
  let res;
  try {
    // Get auth token for secure proxy
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;
    
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    res = await fetch(`${API_BASE}/ai-proxy/generate`, {
      method: "POST",
      headers,
      credentials: "include", // Support httpOnly cookies
      body: JSON.stringify({ prompt, provider, model }),
      signal: AbortSignal.timeout(60000) // 60s for long generations
    });
  } catch (netErr) {
    if (netErr.name === "TimeoutError" || netErr.name === "AbortError") {
      throw new Error("AI request timed out. Please try again with a shorter prompt.");
    }
    throw new Error("Network error reaching AI service. Please check your connection.");
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    // Server now returns user-friendly messages; surface as-is.
    throw new Error(data?.error || `AI service error (${res.status})`);
  }
  return data.text || "";
}

async function callDirect(prompt, aiConfig) {
  const provider = aiConfig?.provider || "openrouter";
  const model = aiConfig?.model || (provider === "gemini" ? "gemini-2.5-flash" : 
                                     provider === "openrouter" ? "google/gemini-2.5-flash" : 
                                     "gpt-4o-mini");
  if (!aiConfig?.apiKey) {
    throw new Error("AI service unavailable. Please contact support or try again later.");
  }
  if (provider === "gemini") {
    console.log("Calling Gemini API with model:", model);
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();
    console.log("Gemini response status:", r.status);
    if (!r.ok) {
      console.error("Gemini error response:", data);
      throw new Error(data?.error?.message || `Gemini error: ${r.status}`);
    }
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  }
  if (provider === "openrouter") {
    console.log("Calling OpenRouter API with model:", model);
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${aiConfig.apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Scholar's Circle",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
      }),
    });
    const data = await r.json();
    console.log("OpenRouter response status:", r.status);
    if (!r.ok) {
      console.error("OpenRouter error response:", data);
      throw new Error(data?.error?.message || `OpenRouter error: ${r.status}`);
    }
    return (data?.choices?.[0]?.message?.content || "").trim();
  }
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiConfig.apiKey}` },
    body: JSON.stringify({ model, input: prompt }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || "OpenAI error");
  return (data.output_text || "").trim();
}

// Main entrypoint. Tries proxy first, falls back to direct call only if proxy
// is disabled. Returns plain text string.
export async function callAI(prompt, aiConfig = {}) {
  console.log("callAI called with provider:", aiConfig.provider || "default");
  const status = await getProxyStatus();
  console.log("Proxy status:", status);
  
  if (status?.enabled) {
    const provider = aiConfig.provider || status.defaultProvider || "openrouter";
    const model = aiConfig.model || (provider === "gemini" ? "gemini-2.5-flash" : 
                                     provider === "openrouter" ? "google/gemini-2.5-flash" : 
                                     "gpt-4o-mini");
    console.log(`Calling proxy with provider=${provider}, model=${model}`);
    try {
      const result = await callViaProxy(prompt, provider, model);
      console.log("Proxy call successful, response length:", result?.length || 0);
      return result;
    } catch (proxyError) {
      console.error("Proxy call failed:", proxyError);
      throw proxyError;
    }
  }
  
  console.log("Proxy disabled, using direct call");
  return callDirect(prompt, aiConfig);
}

// Multimodal AI call with image(s) + text + conversation history.
// Uses the backend multimodal proxy endpoint. Returns plain text string.
// imageOrImages can be a single base64 data URL string or an array of strings.
export async function callAIMultimodal(prompt, imageOrImages, history = [], aiConfig = {}) {
  const provider = aiConfig.provider || "openrouter";
  const model = aiConfig.model || (provider === "gemini" ? "gemini-2.5-flash" : "google/gemini-2.5-flash");

  const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  const token = authData.authToken;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Normalize: single string → array
  const images = imageOrImages
    ? (Array.isArray(imageOrImages) ? imageOrImages : [imageOrImages])
    : [];

  let res;
  try {
    res = await fetch(`${API_BASE}/ai-proxy/generate-multimodal`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ prompt, images: images.length > 0 ? images : undefined, history, provider, model }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (netErr) {
    if (netErr.name === "TimeoutError" || netErr.name === "AbortError") {
      throw new Error("AI request timed out. Please try again.");
    }
    throw new Error("Network error reaching AI service. Please check your connection.");
  }

  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new Error(data?.error || `AI service error (${res.status})`);
  }
  return data.text || "";
}

// Helper for the common pattern of asking AI for a JSON array/object response.
export function extractJSON(raw, kind = "object") {
  if (!raw || typeof raw !== "string") throw new Error("AI returned empty response.");
  
  const open = kind === "array" ? "[" : "{";
  const close = kind === "array" ? "]" : "}";
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  
  if (start === -1 || end === -1) {
    throw new Error("AI did not return valid JSON. Try again with a shorter document.");
  }
  
  const jsonStr = raw.slice(start, end + 1);
  
  // Try parsing as-is first
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to fix common JSON issues
    try {
      // Remove trailing commas before ] or }
      let fixed = jsonStr.replace(/,\s*([\]\}])/g, '$1');
      
      // Fix unescaped quotes in strings (common AI mistake)
      fixed = fixed.replace(/"([^"]*)"([^":,}\]]*)"([^"]*)":/g, '"$1\\"$2$3":');
      
      // Try to close truncated arrays/objects
      const openBrackets = (fixed.match(/[\[{]/g) || []).length;
      const closeBrackets = (fixed.match(/[\]}]/g) || []).length;
      if (openBrackets > closeBrackets) {
        const diff = openBrackets - closeBrackets;
        // Find the last valid element and close properly
        const lastComma = fixed.lastIndexOf(',');
        if (lastComma > 0) {
          fixed = fixed.substring(0, lastComma);
        }
        for (let i = 0; i < diff; i++) {
          fixed += close;
        }
      }
      
      return JSON.parse(fixed);
    } catch (fixError) {
      // Last resort: try to extract partial valid data
      console.error("JSON parse failed, raw preview:", jsonStr.substring(0, 500));
      throw new Error("AI returned malformed JSON. The document may be too long. Try with a shorter document or fewer questions.");
    }
  }
}
