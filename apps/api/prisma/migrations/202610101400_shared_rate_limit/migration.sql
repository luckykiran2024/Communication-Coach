CREATE TABLE "RateLimitBucket" (
  "keyHash" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL CHECK ("hits" > 0),
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket" ("resetAt");
