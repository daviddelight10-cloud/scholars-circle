-- Migration: copyright_reports_terms
-- Copyright takedown notices from external claimants (no account) on Report,
-- plus tracked terms acceptance on User.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- All changes are additive/nullable — no data loss.

-- Step 1: allow guest reports (external copyright claimants)
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;

-- Step 2: copyright claim fields
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "claimDescription" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "evidenceUrl" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "declarationAccepted" BOOLEAN NOT NULL DEFAULT false;

-- Step 3: tracked terms acceptance
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
