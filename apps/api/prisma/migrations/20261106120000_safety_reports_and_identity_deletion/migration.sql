ALTER TABLE "User" ADD COLUMN "supabaseUserId" UUID;
ALTER TABLE "User" ADD COLUMN "deletionStartedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");
CREATE TABLE "ContentReport" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "conversationId" UUID NOT NULL,
  "target" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3)
);
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");
