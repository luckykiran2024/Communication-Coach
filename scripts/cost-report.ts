import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { costSummary, parseVoiceCosts } from "./cost-summary";

async function main() {
  const database = new PrismaClient();
  try {
    const [usage, completed, voiceSessions] = await Promise.all([
      database.assessmentUsage.findMany({ select: { costMicros: true } }),
      database.assessment.count(),
      database.voiceSession.findMany({ where: { status: { in: ["ended", "expired"] } }, select: { providerCallId: true } }),
    ]);
    const path = process.env.VOICE_COST_LEDGER_PATH;
    const voiceCosts = path ? parseVoiceCosts(JSON.parse(readFileSync(path, "utf8"))) : [];
    console.log(JSON.stringify(costSummary(usage, completed, voiceSessions, voiceCosts), null, 2));
  } finally { await database.$disconnect(); }
}

main().catch(() => {
  console.error("Cost report failed; verify database access and billing evidence.");
  process.exitCode = 1;
});
