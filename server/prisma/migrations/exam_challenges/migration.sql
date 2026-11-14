-- Exam challenges: async group exams with token/code links, deadlines,
-- scoring rules and per-question leaderboard stats.

CREATE TABLE IF NOT EXISTS "ExamChallenge" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "examResourceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "groupId" TEXT,
    "scoring" TEXT NOT NULL DEFAULT 'first',
    "reveal" TEXT NOT NULL DEFAULT 'immediate',
    "deadline" TIMESTAMP(3),
    "reminder24SentAt" TIMESTAMP(3),
    "closedNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExamChallenge_token_key" ON "ExamChallenge"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "ExamChallenge_code_key" ON "ExamChallenge"("code");
CREATE INDEX IF NOT EXISTS "ExamChallenge_examResourceId_idx" ON "ExamChallenge"("examResourceId");
CREATE INDEX IF NOT EXISTS "ExamChallenge_groupId_idx" ON "ExamChallenge"("groupId");
CREATE INDEX IF NOT EXISTS "ExamChallenge_creatorId_idx" ON "ExamChallenge"("creatorId");
CREATE INDEX IF NOT EXISTS "ExamChallenge_deadline_idx" ON "ExamChallenge"("deadline");

CREATE TABLE IF NOT EXISTS "ExamChallengeView" (
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamChallengeView_pkey" PRIMARY KEY ("challengeId", "userId")
);

ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "challengeId" TEXT;
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
CREATE INDEX IF NOT EXISTS "QuizAttempt_challengeId_idx" ON "QuizAttempt"("challengeId");

ALTER TABLE "FeedPost" ADD COLUMN IF NOT EXISTS "challengeToken" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamChallenge_examResourceId_fkey') THEN
        ALTER TABLE "ExamChallenge" ADD CONSTRAINT "ExamChallenge_examResourceId_fkey"
            FOREIGN KEY ("examResourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamChallenge_creatorId_fkey') THEN
        ALTER TABLE "ExamChallenge" ADD CONSTRAINT "ExamChallenge_creatorId_fkey"
            FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamChallenge_groupId_fkey') THEN
        ALTER TABLE "ExamChallenge" ADD CONSTRAINT "ExamChallenge_groupId_fkey"
            FOREIGN KEY ("groupId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamChallengeView_challengeId_fkey') THEN
        ALTER TABLE "ExamChallengeView" ADD CONSTRAINT "ExamChallengeView_challengeId_fkey"
            FOREIGN KEY ("challengeId") REFERENCES "ExamChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExamChallengeView_userId_fkey') THEN
        ALTER TABLE "ExamChallengeView" ADD CONSTRAINT "ExamChallengeView_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuizAttempt_challengeId_fkey') THEN
        ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_challengeId_fkey"
            FOREIGN KEY ("challengeId") REFERENCES "ExamChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
