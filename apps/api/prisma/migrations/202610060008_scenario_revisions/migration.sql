CREATE TABLE "CustomScenarioRevision" (
    "id" UUID NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "changedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomScenarioRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomScenarioRevision_scenarioId_createdAt_idx" ON "CustomScenarioRevision"("scenarioId", "createdAt");

ALTER TABLE "CustomScenarioRevision" ADD CONSTRAINT "CustomScenarioRevision_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "CustomScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
