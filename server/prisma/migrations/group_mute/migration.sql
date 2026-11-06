-- Per-group mute: unread pill still shows, but push notifications are suppressed.
ALTER TABLE "ClassroomMember" ADD COLUMN IF NOT EXISTS "muted" BOOLEAN NOT NULL DEFAULT FALSE;
