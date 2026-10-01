import { API_BASE } from "../../lib/constants.js";

let currentAudio = null;
let currentUrl = null;

export function stopVoicePreview() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export async function playVoicePreview(voiceName) {
  try {
    stopVoicePreview();
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const resp = await fetch(`${API_BASE}/voice-session/voice-preview/${encodeURIComponent(voiceName)}`, {
      headers: authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {},
      credentials: "include",
    });
    if (!resp.ok) return false;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentUrl = url;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) { currentAudio = null; currentUrl = null; }
    };
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
