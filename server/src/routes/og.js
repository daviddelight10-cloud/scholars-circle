import express from "express";
import { prisma } from "../db.js";

const router = express.Router();

// Crawler-facing Open Graph pages. Vercel rewrites /resources/:token and
// /folders/:token here when the request's User-Agent is a link-unfurl bot
// (WhatsApp, Telegram, Twitter, Slack, …), so shared links preview the actual
// material instead of the static site tags in index.html. Real browsers still
// get the SPA. Humans who hit this URL are meta-refreshed to the app page.

const SITE_URL = "https://scholarscircle.com.ng";
const SITE_NAME = "Scholar's Circle";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const GENERIC = {
  title: `${SITE_NAME} — Turn lecture PDFs into practice questions`,
  description:
    "Circle anything in your notes to ask AI. Timed exam sims. Live quiz rooms with friends. Free forever.",
};

function ogPage({ title, description, canonical, image = OG_IMAGE }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="canonical" href="${esc(canonical)}" />
<meta name="robots" content="noindex" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${esc(canonical)}" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(canonical)}" />
</head>
<body>
<p>Opening <a href="${esc(canonical)}">${esc(title)}</a> on ${esc(SITE_NAME)}…</p>
</body>
</html>`;
}

function send(res, opts) {
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
  res.send(ogPage(opts));
}

const TYPE_LABEL = {
  pdf: "Material", doc: "Document", docx: "Document", pptx: "Slides",
  txt: "Notes", note: "Notes", image: "Image", tutorial_question: "Tutorial",
  mcq: "Practice questions", exam: "Exam simulation", flashcard_deck: "Flashcards",
};

// GET /og/resource/:token — unfurl page for a shared material
router.get("/resource/:token", async (req, res) => {
  const canonical = `${SITE_URL}/resources/${encodeURIComponent(req.params.token)}`;
  try {
    const r = await prisma.resource.findUnique({
      where: { shareToken: req.params.token },
      include: {
        uploader: { select: { username: true, fullName: true } },
        university: { select: { name: true } },
        derivedResources: {
          select: { contentType: true, linkShared: true, mcqData: true },
        },
        sourceResource: {
          select: {
            title: true, subject: true, courseCode: true, linkShared: true,
            uploadedBy: true,
            derivedResources: {
              select: { contentType: true, linkShared: true, mcqData: true },
            },
            uploader: { select: { username: true, fullName: true } },
            university: { select: { name: true } },
          },
        },
      },
    });

    // Link off / rejected / missing → generic site card, never leak metadata.
    if (!r || r.linkShared === false || r.status === "rejected") {
      return send(res, { ...GENERIC, canonical });
    }

    // A directly-shared variant unfurls as its source material.
    const isVariant = !!r.sourceResource && r.sourceResource.linkShared !== false;
    const shown = isVariant ? r.sourceResource : r;
    const derived = (shown.derivedResources || []).filter((d) => d.linkShared !== false);
    const questionCount = derived.reduce(
      (n, d) => n + (d.contentType === "mcq" && Array.isArray(d.mcqData) ? d.mcqData.length : 0),
      0
    );
    const uploader = isVariant ? r.sourceResource.uploader : r.uploader;
    const uni = (isVariant ? r.sourceResource.university : r.university)?.name;

    const title = `${shown.title} — shared on ${SITE_NAME}`;
    const description = [
      TYPE_LABEL[shown.contentType] || "Material",
      shown.subject || shown.courseCode,
      questionCount > 0 ? `${questionCount} practice questions` : null,
      uploader?.username ? `by @${uploader.username}` : uploader?.fullName ? `by ${uploader.fullName}` : null,
      uni,
      "Tap to study it.",
    ].filter(Boolean).join(" · ");

    return send(res, { title, description, canonical });
  } catch (e) {
    console.error("OG resource error:", e);
    return send(res, { ...GENERIC, canonical });
  }
});

// GET /og/folder/:token — unfurl page for a shared space
router.get("/folder/:token", async (req, res) => {
  const canonical = `${SITE_URL}/folders/${encodeURIComponent(req.params.token)}`;
  try {
    const f = await prisma.folder.findUnique({
      where: { shareToken: req.params.token },
      include: {
        owner: { select: { username: true, fullName: true } },
        university: { select: { name: true } },
        _count: { select: { resources: true } },
      },
    });

    if (!f || f.visibility !== "link" || f.deletedAt) {
      return send(res, { ...GENERIC, canonical });
    }

    const title = `${f.name} — a study space on ${SITE_NAME}`;
    const description = [
      f._count?.resources ? `${f._count.resources} files` : null,
      f.courseCode,
      [f.level, f.semester].filter(Boolean).join(" "),
      f.owner?.username ? `shared by @${f.owner.username}` : null,
      f.university?.name,
      "Open the space to start practicing.",
    ].filter(Boolean).join(" · ");

    return send(res, { title, description, canonical });
  } catch (e) {
    console.error("OG folder error:", e);
    return send(res, { ...GENERIC, canonical });
  }
});

export default router;
