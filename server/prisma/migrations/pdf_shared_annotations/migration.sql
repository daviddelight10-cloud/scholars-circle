-- Migration: pdf_shared_annotations
-- Community marks on PDF documents: shared highlights (normalized rects over
-- the page) and page-pinned comments. Keyed by docKey (the client-side hash of
-- the file URL) so every reader of the same document sees the same board,
-- no matter which resource or folder surfaced the file.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.
-- Additive — no existing tables or columns are touched.

CREATE TABLE IF NOT EXISTS "PdfSharedAnnotation" (
    "id" TEXT NOT NULL,
    "docKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "color" TEXT,
    "rects" JSONB,
    "excerpt" TEXT,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfSharedAnnotation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PdfSharedAnnotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PdfSharedAnnotation_docKey_page_idx" ON "PdfSharedAnnotation"("docKey", "page");
CREATE INDEX IF NOT EXISTS "PdfSharedAnnotation_userId_idx" ON "PdfSharedAnnotation"("userId");
