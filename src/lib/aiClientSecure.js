/**
 * Secure AI Client - Uses backend proxy to keep API keys server-side
 * This replaces direct AI API calls with proxied requests
 */

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

/**
 * Call AI through secure backend proxy
 * @param {string} prompt - The prompt to send to the AI
 * @param {object} config - AI configuration
 * @param {string} config.provider - AI provider: 'gemini', 'openrouter', or 'openai'
 * @param {string} config.model - Model name (optional, uses defaults)
 * @returns {Promise<string>} - AI generated text
 */
export async function callAISecure(prompt, config = {}) {
  const { provider = "openrouter", model } = config;

  try {
    // Get auth token from localStorage for backwards compatibility
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    if (!token) {
      throw new Error("Authentication required. Please log in to use AI features.");
    }

    const response = await fetch(`${API_BASE}/ai-proxy/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      credentials: "include", // Support for httpOnly cookies
      body: JSON.stringify({
        prompt,
        provider,
        model,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `AI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text || "";

  } catch (error) {
    console.error("AI Proxy Error:", error);
    throw error;
  }
}

/**
 * Extract JSON from AI response (handles markdown code blocks)
 */
export function extractJSON(text) {
  if (!text) return null;
  
  // Try to find JSON in markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.warn("Failed to parse JSON from code block:", e);
    }
  }
  
  // Try to parse the whole text as JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    // Not JSON, return as-is
    return text;
  }
}

/**
 * Check if AI proxy is available (for feature detection)
 */
export async function checkAIProxyAvailable() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export default callAISecure;
