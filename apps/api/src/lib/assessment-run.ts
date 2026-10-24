import { randomUUID } from "node:crypto";
import type { Account, AssessmentRun, Conversation } from "../store";
import { ConflictError } from "../store";
import { ApiError } from "./errors";

export const assessmentLeaseMs = 60000;
export const assessmentRunLimit = 3;

export function newAssessmentRun(
  account: Pick<Account, "id" | "emailVerifiedAt"> | null,
  conversation: Pick<Conversation, "id" | "userId" | "state"> | null,
  runs: AssessmentRun[], now: Date, dailyLimit: number,
): AssessmentRun {
  if (!account || !conversation || conversation.userId !== account.id) throw new ApiError(404, "Conversation not found.");
  if (!account.emailVerifiedAt) throw new ApiError(403, "Verify your email before requesting AI feedback.");
  if (!["CREATED", "INTERRUPTED", "FAILED"].includes(conversation.state)) {
    throw new ConflictError("Feedback is already running or this practice is closed.");
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) throw new Error("Invalid assessment daily limit");
  const ownedRuns = runs.filter(run => run.userId === account.id);
  const dayKey = now.toISOString().slice(0, 10);
  if (ownedRuns.filter(run => run.dayKey === dayKey).length >= dailyLimit) {
    throw new ApiError(429, "Today's AI feedback limit is reached. Your responses are saved. Try again tomorrow (UTC).");
  }
  const previous = ownedRuns.filter(run => run.conversationId === conversation.id);
  if (previous.some(run => run.status === "running")) throw new ConflictError("Feedback is already running.");
  if (previous.length >= assessmentRunLimit) {
    throw new ApiError(429, "Feedback retry limit reached for this practice. Your responses are saved.");
  }
  return {
    id: randomUUID(), userId: account.id, conversationId: conversation.id, dayKey, status: "running",
    createdAt: now, expiresAt: new Date(now.getTime() + assessmentLeaseMs), finishedAt: null,
  };
}
