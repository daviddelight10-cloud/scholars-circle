-- Migration: remove_sm2_review_queue
-- Removes the legacy SM-2 review queue. Existing ReviewQueueItem rows are
-- converted to FSRS "legacy_mcq" PdfReviewItems (same mapping the old
-- /fsrs/migrate-sm2 endpoint used: interval→stability, EF→difficulty)
-- before the table is dropped.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

INSERT INTO "PdfReviewItem" (
    "id", "userId", "resourceId", "itemType", "pageIndex", "flashcardId",
    "topic", "subject",
    "state", "stability", "difficulty", "reps", "lapses",
    "lastReviewAt", "nextReviewAt", "dueAt",
    "createdAt", "updatedAt"
)
SELECT
    'sm2_' || rqi."id",
    rqi."userId",
    rqi."resourceId",
    'legacy_mcq',
    rqi."questionIndex",
    'none',
    r."title",
    r."subject",
    CASE WHEN rqi."repetitions" > 0 THEN 2 ELSE 0 END,
    GREATEST(0.1, COALESCE(rqi."intervalDays", 1)),
    LEAST(10, GREATEST(1, COALESCE(rqi."easinessFactor", 2.5) * 2)),
    COALESCE(rqi."repetitions", 0),
    0,
    rqi."lastReviewed",
    rqi."dueAt",
    rqi."dueAt",
    rqi."createdAt",
    CURRENT_TIMESTAMP
FROM "ReviewQueueItem" rqi
JOIN "Resource" r ON r."id" = rqi."resourceId"
WHERE NOT EXISTS (
    SELECT 1 FROM "PdfReviewItem" p WHERE p."id" = 'sm2_' || rqi."id"
)
ON CONFLICT ("userId", "resourceId", "itemType", "pageIndex", "flashcardId") DO NOTHING;

DROP TABLE IF EXISTS "ReviewQueueItem";
