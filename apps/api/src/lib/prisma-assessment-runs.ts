import { Prisma, type PrismaClient } from "@prisma/client";
import type { SessionState } from "@coach/core";
import type { AssessmentRun, Store } from "../store";
import { checkedAssessment, checkedAssessmentUsage } from "./assessment-record";
import { assessmentLeaseMs, newAssessmentRun } from "./assessment-run";

export function prismaAssessmentRuns(db: PrismaClient): Pick<Store,
  "claimAssessmentRun" | "finishAssessmentRun" | "expireAssessmentRuns" | "settleAssessmentUsage"> {
  const methods: ReturnType<typeof prismaAssessmentRuns> = {
    async claimAssessmentRun(userId, conversationId, now, dailyLimit) {
      return db.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
        const account = await transaction.user.findUnique({ where: { id: userId } });
        const conversation = await transaction.conversation.findFirst({ where: { id: conversationId, userId } });
        const rows = await transaction.assessmentRun.findMany({ where: { userId,
          OR: [{ dayKey: now.toISOString().slice(0, 10) }, { conversationId }] } });
        const run = newAssessmentRun(account,
          conversation ? { ...conversation, state: conversation.state as SessionState } : null,
          rows as AssessmentRun[], now, dailyLimit);
        await transaction.assessmentRun.create({ data: run });
        await transaction.conversation.update({ where: { id: conversationId }, data: { state: "ASSESSING", updatedAt: now } });
        return run;
      });
    },
    async finishAssessmentRun(userId, runId, assessment, now) {
      const checked = assessment ? checkedAssessment(assessment) : null;
      return db.$transaction(async transaction => {
        const candidate = await transaction.assessmentRun.findFirst({ where: { id: runId, userId } });
        if (!candidate) return false;
        const conversationId = candidate.conversationId;
        await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
        const run = await transaction.assessmentRun.findFirst({ where: { id: runId, userId, status: "running" } });
        const conversation = await transaction.conversation.findFirst({ where: { id: conversationId, userId } });
        if (!run || !conversation) return false;
        if (checked && checked.conversationId !== conversationId) throw new Error("Assessment conversation mismatch");
        const accepted = Boolean(checked && run.expiresAt > now && conversation.state === "ASSESSING");
        if (accepted && checked) {
          const { audioAssessed: _audioAssessed, coachingReview, ...data } = checked;
          await transaction.assessment.create({ data: { ...data, coachingReview: coachingReview ?? Prisma.DbNull } });
        }
        await transaction.assessmentRun.update({ where: { id: runId }, data: {
          status: accepted ? "succeeded" : "failed", finishedAt: now,
        } });
        await transaction.conversation.updateMany({ where: { id: conversationId, userId, state: "ASSESSING" },
          data: { state: accepted ? "FEEDBACK_READY" : "FAILED", updatedAt: now } });
        return checked ? accepted : true;
      });
    },
    async expireAssessmentRuns(now) {
      const rows = await db.assessmentRun.findMany({ where: { status: "running", expiresAt: { lte: now } },
        take: 100, orderBy: { expiresAt: "asc" } });
      let expired = 0;
      for (const row of rows) if (await methods.finishAssessmentRun(row.userId, row.id, null, now)) expired += 1;
      const cutoff = new Date(now.getTime() - assessmentLeaseMs);
      const recovered = await db.conversation.updateMany({ where: {
        state: { in: ["ASSESSING", "FAILED"] }, assessmentRuns: { none: {} }, assessment: { isNot: null },
        OR: [{ state: "FAILED" }, { updatedAt: { lte: cutoff } }],
      }, data: { state: "FEEDBACK_READY", updatedAt: now } });
      const legacy = await db.conversation.updateMany({ where: {
        state: "ASSESSING", updatedAt: { lte: cutoff }, assessmentRuns: { none: {} }, assessment: { is: null },
      }, data: { state: "FAILED", updatedAt: now } });
      return expired + recovered.count + legacy.count;
    },
    async settleAssessmentUsage(userId, usage) {
      const record = checkedAssessmentUsage(usage);
      const existing = await db.assessmentUsage.findFirst({ where: {
        id: record.id, conversationId: record.conversationId, runId: record.runId ?? null,
        attempt: record.attempt, modelVersion: record.modelVersion, conversation: { userId },
      } });
      if (!existing) throw new Error("Assessment usage not found");
      if (existing.inputTokens !== null) return;
      await db.assessmentUsage.updateMany({ where: { id: existing.id, inputTokens: null }, data: {
        inputTokens: record.inputTokens, outputTokens: record.outputTokens, costMicros: record.costMicros,
        providerRequestId: record.providerRequestId, providerResponseId: record.providerResponseId,
      } });
    },
  };
  return methods;
}
