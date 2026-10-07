CREATE TABLE "VoiceSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VoiceSession_userId_status_idx" ON "VoiceSession"("userId", "status");
CREATE INDEX "VoiceSession_expiresAt_idx" ON "VoiceSession"("expiresAt");
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
