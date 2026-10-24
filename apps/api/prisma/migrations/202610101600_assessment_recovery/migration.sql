BEGIN;
CREATE TABLE "AssessmentRun" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "dayKey" TEXT NOT NULL,
  "status" TEXT NOT NULL CHECK ("status" IN ('running', 'succeeded', 'failed')),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX "AssessmentRun_userId_dayKey_idx" ON "AssessmentRun"("userId", "dayKey");
CREATE INDEX "AssessmentRun_status_expiresAt_idx" ON "AssessmentRun"("status", "expiresAt");
CREATE UNIQUE INDEX "AssessmentRun_one_running" ON "AssessmentRun"("conversationId") WHERE "status" = 'running';
ALTER TABLE "AssessmentUsage" ADD COLUMN "runId" UUID REFERENCES "AssessmentRun"("id") ON DELETE CASCADE;
ALTER TABLE "AssessmentUsage" ADD COLUMN "providerRequestId" TEXT;
ALTER TABLE "AssessmentUsage" ADD COLUMN "providerResponseId" TEXT;
ALTER TABLE "AssessmentUsage" DROP CONSTRAINT "AssessmentUsage_conversationId_attempt_key";
CREATE UNIQUE INDEX "AssessmentUsage_conversationId_runId_attempt_key"
  ON "AssessmentUsage"("conversationId", "runId", "attempt");
CREATE UNIQUE INDEX "AssessmentUsage_legacy_attempt_key"
  ON "AssessmentUsage"("conversationId", "attempt") WHERE "runId" IS NULL;
DO $$
BEGIN
  IF current_schema() = 'public' THEN
    ALTER TABLE "AssessmentRun" ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE "AssessmentRun" FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON TABLE "AssessmentRun" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON TABLE "AssessmentRun" FROM authenticated;
    END IF;
  END IF;
END $$;
COMMIT;
