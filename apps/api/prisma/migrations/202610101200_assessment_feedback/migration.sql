CREATE TABLE "Assessment" (
  "id" UUID NOT NULL PRIMARY KEY,
  "conversationId" UUID NOT NULL UNIQUE REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "rubricVersion" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "priorities" JSONB NOT NULL,
  "transferResult" TEXT NOT NULL CHECK ("transferResult" IN ('demonstrated', 'partial', 'not_yet')),
  "inputTokens" INTEGER NOT NULL CHECK ("inputTokens" >= 0),
  "outputTokens" INTEGER NOT NULL CHECK ("outputTokens" >= 0),
  "costMicros" INTEGER CHECK ("costMicros" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "AssessmentUsage" (
  "id" UUID NOT NULL PRIMARY KEY,
  "conversationId" UUID NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "attempt" INTEGER NOT NULL CHECK ("attempt" BETWEEN 1 AND 2),
  "modelVersion" TEXT NOT NULL,
  "inputTokens" INTEGER CHECK ("inputTokens" >= 0),
  "outputTokens" INTEGER CHECK ("outputTokens" >= 0),
  "costMicros" INTEGER CHECK ("costMicros" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("conversationId", "attempt")
);
