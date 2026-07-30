-- Migration: fcm-tokens
-- Replace Web Push (VAPID) subscription fields with FCM token fields.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

-- Step 1: Add new columns
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "fcmToken" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'web';

-- Step 2: Drop old columns and unique constraint
ALTER TABLE "PushSubscription" DROP COLUMN IF EXISTS "endpoint";
ALTER TABLE "PushSubscription" DROP COLUMN IF EXISTS "p256dh";
ALTER TABLE "PushSubscription" DROP COLUMN IF EXISTS "auth";

-- Step 3: Add unique constraint on fcmToken
-- Note: existing rows will have NULL fcmToken. If you have existing subscriptions,
-- they can't be migrated to FCM tokens (different system). You may want to:
--   TRUNCATE "PushSubscription" CASCADE;  -- to clear old web-push subscriptions
-- before adding the unique constraint, OR just let new subscriptions coexist.

-- Uncomment the next line if you want to clear old subscriptions:
-- TRUNCATE "PushSubscription" CASCADE;

-- Add unique constraint (safe if table is empty or all fcmToken values are unique)
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_fcmToken_key" UNIQUE ("fcmToken");
