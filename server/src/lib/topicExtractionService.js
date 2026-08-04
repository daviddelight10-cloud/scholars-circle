/**
 * Server-side topic extraction & matching service.
 *
 * Owns all writes to curriculum_topics and document_topic_matches,
 * and all verification-threshold enforcement. This must be server-side
 * because curriculum_topics is a shared table — a student could tamper
 * with client-side requests to force topics into "verified" status.
 *
 * Calls the same AI proxy (OpenRouter / Gemini) the client already uses
 * for inference, but keeps API keys server-side and computes confidence
 * scores authoritatively.
 */

import { prisma } from "../db.js";
import { logError, logInfo } from "./logger.js";

const AI_PROVIDER = "openrouter";
const AI_MODEL = "google/gemini-2.5-flash";
const CONFIDENCE_THRESHOLD = 0.5;
const VERIFICATION_MIN_STUDENTS = 5;
const VERIFICATION_MIN_AVG_CONFIDENCE = 0.7;

/**
 * Call the AI provider server-side (OpenRouter / Gemini).
 * @param {string} prompt
 * @returns {Promise<string>} Raw text response
 */
async function callAIServerSide(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured on the server");
  }

  const apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
    "X-Title": "Scholar's Circle",
  };
  const requestBody = {
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 16384,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[topicExtractionService] AI Provider Error:`, errorText);
      throw new Error(`AI provider error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return text;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("AI request timed out after 30 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extract JSON from a raw AI text response.
 * Strips markdown code fences and finds the first valid JSON object/array.
 * @param {string} raw
 * @param {"object"|"array"} type
 * @returns {object|array|null}
 */
function extractJSON(raw, type = "object") {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (type === "array") return Array.isArray(parsed) ? parsed : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {}

  // Try to find JSON within the text
  const startChar = type === "array" ? "[" : "{";
  const endChar = type === "array" ? "]" : "}";
  const startIdx = cleaned.indexOf(startChar);
  const endIdx = cleaned.lastIndexOf(endChar);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonStr = cleaned.slice(startIdx, endIdx + 1);
    try {
      return JSON.parse(jsonStr);
    } catch {}
  }

  return null;
}

/**
 * Build an outline-extraction prompt for generating a curriculum skeleton
 * from an uploaded course outline / syllabus document.
 */
function buildOutlineExtractionPrompt(text, courseCode) {
  return `You are an expert curriculum designer. Extract the complete topic skeleton from this course outline/syllabus.

COURSE CODE: ${courseCode || "Unknown"}

OUTLINE TEXT:
"""
${text.slice(0, 8000)}
"""

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "courseCode": "${courseCode || ""}",
  "topics": [
    {
      "title": "Topic name (concise, 2-6 words)",
      "description": "1-sentence description of what this topic covers",
      "displayOrder": 1,
      "prerequisiteTitles": ["Title of prerequisite topic", ...],
      "subtopics": ["Sub-topic 1", "Sub-topic 2", ...]
    }
  ]
}

RULES:
1. Extract ALL topics/modules/units from the outline in their original order.
2. Set displayOrder starting at 1, incrementing sequentially.
3. For prerequisiteTitles, list titles of topics that must be understood BEFORE this topic. Use exact titles from the list. Leave empty array if none.
4. Keep topic titles short (2-6 words).
5. Descriptions should be 1 sentence, under 20 words.
6. For each topic, extract 2-6 subtopics that break it down into learnable units.
7. Return ONLY the JSON object.`;
}

/**
 * Build a generic skeleton generation prompt for when only a course name is provided.
 */
function buildGenericSkeletonPrompt(courseName, courseCode) {
  return `You are an expert curriculum designer. Generate a comprehensive topic skeleton for the course: "${courseName}"${courseCode ? ` (code: ${courseCode})` : ""}.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "courseCode": "${courseCode || courseName}",
  "topics": [
    {
      "title": "Topic name (concise, 2-6 words)",
      "description": "1-sentence description of what this topic covers",
      "displayOrder": 1,
      "prerequisiteTitles": ["Title of prerequisite topic", ...],
      "subtopics": ["Sub-topic 1", "Sub-topic 2", ...]
    }
  ]
}

RULES:
1. Generate 8-20 topics that represent a logical learning progression from fundamentals to advanced.
2. Set displayOrder starting at 1, incrementing sequentially.
3. For prerequisiteTitles, list titles of topics that must be understood BEFORE this topic. Use exact titles from the list. Leave empty array if none.
4. Keep topic titles short (2-6 words).
5. Descriptions should be 1 sentence, under 20 words.
6. For each topic, generate 2-6 subtopics that break it down into learnable units.
7. Return ONLY the JSON object.`;
}

/**
 * Build a prompt for matching a document to curriculum topics.
 */
function buildMatchingPrompt(resourceTitle, resourceDescription, resourceType, topics) {
  const topicList = topics
    .map((t) => `- ID: ${t.id} | ${t.title}${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  return `You are an expert at matching study materials to curriculum topics.

DOCUMENT:
- Title: ${resourceTitle}
- Type: ${resourceType}
- Description/Content: ${(resourceDescription || "No description available").slice(0, 3000)}

CURRICULUM TOPICS (use the exact ID value from each line):
${topicList}

Match this document to the most relevant curriculum topics (1-3 topics max).

Return ONLY a valid JSON array (no markdown):
[
  { "topicId": "<exact-id-from-list-above>", "confidence": 0.95 }
]

RULES:
1. Only match to topics that are genuinely relevant to the document content.
2. Confidence should be 0.0-1.0, where 1.0 means perfect match.
3. Only include matches with confidence >= 0.5.
4. Return at most 3 matches.
5. Use the exact topicId (the ID value) from the list above.
6. If no topics are relevant, return an empty array [].`;
}

/**
 * Extract a curriculum skeleton from an uploaded course outline or generate
 * one from a course name. Saves topics to the database server-side.
 *
 * @param {object} params
 * @param {string} params.courseCode - The course code
 * @param {string} [params.outlineText] - Extracted text from an uploaded outline
 * @param {string} [params.courseName] - Course name (used if no outline)
 * @param {string} params.userId - The requesting user's ID
 * @returns {Promise<{topics: Array, source: string}>}
 */
export async function extractSkeletonFromOutline({ courseCode, outlineText, courseName, userId }) {
  const effectiveCourseCode = (courseCode || courseName || "").trim();
  if (!effectiveCourseCode) {
    throw new Error("Course code or name is required");
  }

  const hasOutline = outlineText && outlineText.trim().length > 50;
  const source = hasOutline ? "outline" : "ai_inferred";

  logInfo(`[topicExtractionService] Generating skeleton for ${effectiveCourseCode}`, {
    source,
    hasOutline,
    userId,
  });

  const prompt = hasOutline
    ? buildOutlineExtractionPrompt(outlineText, effectiveCourseCode)
    : buildGenericSkeletonPrompt(courseName || effectiveCourseCode, effectiveCourseCode);

  let raw = await callAIServerSide(prompt);
  let parsed = extractJSON(raw, "object");

  // Retry once if parsing failed (AI sometimes truncates or wraps in extra text)
  if (!parsed || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
    logInfo(`[topicExtractionService] First AI response unparseable, retrying with shorter input…`);
    const shorterPrompt = hasOutline
      ? buildOutlineExtractionPrompt(outlineText.slice(0, 4000), effectiveCourseCode)
      : prompt;
    raw = await callAIServerSide(shorterPrompt);
    parsed = extractJSON(raw, "object");
  }

  if (!parsed || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
    throw new Error("AI couldn't generate a valid topic skeleton. Try again.");
  }

  const topics = parsed.topics
    .filter((t) => t && t.title && t.title.trim())
    .map((t, idx) => ({
      title: t.title.trim(),
      description: t.description || null,
      displayOrder: t.displayOrder || idx + 1,
      prerequisiteTitles: Array.isArray(t.prerequisiteTitles) ? t.prerequisiteTitles : [],
      subtopics: Array.isArray(t.subtopics) ? t.subtopics.map((s) => String(s).trim()).filter(Boolean) : [],
    }));

  if (topics.length === 0) {
    throw new Error("No topics were extracted. Try with a different outline or course name.");
  }

  const verified = source === "outline";
  const status = verified ? "verified" : "unverified";

  // Delete existing topics for this courseCode so regeneration replaces instead of appending
  const existingTopics = await prisma.curriculumTopic.findMany({
    where: { courseCode: effectiveCourseCode },
    select: { id: true },
  });
  if (existingTopics.length > 0) {
    const existingTopicIds = existingTopics.map((t) => t.id);
    await prisma.documentTopicMatch.deleteMany({
      where: { topicId: { in: existingTopicIds } },
    });
    await prisma.curriculumTopic.deleteMany({
      where: { courseCode: effectiveCourseCode },
    });
    logInfo(`[topicExtractionService] Deleted ${existingTopics.length} old topics for ${effectiveCourseCode} (regeneration)`);
  }

  const created = [];

  for (const t of topics) {
    const topic = await prisma.curriculumTopic.upsert({
      where: {
        courseCode_title: { courseCode: effectiveCourseCode, title: t.title },
      },
      update: {
        description: t.description,
        displayOrder: t.displayOrder,
        subtopics: t.subtopics,
        ...(verified && { verified: true, source: "outline", status: "verified" }),
      },
      create: {
        courseCode: effectiveCourseCode,
        title: t.title,
        description: t.description,
        displayOrder: t.displayOrder,
        subtopics: t.subtopics,
        source,
        verified,
        status,
        createdBy: userId,
      },
    });
    created.push(topic);
  }

  // Resolve prerequisite titles to IDs
  const titleToId = new Map(created.map((t) => [t.title, t.id]));
  for (const t of topics) {
    if (!t.prerequisiteTitles || t.prerequisiteTitles.length === 0) continue;
    const topicId = titleToId.get(t.title);
    if (!topicId) continue;
    const prereqIds = t.prerequisiteTitles.map((pt) => titleToId.get(pt.trim())).filter(Boolean);
    if (prereqIds.length > 0) {
      await prisma.curriculumTopic.update({
        where: { id: topicId },
        data: { prerequisiteIds: prereqIds },
      });
    }
  }

  // Re-fetch with prerequisites resolved
  const finalTopics = await prisma.curriculumTopic.findMany({
    where: { courseCode: effectiveCourseCode },
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });

  logInfo(`[topicExtractionService] Saved ${finalTopics.length} topics for ${effectiveCourseCode}`);

  return { topics: finalTopics, source };
}

/**
 * Match a single document to curriculum topics using AI.
 * Writes matches to document_topic_matches server-side.
 *
 * @param {object} resource - { id, title, description, contentType, subject }
 * @param {string} courseCode
 * @param {string} userId
 * @returns {Promise<number>} Number of matches created
 */
export async function matchDocumentToSkeleton(resource, courseCode, userId) {
  const topics = await prisma.curriculumTopic.findMany({
    where: { courseCode },
    select: { id: true, title: true, description: true },
  });

  if (topics.length === 0) {
    return 0;
  }

  const prompt = buildMatchingPrompt(
    resource.title,
    resource.description,
    resource.contentType,
    topics
  );

  const raw = await callAIServerSide(prompt);
  let matches;
  try {
    matches = extractJSON(raw, "array");
  } catch {
    return 0;
  }

  if (!Array.isArray(matches)) return 0;

  const validMatches = matches
    .filter((m) => m && typeof m.confidence === "number" && m.confidence >= CONFIDENCE_THRESHOLD)
    .slice(0, 3);

  let matchCount = 0;

  for (const match of validMatches) {
    // Try to find the topic by ID first, then by title as fallback
    let topic = topics.find((t) => t.id === match.topicId);
    if (!topic && match.topicId) {
      // AI might have returned a title or index instead of UUID
      const titleLower = String(match.topicId).toLowerCase().trim();
      topic = topics.find((t) => t.title.toLowerCase().trim() === titleLower);
    }
    if (!topic) continue;

    await prisma.documentTopicMatch.upsert({
      where: {
        userId_resourceId_topicId: {
          userId,
          resourceId: resource.id,
          topicId: topic.id,
        },
      },
      update: {
        confidence: match.confidence,
        matchSource: "ai",
      },
      create: {
        userId,
        resourceId: resource.id,
        topicId: topic.id,
        confidence: match.confidence,
        matchSource: "ai",
      },
    });
    matchCount++;

    // Run verification check after each match insert
    await checkVerificationThreshold(topic.id);
  }

  // If no matches above threshold, propose a new topic (ai_added)
  if (validMatches.length === 0) {
    await proposeNewTopicFromDocument(resource, courseCode, userId);
  }

  return matchCount;
}

/**
 * When a document doesn't match any existing topic above threshold,
 * propose a new AI-inferred topic node for it.
 *
 * @param {object} resource
 * @param {string} courseCode
 * @param {string} userId
 */
async function proposeNewTopicFromDocument(resource, courseCode, userId) {
  try {
    const prompt = `You are an expert curriculum designer. Based on this study material, propose a single topic that it covers.

DOCUMENT:
- Title: ${resource.title}
- Type: ${resource.contentType}
- Description: ${(resource.description || "No description").slice(0, 2000)}

Return ONLY a valid JSON object:
{
  "title": "Topic name (2-6 words)",
  "description": "1-sentence description",
  "subtopics": ["subtopic 1", "subtopic 2"]
}

RULES:
1. The title should be a concise curriculum topic name.
2. Generate 2-4 subtopics.
3. Return ONLY the JSON object.`;

    const raw = await callAIServerSide(prompt);
    const parsed = extractJSON(raw, "object");

    if (!parsed || !parsed.title) return;

    // Check if a similar topic already exists
    const existing = await prisma.curriculumTopic.findFirst({
      where: {
        courseCode,
        title: { contains: parsed.title.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      // Link to the existing similar topic instead of creating a duplicate
      await prisma.documentTopicMatch.upsert({
        where: {
          userId_resourceId_topicId: {
            userId,
            resourceId: resource.id,
            topicId: existing.id,
          },
        },
        update: { confidence: 0.4, matchSource: "ai" },
        create: {
          userId,
          resourceId: resource.id,
          topicId: existing.id,
          confidence: 0.4,
          matchSource: "ai",
        },
      });
      return;
    }

    // Get the max displayOrder for this course
    const maxOrderTopic = await prisma.curriculumTopic.findFirst({
      where: { courseCode },
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    const nextOrder = (maxOrderTopic?.displayOrder || 0) + 1;

    const newTopic = await prisma.curriculumTopic.create({
      data: {
        courseCode,
        title: parsed.title.trim(),
        description: parsed.description || null,
        displayOrder: nextOrder,
        subtopics: Array.isArray(parsed.subtopics)
          ? parsed.subtopics.map((s) => String(s).trim()).filter(Boolean)
          : [],
        source: "ai_added",
        verified: false,
        status: "unverified",
        createdBy: userId,
      },
    });

    // Link the document to the new topic
    await prisma.documentTopicMatch.create({
      data: {
        userId,
        resourceId: resource.id,
        topicId: newTopic.id,
        confidence: 0.5,
        matchSource: "ai",
      },
    });

    logInfo(`[topicExtractionService] Proposed new topic "${newTopic.title}" for ${courseCode}`, {
      resourceId: resource.id,
    });
  } catch (err) {
    logError(err, { context: "proposeNewTopicFromDocument", courseCode, resourceId: resource.id });
  }
}

/**
 * Check if a topic meets the verification threshold after a new match is inserted.
 * Skips check entirely if source = 'outline'.
 *
 * Threshold: 5+ unique corroborating students, avg match confidence > 0.7, 0 disputes.
 *
 * @param {string} topicId
 */
export async function checkVerificationThreshold(topicId) {
  const topic = await prisma.curriculumTopic.findUnique({
    where: { id: topicId },
    select: { id: true, source: true, status: true, corroboratingUserIds: true, disputeUserIds: true },
  });

  if (!topic) return;
  if (topic.source === "outline") return; // outline-sourced topics skip verification

  // Get all matches for this topic to compute avg confidence
  const matches = await prisma.documentTopicMatch.findMany({
    where: { topicId },
    select: { userId: true, confidence: true },
  });

  if (matches.length === 0) return;

  // Dedupe user_ids into corroboratingStudents
  const uniqueStudentIds = [...new Set(matches.map((m) => m.userId))];

  // Remove disputed users from corroborating set
  const effectiveCorroborating = uniqueStudentIds.filter(
    (id) => !topic.disputeUserIds.includes(id)
  );

  // Compute average confidence from all matches
  const avgConfidence = matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;

  const meetsThreshold =
    effectiveCorroborating.length >= VERIFICATION_MIN_STUDENTS &&
    avgConfidence > VERIFICATION_MIN_AVG_CONFIDENCE &&
    topic.disputeUserIds.length === 0;

  const newStatus = topic.disputeUserIds.length > 0 ? "disputed" : meetsThreshold ? "verified" : "unverified";

  await prisma.curriculumTopic.update({
    where: { id: topicId },
    data: {
      corroboratingUserIds: effectiveCorroborating,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      verified: meetsThreshold,
      status: newStatus,
    },
  });

  if (meetsThreshold && topic.status !== "verified") {
    logInfo(`[topicExtractionService] Topic ${topicId} reached verification threshold`, {
      students: effectiveCorroborating.length,
      avgConfidence,
    });
  }
}

/**
 * Batch-match all of a user's existing documents in a course to the skeleton.
 * Runs server-side, processing documents sequentially to avoid rate limits.
 *
 * @param {string} courseCode
 * @param {string} userId
 * @param {function} [onProgress] - Optional progress callback (currentIndex, total, resourceName)
 * @returns {Promise<{matchCount: number, resourceCount: number}>}
 */
export async function retroactiveMatchDocuments(courseCode, userId, folderId, onProgress) {
  const topics = await prisma.curriculumTopic.findMany({
    where: { courseCode },
    select: { id: true, title: true, description: true },
  });

  if (topics.length === 0) {
    return { matchCount: 0, resourceCount: 0 };
  }

  // Find resources for this course that belong to the user
  // Prefer folder-scoped query when folderId is provided (unambiguous);
  // fall back to subject/courseCode OR-query for backward compat
  const where = folderId
    ? { folderId, uploadedBy: userId }
    : {
        OR: [
          { subject: courseCode, uploadedBy: userId },
          { folder: { courseCode }, uploadedBy: userId },
        ],
      };

  const resources = await prisma.resource.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      contentType: true,
      subject: true,
    },
  });

  if (resources.length === 0) {
    return { matchCount: 0, resourceCount: 0 };
  }

  let matchCount = 0;
  let errorCount = 0;
  let lastError = null;

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    onProgress?.(i, resources.length, resource.title);

    try {
      const count = await matchDocumentToSkeleton(resource, courseCode, userId);
      matchCount += count;
    } catch (err) {
      errorCount++;
      lastError = err;
      logError(err, {
        context: "retroactiveMatchDocuments",
        resourceId: resource.id,
        resourceTitle: resource.title,
      });
    }
  }

  onProgress?.(resources.length, resources.length, "Done");

  logInfo(`[topicExtractionService] Retroactive match complete for ${courseCode}`, {
    userId,
    resourceCount: resources.length,
    matchCount,
    errorCount,
  });

  // If ALL documents failed to match, surface the error
  if (errorCount === resources.length && resources.length > 0) {
    throw new Error(lastError?.message || "All documents failed to match");
  }

  return { matchCount, resourceCount: resources.length, errorCount };
}
