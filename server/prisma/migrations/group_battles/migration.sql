-- Group battles, clan ratings and captain roles (Study Groups 2.0 steps 2-5)

ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL DEFAULT 1200;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "rankedWins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "rankedLosses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClassroomMember" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'member';

CREATE TABLE IF NOT EXISTS "GroupBattle" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'friendly',
    "challengerId" TEXT NOT NULL,
    "challengedId" TEXT NOT NULL,
    "mcqResourceId" TEXT,
    "title" TEXT,
    "timePerQuestion" INTEGER NOT NULL DEFAULT 20,
    "numQuestions" INTEGER NOT NULL DEFAULT 10,
    "lineupA" JSONB NOT NULL DEFAULT '[]',
    "lineupB" JSONB NOT NULL DEFAULT '[]',
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "ratingDeltaA" INTEGER,
    "ratingDeltaB" INTEGER,
    "liveCode" TEXT,
    "createdById" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GroupBattle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GroupBattle_challengerId_status_idx" ON "GroupBattle"("challengerId", "status");
CREATE INDEX IF NOT EXISTS "GroupBattle_challengedId_status_idx" ON "GroupBattle"("challengedId", "status");
CREATE INDEX IF NOT EXISTS "GroupBattle_status_scheduledFor_idx" ON "GroupBattle"("status", "scheduledFor");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBattle_challengerId_fkey') THEN
        ALTER TABLE "GroupBattle" ADD CONSTRAINT "GroupBattle_challengerId_fkey"
            FOREIGN KEY ("challengerId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBattle_challengedId_fkey') THEN
        ALTER TABLE "GroupBattle" ADD CONSTRAINT "GroupBattle_challengedId_fkey"
            FOREIGN KEY ("challengedId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
