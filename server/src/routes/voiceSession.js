import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { logSecurityEvent } from "../lib/logger.js";
import {
  extractTextFromFile,
  chunkText,
  buildVoiceSystemPrompt,
  extractConceptsFromChunks,
  getGeminiLiveWsUrl,
  getLiveModel,
} from "../lib/voiceGrounding.js";
import { WebSocket } from "ws";

const router = Router();

const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

const activeSessions = new Map();

export function getActiveSession(sessionId) {
  return activeSessions.get(sessionId);
}

export function deleteActiveSession(sessionId) {
  const s = activeSessions.get(sessionId);
  if (!s) return;
  if (s.timeoutId) clearTimeout(s.timeoutId);
  if (s.geminiWs && s.geminiWs.readyState === WebSocket.OPEN) {
    try { s.geminiWs.close(); } catch {}
  }
  activeSessions.delete(sessionId);
}

export function getActiveSessions() {
  return activeSessions;
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

// POST /api/voice-session/start
router.post("/start", requireAuth, async (req, res) => {
  try {
    const { resourceId, mode = "teach" } = req.body || {};
    if (!resourceId) {
      return res.status(400).json({ error: "resourceId is required" });
    }

    const validModes = ["teach", "quiz", "discuss"];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: "mode must be one of: teach, quiz, discuss" });
    }

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

    let text = "";
    try {
      text = await extractTextFromFile(resource.fileUrl, resource.mimeType, resource.fileName);
    } catch (extractErr) {
      console.error("Text extraction failed:", extractErr.message);
      return res.status(422).json({ error: "Failed to extract text from the document. Please ensure the file is a valid PDF, DOCX, PPTX, or TXT." });
    }

    if (!text || !text.trim()) {
      return res.status(422).json({ error: "No text content could be extracted from this document." });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(422).json({ error: "Document text is too short or empty after processing." });
    }

    const systemPrompt = buildVoiceSystemPrompt(chunks, mode, resource.title);
    const concepts = extractConceptsFromChunks(chunks);

    const geminiWsUrl = getGeminiLiveWsUrl();
    const model = getLiveModel();
    console.log(`Connecting to Gemini Live: model=${model}, url=${geminiWsUrl.replace(/key=[^&]+/, 'key=***')}`);

    const geminiWs = new WebSocket(geminiWsUrl);
    let geminiSetupError = null;

    const sessionRecord = await prisma.voiceSession.create({
      data: {
        userId: req.user.sub,
        resourceId: resource.id,
        mode,
        status: "active",
        transcript: JSON.stringify([]),
      },
    });

    const sessionId = sessionRecord.id;

    const session = {
      id: sessionId,
      userId: req.user.sub,
      resourceId: resource.id,
      mode,
      geminiWs,
      clientWs: null,
      startTime: Date.now(),
      transcript: [],
      timeoutId: null,
      setupComplete: false,
      systemPrompt,
      resourceTitle: resource.title,
    };
    activeSessions.set(sessionId, session);

    geminiWs.on("open", () => {
      console.log(`Gemini Live WebSocket connected for session ${sessionId}`);
      const setupMessage = {
        setup: {
          model: `models/${model}`,
          responseModalities: ["AUDIO"],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };
      geminiWs.send(JSON.stringify(setupMessage));
    });

    geminiWs.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.warn(`Gemini sent non-JSON message for session ${sessionId}:`, data.toString().slice(0, 200));
        return;
      }

      // Log every message for debugging
      console.log(`Gemini message for session ${sessionId}:`, JSON.stringify(msg).slice(0, 300));

      // Check for error in Gemini response
      if (msg.error) {
        console.error(`Gemini API error for session ${sessionId}:`, JSON.stringify(msg.error));
        geminiSetupError = new Error(`Gemini API error: ${msg.error.message || JSON.stringify(msg.error)}`);
        return;
      }

      if (msg.setupComplete) {
        session.setupComplete = true;
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
          session.transcript.push({
            role: "user",
            text: sc.inputTranscription.text,
            ts: Date.now(),
          });
        }
        if (sc.outputTranscription) {
          session.transcript.push({
            role: "tutor",
            text: sc.outputTranscription.text,
            ts: Date.now(),
          });
        }

        if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
          session.clientWs.send(JSON.stringify({
            type: "server_content",
            data: sc,
          }));
        }
        resetSessionTimeout(sessionId);
      }

      if (msg.toolCall) {
        if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
          session.clientWs.send(JSON.stringify({
            type: "tool_call",
            data: msg.toolCall,
          }));
        }
      }
    });

    geminiWs.on("error", (err) => {
      console.error(`Gemini Live WebSocket error for session ${sessionId}:`, err.message);
      geminiSetupError = err;
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({
          type: "error",
          message: "Voice tutor connection error. Please try again.",
        }));
      }
      logSecurityEvent(req.user.sub, "voice_session_error", { sessionId, error: err.message }, req);
    });

    geminiWs.on("close", (code, reason) => {
      console.log(`Gemini Live WebSocket closed for session ${sessionId}. Code: ${code}, Reason: ${reason?.toString() || 'none'}`);
      if (!session.setupComplete && !geminiSetupError) {
        geminiSetupError = new Error(`Gemini WebSocket closed early (code: ${code})`);
      }
      if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({ type: "session_ended", message: "Gemini session closed" }));
        session.clientWs.close();
      }
      endSessionInDB(sessionId, "ended", session.transcript);
      deleteActiveSession(sessionId);
    });

    const waitForSetup = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        geminiSetupError = geminiSetupError || new Error("Gemini setup timeout (15s) — check GEMINI_API_KEY and model availability");
        reject(geminiSetupError);
      }, 15000);
      const checkInterval = setInterval(() => {
        if (session.setupComplete) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve();
        }
        if (geminiSetupError) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          reject(geminiSetupError);
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

    logSecurityEvent(req.user.sub, "voice_session_start", { sessionId, resourceId, mode }, req);

    return res.json({
      sessionId,
      mode,
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

export default router;
