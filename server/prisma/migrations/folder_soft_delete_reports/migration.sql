-- Migration: folder_soft_delete_reports
-- Adds Folder soft delete (recycle bin, 30-day retention) and the Report model.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

-- Step 1: Folder soft delete
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Folder_deletedAt_idx" ON "Folder"("deletedAt");

-- Step 2: Report table
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- Step 3: Relations + indexes
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Report_reporterId_targetType_targetId_key"
    ON "Report"("reporterId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Report_status_idx" ON "Report"("status");
