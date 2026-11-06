-- Track when a member last opened the group chat, for unread counts.
ALTER TABLE "ClassroomMember" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP;
