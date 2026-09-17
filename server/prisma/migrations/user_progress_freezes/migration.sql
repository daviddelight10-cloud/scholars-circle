-- Migration: user_progress_freezes
-- Adds server-side streak freeze inventory to UserProgress.
-- Freezes are purchased with (local) gems and consumed automatically by
-- updateUniversalStreak() when the user misses day(s) between sessions.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "freezes" INTEGER NOT NULL DEFAULT 0;
