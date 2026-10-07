CREATE TABLE "CustomScenario" (
  "id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomScenario_pkey" PRIMARY KEY ("id")
);
