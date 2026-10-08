-- Migration: user_progress_gems
-- Server-backed 💎 balance so gems survive across devices and can gate
-- spends (MCQ hints, live-quiz lifeline, survival shop).
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- Additive with a default — existing users get the 20💎 starter balance once.

ALTER TABLE "UserProgress" ADD COLUMN IF NOT EXISTS "gems" INTEGER NOT NULL DEFAULT 20;
