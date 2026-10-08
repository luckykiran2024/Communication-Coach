CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserProfile" (
  "userId" UUID NOT NULL,
  "data" JSONB NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "AuthSession" (
  "tokenHash" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("tokenHash")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "UsageReservation" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "dayKey" TEXT NOT NULL,
  "reservedSeconds" INTEGER NOT NULL,
  "consumedSeconds" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UsageReservation_userId_dayKey_idx" ON "UsageReservation"("userId", "dayKey");
CREATE INDEX "UsageReservation_expiresAt_idx" ON "UsageReservation"("expiresAt");
ALTER TABLE "UsageReservation" ADD CONSTRAINT "UsageReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "Conversation" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ConversationTurn" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationTurn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Conversation_userId_createdAt_idx" ON "Conversation"("userId", "createdAt");
CREATE INDEX "ConversationTurn_sessionId_createdAt_idx" ON "ConversationTurn"("sessionId", "createdAt");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationTurn" ADD CONSTRAINT "ConversationTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
