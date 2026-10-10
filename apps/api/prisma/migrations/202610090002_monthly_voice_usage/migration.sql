ALTER TABLE "VoiceSession" ADD COLUMN "monthKey" TEXT;

UPDATE "VoiceSession" AS session
SET "monthKey" = substring(reservation."dayKey" FROM 1 FOR 7)
FROM "UsageReservation" AS reservation
WHERE reservation.id = session."reservationId";

UPDATE "VoiceSession"
SET "monthKey" = to_char("startedAt", 'YYYY-MM')
WHERE "monthKey" IS NULL;

ALTER TABLE "VoiceSession" ALTER COLUMN "monthKey" SET NOT NULL;

CREATE TABLE "VoiceMonthUsage" (
  "userId" UUID NOT NULL,
  "monthKey" TEXT NOT NULL,
  "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  "consumedSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceMonthUsage_pkey" PRIMARY KEY ("userId", "monthKey")
);

ALTER TABLE "VoiceMonthUsage"
ADD CONSTRAINT "VoiceMonthUsage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "VoiceMonthUsage" ("userId", "monthKey", "sessionsUsed", "consumedSeconds", "updatedAt")
SELECT "userId", "monthKey", COUNT(*)::INTEGER, 0, CURRENT_TIMESTAMP
FROM "VoiceSession"
WHERE status <> 'failed'
GROUP BY "userId", "monthKey";

INSERT INTO "VoiceMonthUsage" ("userId", "monthKey", "sessionsUsed", "consumedSeconds", "updatedAt")
SELECT reservation."userId", substring(reservation."dayKey" FROM 1 FOR 7), 0,
       SUM(reservation."consumedSeconds")::INTEGER, CURRENT_TIMESTAMP
FROM "UsageReservation" AS reservation
GROUP BY reservation."userId", substring(reservation."dayKey" FROM 1 FOR 7)
ON CONFLICT ("userId", "monthKey") DO UPDATE
SET "consumedSeconds" = EXCLUDED."consumedSeconds";
