-- Migration: pdf_reader_state
-- Per-user, per-document PDF reader state so annotations, text-anchored
-- highlights, notes, bookmarks, last page, scroll mode, reading stats and
-- chat history sync across devices instead of living only in localStorage.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- Additive — no existing tables or columns are touched.

CREATE TABLE IF NOT EXISTS "PdfReaderState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "resourceId" TEXT,
    "lastPage" INTEGER,
    "scrollMode" TEXT,
    "annotations" JSONB,
    "marks" JSONB,
    "bookmarks" JSONB,
    "stats" JSONB,
    "chat" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfReaderState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PdfReaderState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PdfReaderState_userId_docKey_key" ON "PdfReaderState"("userId", "docKey");
CREATE INDEX IF NOT EXISTS "PdfReaderState_userId_resourceId_idx" ON "PdfReaderState"("userId", "resourceId");
