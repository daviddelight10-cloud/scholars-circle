-- Add a "groups" notification preference (group messages, joins, goals, battles).
ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "groups" BOOLEAN NOT NULL DEFAULT true;
