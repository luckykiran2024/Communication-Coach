import { assessCommunicationEvidence, getMasteryLevel, type Profile } from "@coach/core";
import type { ConversationTurn, Store } from "../store";
import { dayKey } from "./time";

export const completedStates = new Set(["COMPLETED", "ASSESSING", "FEEDBACK_READY"]);

export function learnerEvidence(turns: ConversationTurn[]) {
  const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
  const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
  return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
}

export async function learnerScenarioProgress(store: Store, userId: string, profile: Profile | null) {
  if (!profile) {
    return {
      mastery: getMasteryLevel({ practiceDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 }),
      completedScenarioIds: [] as string[],
    };
  }
  const conversations = await store.conversations(userId);
  const completed = conversations.filter(conversation => completedStates.has(conversation.state));
  const evidenceRows = await Promise.all(completed.map(async conversation => {
    const turns = await store.conversationTurns(userId, conversation.id);
    return learnerEvidence(turns);
  }));
  const assessments = evidenceRows.filter(assessment => assessment !== null);
  const practiceDays = new Set(completed.map(conversation => dayKey(conversation.createdAt, profile.timezone))).size;
  const completedScenarioIds = [...new Set(completed.map(conversation => conversation.scenarioId))];
  return {
    mastery: getMasteryLevel({
      practiceDays,
      completedScenarios: completedScenarioIds.length,
      successfulRetries: assessments.filter(assessment => assessment.passed).length,
      evidenceAssessments: assessments.length,
    }),
    completedScenarioIds,
  };
}
