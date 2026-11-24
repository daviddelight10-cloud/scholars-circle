// Gemini TTS -> MP3. Same TTS call the voice-preview endpoint uses; PCM is
// encoded to MP3 server-side (lamejs) because MP3 is ~6x smaller than WAV —
// matters for students on mobile data.
import { Mp3Encoder } from "@breezystack/lamejs";

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const LESSON_VOICE = "Sulafat"; // fixed for the shared cache
const SAMPLE_RATE = 24000;

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

// Returns { ok, mp3?, durationMs?, error? }.
export async function synthesizeSection(text, voice = LESSON_VOICE) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "no-key" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read this lesson section aloud, clearly and at a steady teaching pace:\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
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
  } catch (err) {
    return { ok: false, error: err.message, retriable: true };
  }
}
