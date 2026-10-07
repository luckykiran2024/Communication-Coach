CREATE TABLE "OAuthIdentity" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OAuthIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OAuthIdentity_provider_subject_key" ON "OAuthIdentity"("provider", "subject");
CREATE INDEX "OAuthIdentity_userId_idx" ON "OAuthIdentity"("userId");
ALTER TABLE "OAuthIdentity" ADD CONSTRAINT "OAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
