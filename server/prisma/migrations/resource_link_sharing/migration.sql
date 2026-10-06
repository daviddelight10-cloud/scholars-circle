-- Migration: resource_link_sharing
-- Adds Resource.linkShared — owner toggle for share-token link access.
-- When false, GET /api/resources/:token only resolves for the uploader.
-- Default true preserves current behavior for every existing material.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "linkShared" BOOLEAN NOT NULL DEFAULT true;
