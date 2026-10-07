CREATE TABLE "PurchaseIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseIntent_nonce_key" ON "PurchaseIntent"("nonce");
CREATE INDEX "PurchaseIntent_userId_status_idx" ON "PurchaseIntent"("userId", "status");
CREATE INDEX "PurchaseIntent_expiresAt_idx" ON "PurchaseIntent"("expiresAt");
ALTER TABLE "PurchaseIntent" ADD CONSTRAINT "PurchaseIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
