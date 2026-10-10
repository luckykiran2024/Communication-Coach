import { getEngagementLevel, getMasteryLevel, masteryLevels, type Profile } from "@coach/core";
import type { LearningRecord, MeasuredVoiceSession } from "../store";
import { completedStates, recordEvidence } from "./progress";
import { dayKey } from "./time";

export function progressSnapshot(
  records: LearningRecord[], voice: MeasuredVoiceSession[], profile: Profile, now: Date, assessmentEnabled: boolean,
) {
  const completed = records.filter(record => completedStates.has(record.conversation.state));
  const assessments = completed.map(record => recordEvidence(record, assessmentEnabled))
    .filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null);
  const weekStart = now.getTime() - 7 * 86400000;
  const measuredSeconds = (sessions: MeasuredVoiceSession[]) =>
    sessions.reduce((total, session) => total + (session.consumedSeconds ?? 0), 0);
  const weeklyVoice = voice.filter(session => session.startedAt.getTime() >= weekStart);
  const voiceConversations = new Set(voice.map(session => session.conversationId));
  const textRecords = completed.filter(record => !voiceConversations.has(record.conversation.id)
    && record.turns.some(turn => turn.role === "user"));
  const activeDays = new Set([
    ...completed.filter(record => record.turns.some(turn => turn.role === "user"))
      .map(record => dayKey(record.conversation.createdAt, profile.timezone)),
    ...voice.filter(session => (session.consumedSeconds ?? 0) > 0).map(session => dayKey(session.startedAt, profile.timezone)),
  ]);
  let currentStreakDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    if (!activeDays.has(dayKey(new Date(now.getTime() - offset * 86400000), profile.timezone))) break;
    currentStreakDays += 1;
  }
  const practiceMinutes = measuredSeconds(voice) / 60;
  const practiceDays = new Set(completed.map(record => dayKey(record.conversation.createdAt, profile.timezone))).size;
  const completedScenarios = new Set(completed.map(record => record.conversation.scenarioId)).size;
  const successfulRetries = assessments.filter(assessment => assessment.passed).length;
  const mastery = getMasteryLevel({ practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length });
  const dailyPractice = Array.from({ length: 7 }, (_, index) => {
    const key = dayKey(new Date(now.getTime() - (6 - index) * 86400000), profile.timezone);
    const dayVoice = voice.filter(session => dayKey(session.startedAt, profile.timezone) === key);
    const dayText = textRecords.filter(record => dayKey(record.conversation.createdAt, profile.timezone) === key);
    return { day: key.slice(5), minutes: measuredSeconds(dayVoice) / 60, sessions: dayVoice.length + dayText.length,
      textSessions: dayText.length };
  });
  const skillSignal = !assessmentEnabled && assessments.length
    ? Math.round(assessments.reduce((total, assessment) => total + (assessment.score ?? 0), 0) / assessments.length) : null;
  return {
    totalSessions: records.length, completedSessions: completed.length,
    weeklySessions: records.filter(record => record.conversation.createdAt.getTime() >= weekStart).length,
    practiceMinutes, measuredVoiceSeconds: measuredSeconds(voice), measuredVoiceMinutes: practiceMinutes,
    weeklyPracticeMinutes: measuredSeconds(weeklyVoice) / 60,
    textSessions: textRecords.length, settledVoiceSessions: voice.length,
    unknownVoiceDurations: voice.filter(session => session.consumedSeconds === null).length,
    currentStreakDays,
    engagement: getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays }),
    mastery, practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length,
    evidenceSource: assessmentEnabled ? "ai_assessment" : "local_check", dailyPractice,
    levelTrack: masteryLevels.map(item => ({ level: item.level, title: item.title, reached: mastery.level >= item.level })),
    skillSignal, skillSignalStatus: skillSignal === null ? "awaiting_assessment" as const : "available" as const,
  };
}
