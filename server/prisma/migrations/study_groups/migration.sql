-- Study groups: Classroom doubles as a student-created group (kind = "group")
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'classroom';
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "joinCode" TEXT;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Classroom" ADD COLUMN IF NOT EXISTS "subject" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_joinCode_key" ON "Classroom"("joinCode");
