-- Migration: user_onboarded_at
-- Persist onboarding completion server-side so the wizard doesn't re-appear
-- when a returning user signs in on a new device.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- Additive/nullable — no data loss.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
