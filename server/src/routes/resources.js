import express from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import { uploadFile, deleteFile } from "../lib/supabaseStorage.js";

const router = express.Router();

// Memory storage — file buffer sent directly to Supabase, never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".json"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, TXT, and JSON files are allowed (max 20MB)"));
    }
  },
});

// Helper: Generate unique 6-char share token
async function generateShareToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  let unique = false;

  while (!unique) {
    token = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");

    const existing = await prisma.resource.findUnique({
      where: { shareToken: token },
    });
    if (!existing) unique = true;
  }
  return token;
}

// GET /api/resources - List resources with filters
router.get("/", async (req, res) => {
  try {
    const { search, type, subject } = req.query;

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { subject: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(type && type !== "all" && { contentType: type }),
      ...(subject && subject !== "all" && { subject }),
    };

    const resources = await prisma.resource.findMany({
      where,
      include: {
        uploader: { select: { id: true, username: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// GET /api/resources/teacher/my - Get teacher's own resources (MUST be before /:token)
router.get("/teacher/my", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { uploadedBy: req.user.sub },
      include: { uploader: { select: { id: true, username: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(resources);
  } catch (error) {
    console.error("Error fetching teacher resources:", error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
});

// GET /api/resources/proxy-pdf?url=... - Proxy PDF file to avoid CORS issues with pdf.js
router.get("/proxy-pdf", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Only allow proxying from R2 public URL or known storage domains
    const allowedPrefixes = [
      process.env.R2_PUBLIC_URL,
      "https://pub-",
      "https://r2.cloudflarestorage.com",
    ].filter(Boolean);

    const isAllowed = allowedPrefixes.some((p) => url.startsWith(p));
    if (!isAllowed) {
      return res.status(403).json({ error: "URL domain not allowed" });
    }

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch PDF from storage" });
    }

    const contentType = response.headers.get("content-type") || "application/pdf";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(buffer);
  } catch (error) {
    console.error("PDF proxy error:", error);
    res.status(500).json({ error: "Failed to proxy PDF" });
  }
});

// GET /api/resources/:token - Get resource by share token
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { shareToken: token },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.json(resource);
  } catch (error) {
    console.error("Error fetching resource by token:", error);
    res.status(500).json({ error: "Failed to fetch resource" });
  }
});

// POST /api/resources - Create new resource (teacher only)
router.post("/", requireAuth, requireRole("TEACHER", "LECTURER"), upload.single("file"), async (req, res) => {
  try {
    const { title, subject, contentType, description, isPremium, mcqData } = req.body;

    if (!title || !subject || !contentType) {
      return res.status(400).json({ error: "Title, subject, and content type are required" });
    }

    // For MCQ type, mcqData is required instead of file
    if (contentType === "mcq") {
      if (!mcqData) {
        return res.status(400).json({ error: "MCQ data is required for MCQ type" });
      }
      const parsedMcqData = JSON.parse(mcqData);
      if (!Array.isArray(parsedMcqData) || parsedMcqData.length === 0) {
        return res.status(400).json({ error: "MCQ data must be a non-empty array" });
      }
    } else {
      // For non-MCQ types, file is required
      if (!req.file) {
        return res.status(400).json({ error: "File is required for this content type" });
      }
    }

    const shareToken = await generateShareToken();

    // Upload file to Supabase Storage (for non-MCQ types)
    let fileUrl = null;
    let storagePath = null;
    let fileName = null;
    let mimeType = null;

    if (req.file) {
      const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      fileUrl = result.publicUrl;
      storagePath = result.storagePath;
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        subject,
        contentType,
        fileUrl,
        storagePath,
        fileName,
        mimeType,
        description: description || null,
        uploadedBy: req.user.sub,
        isPremium: isPremium === "true",
        shareToken,
        mcqData: contentType === "mcq" ? JSON.parse(mcqData) : null,
      },
      include: { uploader: { select: { id: true, username: true, role: true } } },
    });

    res.status(201).json(resource);
  } catch (error) {
    console.error("Error creating resource:", error);
    res.status(500).json({ error: error.message || "Failed to create resource" });
  }
});

// POST /api/resources/:token/view - Log view, enforce free trial, return allowed status
router.post("/:token/view", async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    const resource = await prisma.resource.findUnique({ where: { shareToken: token } });
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    // Increment resource view count (always)
    await prisma.resource.update({
      where: { id: resource.id },
      data: { viewCount: { increment: 1 } },
    });

    // Log view record (ignore duplicates)
    prisma.resourceView.create({ data: { resourceId: resource.id, userId: userId || null } }).catch(() => {});

    // Authenticated user — check and enforce free trial
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActivated: true, freeTrialViews: true, freeTrialLimit: true },
      });

      if (user) {
        // Activated/paid users: unlimited access
        if (user.isActivated) {
          return res.json({ allowed: true, unlimited: true, freeTrialViews: user.freeTrialViews, freeTrialLimit: user.freeTrialLimit });
        }
        // Over free trial limit
        if (user.freeTrialViews >= user.freeTrialLimit) {
          return res.json({ allowed: false, freeTrialViews: user.freeTrialViews, freeTrialLimit: user.freeTrialLimit });
        }
        // Within limit — increment
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { freeTrialViews: { increment: 1 } },
          select: { freeTrialViews: true, freeTrialLimit: true },
        });
        return res.json({ allowed: true, freeTrialViews: updated.freeTrialViews, freeTrialLimit: updated.freeTrialLimit });
      }
    }

    // Guest user — no access
    return res.json({ allowed: false, freeTrialViews: 0, freeTrialLimit: 3 });
  } catch (error) {
    console.error("Error logging view:", error);
    res.status(500).json({ error: "Failed to log view" });
  }
});

// PATCH /api/resources/:id - Update resource (uploader only)
router.patch("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, isPremium } = req.body;

    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (resource.uploadedBy !== req.user.sub) {
      return res.status(403).json({ error: "You can only edit your own resources" });
    }

    const updated = await prisma.resource.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(subject && { subject }),
        ...(description !== undefined && { description }),
        ...(isPremium !== undefined && { isPremium: isPremium === "true" }),
      },
      include: {
        uploader: {
          select: { id: true, username: true, role: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating resource:", error);
    res.status(500).json({ error: "Failed to update resource" });
  }
});

// DELETE /api/resources/:id - Delete resource (uploader only)
router.delete("/:id", requireAuth, requireRole("TEACHER", "LECTURER"), async (req, res) => {
  try {
    const { id } = req.params;

    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (resource.uploadedBy !== req.user.sub) {
      return res.status(403).json({ error: "You can only delete your own resources" });
    }

    // Delete file from Supabase Storage
    if (resource.storagePath) {
      await deleteFile(resource.storagePath);
    }

    await prisma.resource.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting resource:", error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
});

export default router;
