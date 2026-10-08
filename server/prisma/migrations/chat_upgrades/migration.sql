-- Migration: chat_upgrades
-- DM material shares + quoted replies + reactions; group replies + pinned messages.
-- Run against your database, or use `npx prisma db push` after updating schema.prisma.
-- All additive — existing rows are unaffected.

ALTER TABLE "DirectMessage"
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT;

CREATE TABLE IF NOT EXISTS "DirectMessageReaction" (
  "id"        TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL REFERENCES "DirectMessage"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "emoji"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageReaction_messageId_userId_emoji_key"
  ON "DirectMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "DirectMessageReaction_messageId_idx"
  ON "DirectMessageReaction"("messageId");

ALTER TABLE "ClassroomMessage"
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinnedById" TEXT;
CREATE INDEX IF NOT EXISTS "ClassroomMessage_pinned_idx"
  ON "ClassroomMessage"("classroomId", "pinnedAt");
