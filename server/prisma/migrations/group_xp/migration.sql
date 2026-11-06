-- Group XP ledger + leaderboard index (Study Groups 2.0, step 1)
CREATE TABLE IF NOT EXISTS "GroupXpEvent" (
  "id"          TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "xp"          INTEGER NOT NULL,
  "source"      TEXT NOT NULL DEFAULT 'xp',
  "dedupeKey"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupXpEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GroupXpEvent_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GroupXpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupXpEvent_dedupeKey_key" ON "GroupXpEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "GroupXpEvent_classroomId_createdAt_idx" ON "GroupXpEvent"("classroomId", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupXpEvent_userId_idx" ON "GroupXpEvent"("userId");
-- Leaderboard aggregation: SUM(xpAwarded) per user over a date range
CREATE INDEX IF NOT EXISTS "QuizAttempt_userId_createdAt_idx" ON "QuizAttempt"("userId", "createdAt");
