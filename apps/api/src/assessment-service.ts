import { randomUUID } from "node:crypto";
import { assessmentRubrics, feedbackAssessmentSchema, validateAssessment, type Scenario } from "@coach/core";
import type { AssessmentProvider } from "./assessment-provider";
import type { ConversationTurn, Store } from "./store";
import { ApiError } from "./lib/errors";

export async function assessConversation(input: {
  store: Store; userId: string; conversationId: string; scenario: Scenario; turns: ConversationTurn[];
  provider: AssessmentProvider; model: string; now: () => Date; timeoutMs?: number;
}) {
  await input.store.updateConversationState(input.userId, input.conversationId, "ASSESSING");
  const controller = new AbortController();
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("Assessment timed out")), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30000);
  try {
    for (const attempt of [1, 2]) {
      let result;
      try {
        result = await Promise.race([input.provider.assess({
          scenario: input.scenario, turns: input.turns, model: input.model, signal: controller.signal,
        }), deadline]);
      } catch {
        await input.store.recordAssessmentUsage(input.userId, {
          id: randomUUID(), conversationId: input.conversationId, attempt, modelVersion: input.model,
          inputTokens: null, outputTokens: null, costMicros: null, createdAt: input.now(),
        });
        throw new Error("Assessment unavailable");
      }
      await input.store.recordAssessmentUsage(input.userId, {
        id: randomUUID(), conversationId: input.conversationId, attempt, modelVersion: input.model,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, costMicros: result.costMicros, createdAt: input.now(),
      });
      let feedback;
      try {
        feedback = feedbackAssessmentSchema.parse(typeof result.value === "string" ? JSON.parse(result.value) : result.value);
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
      await input.store.saveAssessment(input.userId, assessment);
      await input.store.updateConversationState(input.userId, input.conversationId, "FEEDBACK_READY");
      return assessment;
    }
    throw new Error("Assessment failed");
  } catch {
    await input.store.updateConversationState(input.userId, input.conversationId, "FAILED");
    throw new ApiError(503, "Feedback could not be verified. Your responses are saved; no AI feedback has been fabricated.");
  } finally { clearTimeout(timer); }
}
