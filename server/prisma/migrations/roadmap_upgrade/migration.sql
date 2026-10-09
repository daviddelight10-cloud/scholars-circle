-- Migration: roadmap_upgrade
-- Manual roadmap editing: subtopic completion, manual mark-done, per-course exam date.
-- All additive — existing rows are unaffected.

ALTER TABLE "CurriculumTopic"
  ADD COLUMN IF NOT EXISTS "doneSubs" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "manuallyDone" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "UserCoursePref" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "courseCode" TEXT NOT NULL,
  "examDate"   TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserCoursePref_userId_courseCode_key"
  ON "UserCoursePref"("userId", "courseCode");
