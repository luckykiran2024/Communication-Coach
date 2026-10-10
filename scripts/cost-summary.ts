type Attempt = { costMicros: number | null };
type VoiceCall = { providerCallId: string | null };
type VoiceCost = { providerCallId: string; costMicros: number };

export function parseVoiceCosts(value: unknown): VoiceCost[] {
  if (!Array.isArray(value)) throw new Error("Voice billing evidence must be an array.");
  const seen = new Set<string>();
  return value.map(row => {
    if (row === null || typeof row !== "object" || typeof row.providerCallId !== "string"
      || !row.providerCallId || !Number.isSafeInteger(row.costMicros) || row.costMicros < 0
      || seen.has(row.providerCallId)) throw new Error("Invalid or duplicate voice billing evidence.");
    seen.add(row.providerCallId);
    return { providerCallId: row.providerCallId, costMicros: row.costMicros };
  });
}

export function costSummary(usage: Attempt[], feedbackSessions: number, voice: VoiceCall[], voiceCosts: VoiceCost[] = []) {
  const unknownAssessmentCosts = usage.filter(attempt => attempt.costMicros === null).length;
  const assessmentTotal = usage.reduce((sum, attempt) => sum + (attempt.costMicros ?? 0), 0);
  const costs = new Map(voiceCosts.map(row => [row.providerCallId, row.costMicros]));
  const unknownVoiceCosts = voice.filter(row => row.providerCallId === null || !costs.has(row.providerCallId)).length;
  const voiceTotal = voice.reduce((sum, row) => sum + (costs.get(row.providerCallId ?? "") ?? 0), 0);
  return {
    currency: "USD", assessmentAttempts: usage.length, feedbackSessions, unknownAssessmentCosts,
    averageAssessmentCostPerFeedbackSession: unknownAssessmentCosts === 0 && feedbackSessions > 0
      ? assessmentTotal / feedbackSessions / 1000000 : null,
    settledVoiceSessions: voice.length, unknownVoiceCosts,
    averageVoiceCostPerSession: unknownVoiceCosts === 0 && voice.length > 0 ? voiceTotal / voice.length / 1000000 : null,
    voiceCostStatus: "Uses supplied provider billing evidence only; never estimates cost from duration.",
  };
}
