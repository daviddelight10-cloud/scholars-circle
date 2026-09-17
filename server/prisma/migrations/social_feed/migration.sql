-- Migration: social_feed
-- Adds the social feed models (FeedPost, FeedLike, FeedComment, FeedCommentLike)
-- and widens ClassroomStudyRoom for public "go live with friends" study rooms.
-- Run this against your database, or use `npx prisma db push` after updating schema.prisma.

-- Step 1: Feed tables
CREATE TABLE IF NOT EXISTS "FeedPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'post',
    "text" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT,
    "universityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeedLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FeedLike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeedComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeedCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FeedCommentLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeedLike_postId_userId_key" ON "FeedLike"("postId", "userId");
CREATE INDEX IF NOT EXISTS "FeedPost_createdAt_idx" ON "FeedPost"("createdAt");
CREATE INDEX IF NOT EXISTS "FeedPost_authorId_createdAt_idx" ON "FeedPost"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "FeedComment_postId_createdAt_idx" ON "FeedComment"("postId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "FeedCommentLike_commentId_userId_key" ON "FeedCommentLike"("commentId", "userId");

ALTER TABLE "FeedPost"
    ADD CONSTRAINT "FeedPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FeedPost_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeedLike"
    ADD CONSTRAINT "FeedLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FeedLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedComment"
    ADD CONSTRAINT "FeedComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FeedPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FeedComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedCommentLike"
    ADD CONSTRAINT "FeedCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "FeedComment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "FeedCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: ClassroomStudyRoom — public rooms ("go live with friends")
ALTER TABLE "ClassroomStudyRoom" ALTER COLUMN "classroomId" DROP NOT NULL;
ALTER TABLE "ClassroomStudyRoom" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClassroomStudyRoom" ADD COLUMN IF NOT EXISTS "maxSeats" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "ClassroomStudyRoom" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "ClassroomStudyRoom" ADD COLUMN IF NOT EXISTS "focus" TEXT;
ALTER TABLE "ClassroomStudyRoom" ADD COLUMN IF NOT EXISTS "resourceId" TEXT;
ALTER TABLE "ClassroomStudyRoom"
    ADD CONSTRAINT "ClassroomStudyRoom_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ClassroomStudyRoom_isPublic_status_idx" ON "ClassroomStudyRoom"("isPublic", "status");
