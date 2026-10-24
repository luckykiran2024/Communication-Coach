import { randomUUID } from "node:crypto";
import { assessmentRubrics, coachedAssessmentSchema, validateAssessment, type Scenario } from "@coach/core";
import type { AssessmentProvider } from "./assessment-provider";
import type { AssessmentUsage, ConversationTurn, Store } from "./store";
import { ApiError } from "./lib/errors";

export async function assessConversation(input: {
  store: Store; userId: string; conversationId: string; scenario: Scenario; turns: ConversationTurn[];
  provider: AssessmentProvider; model: string; now: () => Date; timeoutMs?: number; dailyLimit?: number;
}) {
  const run = await input.store.claimAssessmentRun(input.userId, input.conversationId, input.now(), input.dailyLimit ?? 10);
  const controller = new AbortController();
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("Assessment timed out")), { once: true });
  });
  void deadline.catch(() => undefined);
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
  try {
    for (const attempt of [1, 2]) {
      const usage: AssessmentUsage = {
        id: randomUUID(), conversationId: input.conversationId, runId: run.id, attempt, modelVersion: input.model,
        inputTokens: null, outputTokens: null, costMicros: null, createdAt: input.now(),
      };
      await input.store.recordAssessmentUsage(input.userId, usage);
      if (controller.signal.aborted) throw new Error("Assessment timed out");
      const pending = input.provider.assess({
        scenario: input.scenario, turns: input.turns, model: input.model, signal: controller.signal, requestId: usage.id,
      }).then(async result => {
        await input.store.settleAssessmentUsage(input.userId, {
          ...usage, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costMicros: result.costMicros,
          providerRequestId: result.providerRequestId, providerResponseId: result.providerResponseId,
        });
        return result;
      });
      const result = await Promise.race([pending, deadline]);
      let feedback;
      try {
        feedback = coachedAssessmentSchema.parse(typeof result.value === "string" ? JSON.parse(result.value) : result.value);
        const { transferResult: _transferResult, ...evidence } = feedback;
        validateAssessment(evidence, input.turns);
        if (feedback.rubricVersion !== assessmentRubrics[input.scenario.module].version || feedback.modelVersion !== input.model) {
          throw new Error("Assessment version mismatch");
        }
      } catch {
        if (attempt === 1 && !controller.signal.aborted) continue;
        throw new Error("Assessment evidence invalid");
      }
      const assessment = {
        ...feedback, id: randomUUID(), conversationId: input.conversationId,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, costMicros: result.costMicros, createdAt: input.now(),
      };
      if (controller.signal.aborted
        || !await input.store.finishAssessmentRun(input.userId, run.id, assessment, input.now())) {
        throw new Error("Assessment lease expired");
      }
      return assessment;
    }
    throw new Error("Assessment failed");
  } catch {
    await input.store.finishAssessmentRun(input.userId, run.id, null, input.now());
    throw new ApiError(503, "Feedback could not be verified. Your responses are saved. You can try feedback again.");
  } finally { clearTimeout(timer); }
}
