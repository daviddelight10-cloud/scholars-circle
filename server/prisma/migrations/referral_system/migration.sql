-- Referral system + Semester plan
-- Idempotent so it can safely re-run against a database that already has parts applied.

-- 1. Add "semester" to the PlanType enum.
--    NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
--    PostgreSQL < 12. On PG 12+ it is allowed as long as the new value is not
--    USED later in the same transaction (it isn't here).
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'semester';

-- 2. User columns for referrals
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBankedDays" INTEGER NOT NULL DEFAULT 0;

-- Unique referral code per user
CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");

-- Self-relation FK: who referred this user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_referredById_fkey'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey"
      FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Referral table — one row per successful referral (referee unique = referred once)
CREATE TABLE IF NOT EXISTS "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Referral_refereeId_key" ON "Referral"("refereeId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Referral_referrerId_fkey'
  ) THEN
    ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey"
      FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Referral_refereeId_fkey'
  ) THEN
    ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey"
      FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
