import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { logSecurityEvent } from "../lib/logger.js";
import {
  extractTextFromFile,
  chunkText,
  buildVoiceSystemPrompt,
  buildPageContextMessage,
  extractConceptsFromChunks,
  getGeminiLiveWsUrl,
  getGeminiLiveWsOptions,
  getLiveModel,
  getCachedDocument,
  cacheDocument,
} from "../lib/voiceGrounding.js";
import { WebSocket } from "ws";

const router = Router();

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 45 * 1000;
// ~2.7s of 24kHz PCM16 audio — beyond this backlog on the client socket we drop
// audio frames rather than let latency compound.
const MAX_DOWNSTREAM_BUFFERED = 128 * 1024;
const MAX_RESUME_ATTEMPTS = 2;

const activeSessions = new Map();
const ticketStore = new Map();

export function generateTicket(sessionId, userId) {
  const ticket = crypto.randomUUID();
  ticketStore.set(ticket, {
    sessionId,
    userId,
    expiresAt: Date.now() + TICKET_TTL_MS,
    used: false,
  });
  return ticket;
}

export function consumeTicket(ticket) {
  const entry = ticketStore.get(ticket);
  if (!entry) return null;
  ticketStore.delete(ticket);
  if (entry.used || Date.now() > entry.expiresAt) return null;
  entry.used = true;
  return { sessionId: entry.sessionId, userId: entry.userId };
}

export function getActiveSession(sessionId) {
  return activeSessions.get(sessionId);
}

export function deleteActiveSession(sessionId) {
  const s = activeSessions.get(sessionId);
  if (!s) return;
  s.closed = true;
  if (s.timeoutId) clearTimeout(s.timeoutId);
  if (s.graceTimerId) clearTimeout(s.graceTimerId);
  if (s.geminiWs && s.geminiWs.readyState === WebSocket.OPEN) {
    try { s.geminiWs.close(); } catch {}
  }
  activeSessions.delete(sessionId);
}

export function getActiveSessions() {
  return activeSessions;
}

