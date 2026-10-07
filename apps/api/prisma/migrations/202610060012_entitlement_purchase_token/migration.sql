ALTER TABLE "Entitlement" ADD COLUMN "purchaseToken" TEXT;
CREATE INDEX "Entitlement_provider_purchaseToken_idx" ON "Entitlement"("provider", "purchaseToken");
