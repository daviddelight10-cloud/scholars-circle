-- Feed phase 2: accepted answers + social notification preference
ALTER TABLE "FeedPost" ADD COLUMN IF NOT EXISTS "acceptedCommentId" TEXT;
ALTER TABLE "FeedPost"
    ADD CONSTRAINT "FeedPost_acceptedCommentId_fkey"
    FOREIGN KEY ("acceptedCommentId") REFERENCES "FeedComment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "social" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FeedPost" ADD COLUMN IF NOT EXISTS "liveCode" TEXT;
