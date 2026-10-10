import { feedbackAssessmentSchema } from "@coach/core";
import type { Assessment, AssessmentUsage } from "../store";

function nonNegativeInteger(value: number | null) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 2147483647);
}

export function checkedAssessment(record: Assessment): Assessment {
  const feedback = feedbackAssessmentSchema.parse({
    rubricVersion: record.rubricVersion, modelVersion: record.modelVersion, priorities: record.priorities,
    transferResult: record.transferResult, audioAssessed: record.audioAssessed,
  });
  if (record.inputTokens === null || record.outputTokens === null
    || ![record.inputTokens, record.outputTokens, record.costMicros].every(nonNegativeInteger)) {
    throw new Error("Invalid assessment usage counters");
  }
  return structuredClone({ ...record, ...feedback });
}

export function checkedAssessmentUsage(record: AssessmentUsage): AssessmentUsage {
  if (![1, 2].includes(record.attempt) || !record.modelVersion.trim()
    || ![record.inputTokens, record.outputTokens, record.costMicros].every(nonNegativeInteger)) {
    throw new Error("Invalid assessment attempt usage");
  }
  return structuredClone(record);
}
