import { assessCommunicationEvidence, getMasteryLevel, scenarios, type Profile } from "@coach/core";
import type { ConversationTurn, LearningRecord, Store } from "../store";
import { dayKey } from "./time";

export const completedStates = new Set(["COMPLETED", "ASSESSING", "FEEDBACK_READY"]);

export function learnerEvidence(turns: ConversationTurn[]) {
  const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
  const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
  return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
}

export async function learnerScenarioProgress(store: Store, userId: string, profile: Profile | null, assessmentEnabled = false) {
  if (!profile) {
    return {
      mastery: getMasteryLevel({ practiceDays: 0, longestStreakDays: 0, completedScenarios: 0, practicedGoals: 0, successfulRetries: 0, evidenceAssessments: 0 }),
      completedScenarioIds: [] as string[],
    };
  }
  const records = await store.learningRecords(userId);
  const completedRecords = records.filter(record => completedStates.has(record.conversation.state));
  const completed = completedRecords.map(record => record.conversation);
  const evidenceRows = completedRecords.map(record => recordEvidence(record, assessmentEnabled));
  const assessments = evidenceRows.filter(assessment => assessment !== null);
  const practiceDays = new Set(learnerActivityDates(completedRecords).map(date => dayKey(date, profile.timezone))).size;
  const completedScenarioIds = [...new Set(completed.map(conversation => conversation.scenarioId))];
  const longestStreakDays = longestPracticeStreak(learnerActivityDates(completedRecords), profile.timezone);
  const scenarioById = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  const practicedGoals = new Set(completedRecords.flatMap(record => {
    const scenario = record.conversation.scenarioSnapshot ?? scenarioById.get(record.conversation.scenarioId);
    return scenario ? [scenario.goal] : [];
  })).size;
  return {
    mastery: getMasteryLevel({
      practiceDays, longestStreakDays, practicedGoals,
      completedScenarios: completedScenarioIds.length,
      successfulRetries: assessments.filter(assessment => assessment.passed).length,
      evidenceAssessments: assessments.length,
    }),
    completedScenarioIds,
  };
}

export function learnerActivityDates(records: LearningRecord[], now?: Date) {
  return records.flatMap(record => record.turns.filter(turn => turn.role === "user"
    && turn.text.trim().length > 0 && (!now || turn.createdAt <= now)).map(turn => turn.createdAt));
}

export function recordEvidence(record: LearningRecord, assessmentEnabled: boolean) {
  if (!assessmentEnabled) return learnerEvidence(record.turns);
  return record.assessment && record.conversation.state === "FEEDBACK_READY"
    ? { passed: record.assessment.transferResult === "demonstrated", score: null } : null;
}

export function longestPracticeStreak(dates: Date[], timezone: string) {
  const keys = [...new Set(dates.map(date => dayKey(date, timezone)))].sort();
  let longest = 0;
  let run = 0;
  let previous = -Infinity;
  for (const key of keys) {
    const day = Date.parse(`${key}T00:00:00Z`) / 86400000;
    run = day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}
