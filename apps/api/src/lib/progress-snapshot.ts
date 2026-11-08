import {
  coachingAreaLabels, coachingAreas, coachingOverallScore, getEngagementLevel, getMasteryLevel, masteryLevels, scenarios,
  type Profile,
} from "@coach/core";
import type { LearningRecord, MeasuredVoiceSession } from "../store";
import { completedStates, learnerActivityDates, longestPracticeStreak, recordEvidence } from "./progress";
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
  const validVoice = voice.filter(session => session.startedAt <= now);
  const activeVoice = validVoice.filter(session => (session.consumedSeconds ?? 0) > 0);
  const weeklyVoice = validVoice.filter(session => session.startedAt.getTime() >= weekStart);
  const voiceConversations = new Set(voice.map(session => session.conversationId));
  const textRecords = completed.filter(record => !voiceConversations.has(record.conversation.id)
    && record.turns.some(turn => turn.role === "user"));
  const activeDays = new Set([
    ...learnerActivityDates(records, now).map(date => dayKey(date, profile.timezone)),
    ...activeVoice.map(session => dayKey(session.startedAt, profile.timezone)),
  ]);
  let currentStreakDays = 0;
  const firstOffset = activeDays.has(dayKey(now, profile.timezone)) ? 0 : 1;
  for (let offset = firstOffset; offset < firstOffset + 365; offset += 1) {
    if (!activeDays.has(dayKey(new Date(now.getTime() - offset * 86400000), profile.timezone))) break;
    currentStreakDays += 1;
  }
  const practiceMinutes = measuredSeconds(validVoice) / 60;
  const practiceDays = new Set(learnerActivityDates(completed, now).map(date => dayKey(date, profile.timezone))).size;
  const completedScenarios = new Set(completed.map(record => record.conversation.scenarioId)).size;
  const successfulRetries = assessments.filter(assessment => assessment.passed).length;
  const longestStreakDays = longestPracticeStreak(learnerActivityDates(completed, now), profile.timezone);
  const scenarioById = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  const practicedGoals = new Set(completed.flatMap(record => {
    const scenario = record.conversation.scenarioSnapshot ?? scenarioById.get(record.conversation.scenarioId);
    return scenario ? [scenario.goal] : [];
  })).size;
  const mastery = getMasteryLevel({ practiceDays, longestStreakDays, completedScenarios, practicedGoals,
    successfulRetries, evidenceAssessments: assessments.length });
  const scoredReviews = completed.flatMap(record => {
    const review = record.assessment?.coachingReview;
    if (!review || record.conversation.state !== "FEEDBACK_READY") return [];
    const score = coachingOverallScore(review);
    return score === null ? [] : [{ conversationId: record.conversation.id, day: record.assessment!.createdAt,
      score, review }];
  }).sort((first, second) => first.day.getTime() - second.day.getTime());
  let runningScore = 0;
  const assessmentTrend = scoredReviews.map((item, index) => {
    runningScore += item.score;
    return { conversationId: item.conversationId, day: dayKey(item.day, profile.timezone), score: item.score,
      cumulativeScore: Math.round(runningScore / (index + 1) * 10) / 10 };
  });
  const cumulativeScore = assessmentTrend.at(-1)?.cumulativeScore ?? null;
  const scoreMovement = assessmentTrend.length > 1 && cumulativeScore !== null
    ? Math.round((cumulativeScore - assessmentTrend[0].cumulativeScore) * 10) / 10 : null;
  const areaRatings = coachingAreas.map(area => {
    const scores = scoredReviews.flatMap(item => item.review.scores
      .filter(score => score.area === area && score.score !== null).map(score => score.score as number));
    return { area, label: coachingAreaLabels[area], score: scores.length
      ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length * 10) / 10 : null };
  });
  const dailyPractice = Array.from({ length: 7 }, (_, index) => {
    const key = dayKey(new Date(now.getTime() - (6 - index) * 86400000), profile.timezone);
    const dayVoice = activeVoice.filter(session => dayKey(session.startedAt, profile.timezone) === key);
    const dayText = textRecords.filter(record => learnerActivityDates([record], now)
      .some(date => dayKey(date, profile.timezone) === key));
    return { day: key.slice(5), minutes: measuredSeconds(dayVoice) / 60, sessions: dayVoice.length + dayText.length,
      textSessions: dayText.length };
  });
  const weeklySessions = new Set([
    ...records.filter(record => learnerActivityDates([record], now).some(date => date.getTime() >= weekStart))
      .map(record => record.conversation.id),
    ...activeVoice.filter(session => session.startedAt.getTime() >= weekStart).map(session => session.conversationId),
  ]).size;
  const completedIds = new Set(completed.map(record => record.conversation.id));
  const weeklyCompletedPractices = new Set([
    ...completed.filter(record => learnerActivityDates([record], now).some(date => date.getTime() >= weekStart))
      .map(record => record.conversation.id),
    ...activeVoice.filter(session => session.startedAt.getTime() >= weekStart && completedIds.has(session.conversationId))
      .map(session => session.conversationId),
  ]).size;
  const successfulRetryScenarios = new Set(completed.filter(record => recordEvidence(record, assessmentEnabled)?.passed)
    .map(record => record.conversation.scenarioId)).size;
  const xp = completedScenarios * 20 + practiceDays * 5 + longestStreakDays * 5 + successfulRetryScenarios * 15;
  const achievements = [
    { id: "first-answer", title: "First answer", detail: "Complete your first practice", unlocked: completed.length >= 1 },
    { id: "two-day-streak", title: "Two-day streak", detail: "Practise on two consecutive days", unlocked: longestStreakDays >= 2 },
    { id: "three-goals", title: "Skill explorer", detail: "Practise three communication goals", unlocked: practicedGoals >= 3 },
    { id: "three-retries", title: "Independent thinker", detail: "Demonstrate three distinct scenario retries", unlocked: successfulRetryScenarios >= 3 },
    { id: "ten-days", title: "Committed communicator", detail: "Practise on ten different days", unlocked: practiceDays >= 10 },
  ];
  const skillSignal = !assessmentEnabled && assessments.length
    ? Math.round(assessments.reduce((total, assessment) => total + (assessment.score ?? 0), 0) / assessments.length) : null;
  return {
    totalSessions: records.length, completedSessions: completed.length,
    weeklySessions,
    gamification: { xp, weeklyChallenge: { title: "Complete three practices in seven days", completed: Math.min(3, weeklyCompletedPractices), target: 3 }, achievements },
    practiceMinutes, measuredVoiceSeconds: measuredSeconds(validVoice), measuredVoiceMinutes: practiceMinutes,
    weeklyPracticeMinutes: measuredSeconds(weeklyVoice) / 60,
    textSessions: textRecords.length, settledVoiceSessions: voice.length,
    unknownVoiceDurations: voice.filter(session => session.consumedSeconds === null).length,
    currentStreakDays, longestStreakDays, practicedGoals,
    engagement: getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays }),
    mastery, practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length,
    evidenceSource: assessmentEnabled ? "ai_assessment" : "local_check", dailyPractice,
    levelTrack: masteryLevels.map(item => ({ level: item.level, title: item.title, reached: mastery.level >= item.level })),
    cumulativeScore, scoreMovement, assessmentTrend, areaRatings,
    latestReview: scoredReviews.at(-1) ?? null,
    skillSignal, skillSignalStatus: skillSignal === null ? "awaiting_assessment" as const : "available" as const,
  };
}