function buildGeminiSetupMessage(session, resumeHandle) {
  return {
    setup: {
      model: `models/${getLiveModel()}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: session.voiceName,
            },
          },
        },
      },
      ...(session.allowPageNav ? {
        tools: [{
          functionDeclarations: [{
            name: "go_to_page",
            description: "Navigate the student's document reader to a specific page. Call this when you reference content on a different page or want to show them where something is.",
            parameters: {
              type: "object",
              properties: {
                page: { type: "integer", description: "1-based page number" },
              },
              required: ["page"],
            },
          }],
        }],
      } : {}),
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
          endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
          prefixPaddingMs: 100,
          silenceDurationMs: 500,
        },
      },
      systemInstruction: {
        parts: [{ text: session.systemPrompt }],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    },
  };
}

function forwardToClient(session, sc) {
  const ws = session.clientWs;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  // On a congested client socket, drop audio frames but keep transcripts and
  // turn markers flowing — prefer losing audio over compounding latency.
  if (sc.modelTurn?.parts && ws.bufferedAmount > MAX_DOWNSTREAM_BUFFERED) {
    session.droppedAudioChunks = (session.droppedAudioChunks || 0) + 1;
    if (session.droppedAudioChunks % 50 === 1) {
      console.warn(`Dropping tutor audio for session ${session.id}: client bufferedAmount=${ws.bufferedAmount}`);
    }
    ws.send(JSON.stringify({
      type: "server_content",
      data: {
        ...sc,
        modelTurn: { ...sc.modelTurn, parts: sc.modelTurn.parts.filter((p) => !p.inlineData) },
        audioDropped: true,
      },
    }));
    return;
  }
  ws.send(JSON.stringify({ type: "server_content", data: sc }));
}

function connectGeminiSession(session, resumeHandle = null) {
  const sessionId = session.id;
  session.resumeHandle = resumeHandle;
  session.setupComplete = false;

  const model = getLiveModel();
  console.log(`Connecting to Gemini Live: model=${model}, session=${sessionId}, resume=${!!resumeHandle}`);

  const geminiWs = new WebSocket(getGeminiLiveWsUrl(), getGeminiLiveWsOptions());
  session.geminiWs = geminiWs;

  geminiWs.on("open", () => {
    console.log(`Gemini Live WebSocket connected for session ${sessionId}`);
    geminiWs.send(JSON.stringify(buildGeminiSetupMessage(session, resumeHandle)));
  });

  geminiWs.on("message", (data) => {
    // Ignore messages from a socket that has been replaced (reconnect/mode switch).
    if (session.geminiWs !== geminiWs) return;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.sessionResumptionUpdate) {
      const upd = msg.sessionResumptionUpdate;
      if (upd.resumable && upd.newHandle) {
        session.resumeHandle = upd.newHandle;
      }
      return;
    }

    if (msg.goAway) {
      console.log(`GoAway for session ${sessionId}, timeLeft=${JSON.stringify(msg.goAway.timeLeft || null)} — reconnecting`);
      reconnectGeminiSession(session);
      return;
    }

    if (msg.error) {
      console.error(`Gemini API error for session ${sessionId}:`, JSON.stringify(msg.error));
      session.geminiSetupError = new Error(`Gemini API error: ${msg.error.message || JSON.stringify(msg.error)}`);
      return;
    }

    if (msg.setupComplete) {
      session.setupComplete = true;
      session.resumeAttempts = 0;
      console.log(`Gemini Live setup complete for session ${sessionId}`);
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({ type: "setup_complete" }));
      }
      resetSessionTimeout(sessionId);
      return;
    }

    if (msg.serverContent) {
      const sc = msg.serverContent;
      if (sc.inputTranscription) {
        pushSessionTranscript(session, "user", sc.inputTranscription.text);
      }
      if (sc.outputTranscription) {
        pushSessionTranscript(session, "tutor", sc.outputTranscription.text);
      }
      if (sc.turnComplete || sc.interrupted) {
        const last = session.transcript[session.transcript.length - 1];
        if (last) last.closed = true;
      }
      forwardToClient(session, sc);
      session.lastActivityAt = Date.now();
      resetSessionTimeout(sessionId);
    }

    if (msg.toolCall) {
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({ type: "tool_call", data: msg.toolCall }));
      }
    }
  });

  geminiWs.on("error", (err) => {
    console.error(`Gemini Live WebSocket error for session ${sessionId}:`, err.message);
    session.geminiSetupError = err;
    if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN && !session.setupComplete) {
      session.clientWs.send(JSON.stringify({
        type: "error",
        message: "Voice tutor connection error. Please try again.",
      }));
    }
  });

  geminiWs.on("close", (code, reason) => {
    const reasonStr = reason?.toString() || "none";
    console.log(`Gemini Live WebSocket closed for session ${sessionId}. Code: ${code}, Reason: ${reasonStr}`);
    // Stale socket (replaced by reconnect/mode switch) or torn-down session.
    if (session.closed || session.geminiWs !== geminiWs) return;
    if (!session.setupComplete && !session.geminiSetupError) {
      session.geminiSetupError = new Error(`Gemini WebSocket closed early (code: ${code}, reason: ${reasonStr})`);
    }
    // Try resuming transparently before tearing down the client session.
    if (session.resumeHandle && session.resumeAttempts < MAX_RESUME_ATTEMPTS) {
      session.resumeAttempts += 1;
      console.log(`Attempting Gemini resume ${session.resumeAttempts}/${MAX_RESUME_ATTEMPTS} for session ${sessionId}`);
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        try { session.clientWs.send(JSON.stringify({ type: "reconnecting" })); } catch {}
      }
      connectGeminiSession(session, session.resumeHandle);
      return;
    }
    if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({ type: "session_ended", message: "Gemini session closed" }));
      session.clientWs.close();
    }
    endSessionInDB(sessionId, "ended", session.transcript);
    deleteActiveSession(sessionId);
  });
}

function reconnectGeminiSession(session) {
  const old = session.geminiWs;
  connectGeminiSession(session, session.resumeHandle || null);
  if (old && old.readyState === WebSocket.OPEN) {
    try { old.close(); } catch {}
  }
}

// Sends the session-start kickoff turn once, when the client socket attaches —
// prompts the tutor to greet the student and take the initiative.
export function sendSessionKickoff(session) {
  if (session.kickoffSent || !session.setupComplete) return;
  if (!session.geminiWs || session.geminiWs.readyState !== WebSocket.OPEN) return;
  session.kickoffSent = true;
  session.geminiWs.send(JSON.stringify({
    clientContent: {
      turns: [
        {
          role: "user",
          parts: [{ text: "[Session started — greet the student and kick things off as instructed.]" }],
        },
      ],
      turnComplete: true,
    },
  }));
}

async function endSessionInDB(sessionId, status = "ended", transcript = null) {
  try {
    const session = activeSessions.get(sessionId);
    const durationSec = session ? Math.round((Date.now() - session.startTime) / 1000) : 0;
    await prisma.voiceSession.update({
      where: { id: sessionId },
      data: {
        status,
        endedAt: new Date(),
        durationSec,
        ...(transcript ? { transcript: transcript } : {}),
      },
    });
  } catch (err) {
    console.error("Failed to update voice session in DB:", err.message);
  }
}

function resetSessionTimeout(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  if (session.timeoutId) clearTimeout(session.timeoutId);
  session.timeoutId = setTimeout(async () => {
    console.log(`Voice session ${sessionId} timed out after 10 minutes`);
    const ws = session.clientWs;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "session_timeout", message: "Session ended after 10 minutes" }));
        ws.close();
      } catch {}
    }
    await endSessionInDB(sessionId, "ended", session.transcript);
    deleteActiveSession(sessionId);
  }, SESSION_TIMEOUT_MS);
}

// Streaming transcription arrives as word-sized fragments — merge consecutive
// same-role fragments into one entry so stored transcripts read like turns.
function pushSessionTranscript(session, role, text) {
  const last = session.transcript[session.transcript.length - 1];
  if (last && last.role === role && !last.closed) {
    last.text += text;
  } else {
    session.transcript.push({ role, text, ts: Date.now() });
  }
}

// POST /api/voice-session/start
router.post("/start", requireAuth, async (req, res) => {
  try {
    const { resourceId, voiceName = "Achird", currentPage = null, pageText = "", level = "standard", allowPageNav = false } = req.body || {};
    if (!resourceId) {
      return res.status(400).json({ error: "resourceId is required" });
    }

    const validLevels = ["easy", "standard", "exam"];
    const sessionLevel = validLevels.includes(level) ? level : "standard";

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: {
        id: true, title: true, fileUrl: true, fileName: true,
        mimeType: true, contentType: true, uploadedBy: true, status: true,
      },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (!resource.fileUrl) {
      return res.status(400).json({ error: "This resource has no file to extract text from" });
    }

    for (const [existingId, s] of activeSessions) {
      if (s.userId === req.user.sub) {
        console.log(`Ending existing voice session ${existingId} for user ${req.user.sub}`);
        if (s.clientWs && s.clientWs.readyState === WebSocket.OPEN) {
          try {
            s.clientWs.send(JSON.stringify({ type: "session_ended", message: "Another session was started" }));
            s.clientWs.close();
          } catch {}
        }
        await endSessionInDB(existingId, "ended", s.transcript);
        deleteActiveSession(existingId);
      }
    }

    // Check document text cache first to avoid re-extraction
    let text = "";
    let chunks = null;
    const cached = getCachedDocument(resource.id);
    if (cached) {
      console.log(`Using cached document text for resource ${resource.id}`);
      text = cached.text;
      chunks = cached.chunks;
    } else {
      try {
        text = await extractTextFromFile(resource.fileUrl, resource.mimeType, resource.fileName);
      } catch (extractErr) {
        console.error("Text extraction failed:", extractErr.message);
        return res.status(422).json({ error: "Failed to extract text from the document. Please ensure the file is a valid PDF, DOCX, PPTX, or TXT." });
      }

      if (!text || !text.trim()) {
        return res.status(422).json({ error: "No text content could be extracted from this document." });
      }

      chunks = chunkText(text);
      if (chunks.length === 0) {
        return res.status(422).json({ error: "Document text is too short or empty after processing." });
      }

      // Cache for future sessions
      cacheDocument(resource.id, text, chunks);
    }

    // Tail of the last session on this document — lets the tutor pick up
    // where they left off instead of starting cold.
    let previousRecap = "";
    try {
      const prev = await prisma.voiceSession.findFirst({
        where: { userId: req.user.sub, resourceId: resource.id, status: "ended" },
        orderBy: { createdAt: "desc" },
        select: { transcript: true },
      });
      if (prev?.transcript) {
        const turns = typeof prev.transcript === "string" ? JSON.parse(prev.transcript) : prev.transcript;
        if (Array.isArray(turns) && turns.length) {
          previousRecap = turns.slice(-14)
            .map((t) => `${t.role === "tutor" ? "Tutor" : "Student"}: ${t.text}`)
            .join("\n")
            .slice(-2500);
        }
      }
    } catch (e) {
      console.warn("Failed to load previous voice session recap:", e.message);
    }

    const systemPrompt = buildVoiceSystemPrompt(chunks, resource.title, pageText, {
      level: sessionLevel,
      previousRecap,
      allowPageNav: allowPageNav === true,
    });
    const concepts = extractConceptsFromChunks(chunks);

    const sessionRecord = await prisma.voiceSession.create({
      data: {
        userId: req.user.sub,
        resourceId: resource.id,
        mode: "tutor",
        status: "active",
        transcript: JSON.stringify([]),
      },
    });

    const sessionId = sessionRecord.id;

    const session = {
      id: sessionId,
      userId: req.user.sub,
      resourceId: resource.id,
      mode: "tutor",
      geminiWs: null,
      clientWs: null,
      startTime: Date.now(),
      lastActivityAt: Date.now(),
      transcript: [],
      timeoutId: null,
      setupComplete: false,
      systemPrompt,
      chunks,
      voiceName,
      resourceTitle: resource.title,
      currentPage: currentPage || null,
      resumeHandle: null,
      resumeAttempts: 0,
      geminiSetupError: null,
      droppedAudioChunks: 0,
      closed: false,
      kickoffSent: false,
      allowPageNav: allowPageNav === true,
      level: sessionLevel,
    };
    activeSessions.set(sessionId, session);
    connectGeminiSession(session);

    const waitForSetup = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        session.geminiSetupError = session.geminiSetupError || new Error("Gemini setup timeout (15s) — check GEMINI_API_KEY and model availability");
        reject(session.geminiSetupError);
      }, 15000);
      const checkInterval = setInterval(() => {
        if (session.setupComplete) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
        if (session.geminiSetupError) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          reject(session.geminiSetupError);
        }
      }, 100);
    });

    try {
      await waitForSetup;
    } catch (setupErr) {
      console.error(`Voice session ${sessionId} setup failed:`, setupErr.message);
      deleteActiveSession(sessionId);
      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: { status: "error", endedAt: new Date() },
      });
      return res.status(502).json({ error: `Failed to establish voice session with Gemini: ${setupErr.message}` });
    }

    logSecurityEvent(req.user.sub, "voice_session_start", { sessionId, resourceId, mode: "tutor" }, req);

    const ticket = generateTicket(sessionId, req.user.sub);

    return res.json({
      sessionId,
      ticket,
      mode: "tutor",
      resourceTitle: resource.title,
      materials: {
        title: resource.title,
        chunkCount: chunks.length,
        totalLength: text.length,
        chunks: chunks.map((c, i) => ({ index: i, preview: c.slice(0, 200), length: c.length })),
      },
      concepts,
    });
  } catch (error) {
    console.error("Voice session start error:", error);
    return res.status(500).json({ error: "Failed to start voice session" });
  }
});

// POST /api/voice-session/:id/end
router.post("/:id/end", requireAuth, async (req, res) => {
  const { id } = req.params;
  const session = activeSessions.get(id);

  if (!session || session.userId !== req.user.sub) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
    try {
      session.clientWs.send(JSON.stringify({ type: "session_ended", message: "Session ended by user" }));
      session.clientWs.close();
    } catch {}
  }

  await endSessionInDB(id, "ended", session.transcript);
  deleteActiveSession(id);

  logSecurityEvent(req.user.sub, "voice_session_end", { sessionId: id }, req);

  return res.json({ ok: true, durationSec: Math.round((Date.now() - session.startTime) / 1000) });
});

// POST /api/voice-session/:id/ticket — issue a fresh single-use WS ticket for reconnection
router.post("/:id/ticket", requireAuth, async (req, res) => {
  const { id } = req.params;
  const session = activeSessions.get(id);

  if (!session || session.userId !== req.user.sub) {
    return res.status(404).json({ error: "Session not found" });
  }

  const ticket = generateTicket(id, req.user.sub);
  return res.json({ ticket, expiresAt: Date.now() + TICKET_TTL_MS });
});

// GET /api/voice-session/:id/status
router.get("/:id/status", requireAuth, async (req, res) => {
  const { id } = req.params;
  const session = activeSessions.get(id);

  if (!session || session.userId !== req.user.sub) {
    return res.json({ active: false });
  }

  return res.json({
    active: true,
    mode: session.mode,
    elapsedSec: Math.round((Date.now() - session.startTime) / 1000),
    remainingSec: Math.max(0, SESSION_TIMEOUT_MS / 1000 - Math.round((Date.now() - session.startTime) / 1000)),
    setupComplete: session.setupComplete,
  });
});

// GET /api/voice-session/history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.voiceSession.findMany({
      where: { userId: req.user.sub },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true, mode: true, status: true, durationSec: true,
        startedAt: true, endedAt: true,
        resource: { select: { id: true, title: true } },
      },
    });
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch session history" });
  }
});

// ── Voice previews ──────────────────────────────────────────────────────────
const PREVIEW_TEXT = "Hey! I'm your study tutor — ready to dive into your material together?";
const previewCache = new Map(); // voiceName -> WAV Buffer

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bits / 8), 28);
  header.writeUInt16LE(channels * (bits / 8), 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// GET /api/voice-session/voice-preview/:voice — short TTS sample of a Gemini voice
router.get("/voice-preview/:voice", requireAuth, async (req, res) => {
  const voice = String(req.params.voice || "");
  if (!/^[A-Za-z]+$/.test(voice) || voice.length > 30) {
    return res.status(400).json({ error: "Invalid voice name" });
  }

  const cached = previewCache.get(voice);
  if (cached) {
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(cached);
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "Preview not configured" });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say this in a warm, upbeat tone: "${PREVIEW_TEXT}"` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`Voice preview TTS failed (${resp.status}):`, body.slice(0, 200));
      return res.status(502).json({ error: "Preview generation failed" });
    }

    const data = await resp.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return res.status(502).json({ error: "No audio in TTS response" });

    const wav = pcmToWav(Buffer.from(b64, "base64"));
    previewCache.set(voice, wav);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(wav);
  } catch (err) {
    console.error("Voice preview error:", err.message);
    return res.status(500).json({ error: "Preview failed" });
  }
});

export default router;
