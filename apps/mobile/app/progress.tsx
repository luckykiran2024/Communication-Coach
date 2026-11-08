import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { brand } from "@coach/core";
import { useEffect, useState } from "react";
import { useAuth } from "../src/auth";
import { request, type ProgressSnapshot } from "../src/api";
import { Action, Card, Copy, Heading, ProgressBar, Screen, useTheme } from "../src/ui";
import { AnimalLevelBadge, achievementBird, birdForLevel } from "../src/animal-level-badge";

const minutes = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function Progress() {
  const auth = useAuth();
  const theme = useTheme();
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const token = auth.token;
  const profile = auth.me?.profile;
  useEffect(() => {
    let active = true;
    if (token && profile) {
      setError(""); setProgress(null);
      request<ProgressSnapshot>("/v1/me/progress", token)
        .then(value => { if (active) setProgress(value); })
        .catch(failure => { if (active) setError((failure as Error).message); });
    }
    return () => { active = false; };
  }, [token, profile, reload]);
  if (auth.loading) return <Screen><Copy>Loading your progress…</Copy></Screen>;
  if (!token) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (!progress) return <Screen><Copy error={Boolean(error)}>{error || "Loading your measured progress…"}</Copy>{Boolean(error) && <Action title="Retry" onPress={() => setReload(value => value + 1)} />}</Screen>;
  const weeklyMinutes = progress?.weeklyPracticeMinutes ?? 0;
  const daily = progress?.dailyPractice ?? [];
  const areaRatings = progress?.areaRatings ?? [];
  const assessmentTrend = progress?.assessmentTrend ?? [];
  const levelTrack = progress?.levelTrack ?? [];
  const maxMinutes = Math.max(1, ...daily.map(day => day.minutes));
  const aiEvidence = progress?.evidenceSource === "ai_assessment";
  const scoreTrend = assessmentTrend.slice(-8);
  const movement = progress?.scoreMovement;
  const pattern = progress.latestReview?.review.scores
    .filter(item => item.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const patternLabel = areaRatings.find(item => item.area === pattern?.area)?.label;
  return <Screen>
    <View style={{ alignItems: "flex-start" }}><AnimalLevelBadge level={progress.mastery.level} title={progress.mastery.title} /></View>
    <Heading eyebrow={brand.name}>Progress you can trace to practice.</Heading>
    {Boolean(error) && <Copy error>{error}</Copy>}
    <Copy>Voice time comes from settled server usage, never from your chosen practice length.
      Text practice is counted separately. Audio and accent are not scored.</Copy>
    <Card tone="accent">
      <Heading eyebrow="Current streak">{progress?.currentStreakDays ?? 0} practice days</Heading>
      <Copy>Built from completed responses and measured voice activity. Your longest completed-practice streak is {progress.longestStreakDays} days.</Copy>
    </Card>
    <Card>
      <Heading eyebrow={`Level ${progress?.mastery.level ?? 1}`}>
        {progress?.mastery.title ?? "Getting started"}
      </Heading>
      <Copy>{progress.practiceDays} practice days · {progress.longestStreakDays} best streak days · {progress.completedScenarios} scenarios · {progress.practicedGoals} communication goals · {progress.successfulRetries} successful retries.</Copy>
      <Copy>This badge tracks practice progression; it is not a certified skill score.</Copy>
      <ProgressBar value={progress?.mastery.progressPercent ?? 0} />
      <Copy>{progress?.mastery.nextLevel
        ? `Your next milestone is Level ${progress.mastery.nextLevel}. Practice days, best streak, varied scenarios and goals, and independent retry evidence must all reach the next milestone.`
        : "You have reached the current top level."}</Copy>
    </Card>
    <Card>
      <Heading eyebrow="Measured voice time">{minutes(progress?.measuredVoiceMinutes ?? 0)} minutes</Heading>
      <Copy>{minutes(weeklyMinutes)} measured minutes this week · {progress?.settledVoiceSessions ?? 0} settled voice calls.</Copy>
      <Copy>Practice is session-based, not daily. Use your included sessions whenever you choose during the billing period.</Copy>
      {Boolean(progress?.unknownVoiceDurations) &&
        <Copy>{progress?.unknownVoiceDurations} call durations are unavailable and are excluded—not estimated.</Copy>}
    </Card>
    <Card>
      <Heading eyebrow="Completed text practice">{progress?.textSessions ?? 0} sessions</Heading>
      <Copy>Completed conversations with saved learner responses and no settled voice call. No minutes are invented.</Copy>
    </Card>
    <Card tone="accent">
      <Heading eyebrow="Cumulative communication rating">
        {progress?.cumulativeScore === null || progress?.cumulativeScore === undefined
          ? "Awaiting rated practice" : `${progress.cumulativeScore}/10`}
      </Heading>
      <Copy>This is the running average of evidence-backed AI scorecards from your independent retries—not a certified ability score.</Copy>
      {scoreTrend.length > 0 ? <>
        <View style={{ height: 176, flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 12 }}>
          {scoreTrend.map((point, index) => <View key={point.conversationId}
            style={{ flex: 1, minWidth: 24, alignItems: "center", gap: 5 }}>
            <Text style={{ color: theme.ink, fontSize: 11, fontWeight: "700" }}>{point.cumulativeScore}</Text>
            <View accessibilityLabel={`Exercise ${index + 1}: cumulative rating ${point.cumulativeScore} out of 10`}
              style={{ width: "72%", maxWidth: 30, height: Math.max(8, point.cumulativeScore / 10 * 112),
                borderRadius: 8, backgroundColor: theme.accent }} />
            <Text style={{ color: theme.muted, fontSize: 10 }}>E{Math.max(1, assessmentTrend.length - scoreTrend.length + index + 1)}</Text>
          </View>)}
        </View>
        <Copy>{movement === null || movement === undefined ? "This is your starting benchmark."
          : movement > 0 ? `↑ ${movement.toFixed(1)} points since your first rated exercise.`
            : movement < 0 ? `↓ ${Math.abs(movement).toFixed(1)} points since your first rated exercise.`
              : "Your cumulative rating is steady since your first rated exercise."}</Copy>
        <Copy>Bars show how your cumulative average changes after each rated exercise. The latest eight are displayed.</Copy>
      </> : <Copy>Complete an AI-reviewed independent retry to create your first benchmark and start the graph.</Copy>}
    </Card>
    <Card>
      <Heading eyebrow="Latest reviewed exercise">{progress.latestReview ? `${progress.latestReview.score}/10 overall` : "Awaiting an AI-reviewed response"}</Heading>
      {progress.latestReview ? <>
        <Copy>{progress.latestReview.review.summary}</Copy>
        <Copy>Specific feedback: {progress.latestReview.review.opening.observation}</Copy>
        <Copy>Refined answer: {progress.latestReview.review.strongerAnswer.text}</Copy>
        <Copy>Pattern to practise: {pattern ? `${patternLabel ?? pattern.area}: ${pattern.rationale}` : "Complete another review for a specific pattern."}</Copy>
        <Action title="Read full evidence and scorecard" secondary onPress={() => { const id = progress.latestReview?.conversationId; if (id) router.push(`/feedback/${id}`); }} />
      </> : <Copy>When AI assessment is enabled and you complete an independent retry, this area will show evidence, a refined answer and a pattern to practise. No score is estimated from app usage.</Copy>}
    </Card>
    <Card>
      <Heading eyebrow="Cumulative skill ratings">Where your communication is moving.</Heading>
      {areaRatings.map(item => <View key={item.area}
        style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 }}>
        <Text style={{ color: theme.ink, flex: 1 }}>{item.label}</Text>
        <Text style={{ color: theme.ink, fontWeight: "700" }}>{item.score === null ? "Not assessed" : `${item.score}/10`}</Text>
      </View>)}
      <Copy>{areaRatings.some(item => item.score !== null) ? "Each rating is the average of saved, evidence-backed scores for that skill." : "Skill ratings will appear after an AI-reviewed independent retry. No score is inferred from practice frequency."}</Copy>
    </Card>
    <Card>
      <Heading eyebrow="Last seven days">Measured voice rhythm</Heading>
      <View style={{ height: 150, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {daily.map(day => <View key={day.day} style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <View accessibilityLabel={`${day.day}: ${minutes(day.minutes)} measured voice minutes`}
            style={{ width: "70%", maxWidth: 24, height: day.minutes ? Math.max(12, day.minutes / maxMinutes * 100) : 6,
              borderRadius: 8, backgroundColor: day.minutes ? theme.accent : theme.border }} />
          <Text style={{ color: theme.muted, fontSize: 11 }}>{day.day.slice(3)}</Text>
        </View>)}
      </View>
    </Card>
    <Card tone="accent">
      <Heading eyebrow="Earned XP">{progress.gamification.xp} XP</Heading>
      <Copy>XP comes from distinct scenarios, different practice days, your best streak, and independent retries. Repeating the same scenario does not award its scenario and retry XP again.</Copy>
      <Copy>{progress.gamification.weeklyChallenge.title}: {progress.gamification.weeklyChallenge.completed}/{progress.gamification.weeklyChallenge.target}</Copy>
      <ProgressBar value={progress.gamification.weeklyChallenge.completed / progress.gamification.weeklyChallenge.target * 100} />
    </Card>
    <Card>
      <Heading eyebrow="Achievements">Milestones you have earned</Heading>
      {progress.gamification.achievements.map(item => <View key={item.id} style={{ paddingVertical: 5 }}>
        <Copy>{achievementBird[item.id] ?? "🐦"} {item.title} · {item.unlocked ? "Earned" : "Locked"} · {item.detail}</Copy>
      </View>)}
    </Card>
    <Card>
      <Heading eyebrow="Practice milestones">Your learning path</Heading>
      {levelTrack.map(item => <Copy key={item.level}>
        {birdForLevel(item.level)} Level {item.level} · {item.title} · {item.reached ? "Reached" : "Next evidence needed"}
      </Copy>)}
    </Card>
    <Card>
      <Heading eyebrow={aiEvidence ? "Your retry results" : "Practice check"}>
        {progress?.evidenceAssessments ?? 0} {aiEvidence ? "assessed" : "locally checked"} retries
      </Heading>
      <Copy>{progress?.successfulRetries ?? 0} demonstrated · {Math.max(0,
        (progress?.evidenceAssessments ?? 0) - (progress?.successfulRetries ?? 0))} developing</Copy>
      <Copy>{aiEvidence
        ? "Demonstrated means you used the skill clearly in a new situation. Developing means you are improving but need more practice."
        : "AI feedback is off. This development check is only a simple practice signal."}</Copy>
      {!aiEvidence && progress?.skillSignalStatus === "available" &&
        <Copy>Local heuristic signal: {progress.skillSignal}%. This is not a validated ability score.</Copy>}
    </Card>
    <Copy>Your goal: {profile.goal}</Copy>
  </Screen>;
}
