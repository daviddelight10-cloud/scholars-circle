-- Migration: user_progress_tz_offset
-- Per-user timezone offset (minutes EAST of UTC) so the universal streak,
-- daily quests and reminder job can use the user's local "day" instead of
-- the UTC day. Without this a Lagos user studying 00:00–00:59 counted as
-- the previous day.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- Additive with a default — existing users stay on UTC until the client reports an offset.

ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "tzOffsetMinutes" INTEGER NOT NULL DEFAULT 0;
