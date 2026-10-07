ALTER TABLE "Entitlement" ADD COLUMN "originalTransactionId" TEXT;
ALTER TABLE "Entitlement" ADD COLUMN "providerEventDate" TIMESTAMP(3);
CREATE INDEX "Entitlement_provider_originalTransactionId_idx" ON "Entitlement"("provider", "originalTransactionId");
