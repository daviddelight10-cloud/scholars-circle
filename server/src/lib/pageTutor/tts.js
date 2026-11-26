// Lesson narration TTS -> MP3. Primary: Google Cloud WaveNet (API key).
// Fallback: Gemini TTS (PCM -> lamejs MP3). The text sent is spoken verbatim —
// never prepend delivery instructions; TTS reads them aloud.
import { Mp3Encoder } from "@breezystack/lamejs";

const TTS_MODEL = process.env.PAGE_TUTOR_TTS_MODEL || "gemini-3.8-flash-lite-tts";
export const LESSON_VOICE = "Sulafat"; // Gemini fallback voice, fixed for the shared cache
const SAMPLE_RATE = 24000;

// Google Cloud Text-to-Speech (WaveNet). GOOGLE_TTS_VOICE must be a valid
// Google voice name (e.g. en-US-Wavenet-D); old Gemini names ("Sulafat")
// fall back to the default rather than erroring.
const GOOGLE_KEY = process.env.GOOGLE_TTS_API_KEY;
const GOOGLE_VOICE = process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-D";
const GOOGLE_LANG = process.env.GOOGLE_TTS_LANG || GOOGLE_VOICE.slice(0, 5);
const GOOGLE_RATE = Math.min(4, Math.max(0.25, Number(process.env.GOOGLE_TTS_RATE) || 0.95));
const GOOGLE_NAME_RE = /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9-]+$/;

function pcmToMp3(pcm, sampleRate = SAMPLE_RATE) {
  const enc = new Mp3Encoder(1, sampleRate, 64); // mono, 64kbps — speech
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const chunks = [];
  for (let i = 0; i < samples.length; i += 1152 * 8) {
    const part = enc.encodeBuffer(samples.subarray(i, i + 1152 * 8));
    if (part.length) chunks.push(Buffer.from(part));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

async function synthesizeGoogle(text, voice) {
  const name = GOOGLE_NAME_RE.test(voice || "") ? voice : GOOGLE_VOICE;
  const languageCode = name.slice(0, 5) || GOOGLE_LANG;
  const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, name },
      audioConfig: { audioEncoding: "MP3", speakingRate: GOOGLE_RATE },
    }),
    signal: AbortSignal.timeout(30_000), // bound it — a stuck call would wedge the audio queue
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, error: `google-tts ${resp.status}: ${body.slice(0, 120)}`, retriable: resp.status === 429 || resp.status >= 500 };
  }
  const data = await resp.json().catch(() => ({}));
  if (!data?.audioContent) return { ok: false, error: "no audio in Google TTS response" };
  const mp3 = Buffer.from(data.audioContent, "base64");
  // Duration estimate: ~14.5 chars/sec at 1.0 rate (no PCM to measure).
  const durationMs = Math.round((text.length / (14.5 * GOOGLE_RATE)) * 1000);
  return { ok: true, mp3, durationMs, chars: text.length };
}

async function synthesizeGemini(text, voice) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "no-key" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    signal: AbortSignal.timeout(30_000), // bound it — a stuck call would wedge the audio queue
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, error: `tts ${resp.status}: ${body.slice(0, 120)}`, retriable: resp.status === 429 || resp.status >= 500 };
  }
  const data = await resp.json().catch(() => ({}));
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) return { ok: false, error: "no audio in TTS response" };
  const pcm = Buffer.from(b64, "base64");
  const mp3 = pcmToMp3(pcm);
  const durationMs = Math.round((pcm.byteLength / 2 / SAMPLE_RATE) * 1000);
  return { ok: true, mp3, durationMs, chars: text.length };
}

// Returns { ok, mp3?, durationMs?, error? }.
export async function synthesizeSection(text, voice = LESSON_VOICE) {
  try {
    if (GOOGLE_KEY) return await synthesizeGoogle(text, voice);
    return await synthesizeGemini(text, voice);
  } catch (err) {
    return { ok: false, error: err.message, retriable: true };
  }
}
