// Unified AI caller. Prefers the backend proxy when available so the API key
// never leaves the server. Falls back to a direct browser-side call only if
// the user explicitly stored their own API key client-side.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

let _proxyStatus = null; // { enabled, providers, defaultProvider }

export async function getProxyStatus() {
  if (_proxyStatus !== null) return _proxyStatus;
  try {
    const res = await fetch(`${API_BASE}/ai/status`);
    if (res.ok) {
      _proxyStatus = await res.json();
    } else {
      _proxyStatus = { enabled: false };
    }
  } catch {
    _proxyStatus = { enabled: false };
  }
  return _proxyStatus;
}

export function resetProxyStatusCache() {
  _proxyStatus = null;
}

async function callViaProxy(prompt, provider, model) {
  const res = await fetch(`${API_BASE}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, provider, model }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Proxy error ${res.status}`);
  return data.text || "";
}

async function callDirect(prompt, aiConfig) {
  const provider = aiConfig?.provider || "openrouter";
  const model = aiConfig?.model || (provider === "gemini" ? "gemini-2.5-flash" : 
                                     provider === "openrouter" ? "qwen/qwen-2.5-7b-instruct" : 
                                     "gpt-4o-mini");
  if (!aiConfig?.apiKey) {
    throw new Error("No AI key set. Either configure the server proxy or paste a key in Settings.");
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
  const status = await getProxyStatus();
  if (status?.enabled) {
    const provider = aiConfig.provider || status.defaultProvider || "openrouter";
    const model = aiConfig.model || (provider === "gemini" ? "gemini-2.5-flash" : 
                                     provider === "openrouter" ? "qwen/qwen-2.5-7b-instruct" : 
                                     "gpt-4o-mini");
    return callViaProxy(prompt, provider, model);
  }
  return callDirect(prompt, aiConfig);
}

// Helper for the common pattern of asking AI for a JSON array/object response.
export function extractJSON(raw, kind = "object") {
  const open = kind === "array" ? "[" : "{";
  const close = kind === "array" ? "]" : "}";
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error("AI did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}
