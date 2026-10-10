ALTER TABLE "Conversation" ADD COLUMN "currentPhase" TEXT NOT NULL DEFAULT 'primary';
UPDATE "Conversation" SET "currentPhase" = 'independent_retry'
WHERE EXISTS (
  SELECT 1 FROM "ConversationTurn"
  WHERE "sessionId" = "Conversation"."id" AND "phase" = 'independent_retry' AND "role" = 'user'
);
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentPhase_check"
CHECK ("currentPhase" IN ('primary', 'independent_retry'));
