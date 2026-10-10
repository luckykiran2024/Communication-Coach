import type { FastifyInstance } from "fastify";
import { getEngagementLevel, getMasteryLevel, masteryLevels } from "@coach/core";
import { authenticate } from "../lib/auth-context";
import { dayKey } from "../lib/time";
import { completedStates, learnerEvidence } from "../lib/progress";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/me/progress", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await deps.store.conversations(user.id);
    const completed = conversations.filter(conversation => completedStates.has(conversation.state));
    const evidenceRows = await Promise.all(completed.map(async conversation => {
      const turns = await deps.store.conversationTurns(user.id, conversation.id);
      return learnerEvidence(turns);
    }));
    const assessments = evidenceRows.filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null);
    const weekStart = deps.now().getTime() - 7 * 86400000;
    const weekly = conversations.filter(conversation => conversation.createdAt.getTime() >= weekStart);
    const activeDays = new Set(conversations.map(conversation => dayKey(conversation.createdAt, profile.timezone)));
    let currentStreakDays = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const date = new Date(deps.now().getTime() - offset * 86400000);
      if (!activeDays.has(dayKey(date, profile.timezone))) break;
      currentStreakDays += 1;
    }
    const practiceMinutes = completed.length * profile.practiceMinutes;
    const engagement = getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays });
    const practiceDays = new Set(completed.map(conversation => dayKey(conversation.createdAt, profile.timezone))).size;
    const completedScenarios = new Set(completed.map(conversation => conversation.scenarioId)).size;
    const successfulRetries = assessments.filter(assessment => assessment.passed).length;
    const mastery = getMasteryLevel({ practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length });
    const dailyPractice = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(deps.now().getTime() - (6 - index) * 86400000);
      const key = dayKey(date, profile.timezone);
      const daySessions = conversations.filter(conversation => dayKey(conversation.createdAt, profile.timezone) === key);
      const dayCompleted = daySessions.filter(conversation => completedStates.has(conversation.state));
      return { day: key.slice(5), minutes: dayCompleted.length * profile.practiceMinutes, sessions: daySessions.length };
    });
    const levelTrack = masteryLevels.map(item => ({ level: item.level, title: item.title, reached: mastery.level >= item.level }));
    const skillSignal = assessments.length ? Math.round(assessments.reduce((total, assessment) => total + assessment.score, 0) / assessments.length) : null;
    return {
      totalSessions: conversations.length,
      completedSessions: completed.length,
      weeklySessions: weekly.length,
      practiceMinutes,
      weeklyPracticeMinutes: weekly.length * profile.practiceMinutes,
      currentStreakDays,
      engagement,
      mastery,
      practiceDays,
      completedScenarios,
      successfulRetries,
      evidenceAssessments: assessments.length,
      dailyPractice,
      levelTrack,
      skillSignal,
      skillSignalStatus: skillSignal === null ? "awaiting_assessment" as const : "available" as const,
    };
  });
}
