import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { brand } from "@coach/core";
import { useEffect, useState } from "react";
import { useAuth } from "../src/auth";
import { request, type ProgressSnapshot } from "../src/api";
import { Card, Copy, Heading, ProgressBar, Screen, useTheme } from "../src/ui";

const minutes = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export default function Progress() {
  const auth = useAuth();
  const theme = useTheme();
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [error, setError] = useState("");
  const token = auth.token;
  const profile = auth.me?.profile;
  useEffect(() => {
    let active = true;
    if (token && profile) {
      request<ProgressSnapshot>("/v1/me/progress", token)
        .then(value => { if (active) setProgress(value); })
        .catch(failure => { if (active) setError((failure as Error).message); });
    }
    return () => { active = false; };
  }, [token, profile]);
  if (auth.loading) return <Screen><Copy>Loading your progress…</Copy></Screen>;
  if (!token) return <Redirect href="/" />;
  if (!profile) return <Redirect href="/onboarding" />;
  const weeklyMinutes = progress?.weeklyPracticeMinutes ?? 0;
  const daily = progress?.dailyPractice ?? [];
  const areaRatings = progress?.areaRatings ?? [];
  const assessmentTrend = progress?.assessmentTrend ?? [];
  const levelTrack = progress?.levelTrack ?? [];
  const maxMinutes = Math.max(1, ...daily.map(day => day.minutes));
  const aiEvidence = progress?.evidenceSource === "ai_assessment";
  const scoreTrend = assessmentTrend.slice(-8);
  const movement = progress?.scoreMovement;
  return <Screen>
    <Heading eyebrow={brand.name}>Progress you can trace to practice.</Heading>
    {Boolean(error) && <Copy error>{error}</Copy>}
    <Copy>Voice time comes from settled server usage, never from your chosen practice length.
      Text practice is counted separately. Audio and accent are not scored.</Copy>
    <Card tone="accent">
      <Heading eyebrow="Current streak">{progress?.currentStreakDays ?? 0} practice days</Heading>
      <Copy>Built from completed responses and measured voice activity—not opening the app.</Copy>
    </Card>
    <Card>
      <Heading eyebrow={`Level ${progress?.mastery.level ?? 1}`}>
        {progress?.mastery.title ?? "Getting started"}
      </Heading>
      <Copy>{progress?.practiceDays ?? 0} days · {progress?.completedScenarios ?? 0} scenarios ·
        {" "}{progress?.successfulRetries ?? 0} successful independent retries.</Copy>
      <ProgressBar value={progress?.mastery.progressPercent ?? 0} />
      <Copy>{progress?.mastery.nextLevel
        ? `Your next milestone is Level ${progress.mastery.nextLevel}. All four evidence gates must be met.`
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
    {areaRatings.some(item => item.score !== null) && <Card>
      <Heading eyebrow="Cumulative skill ratings">Where your communication is moving.</Heading>
      {areaRatings.map(item => <View key={item.area}
        style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 7 }}>
        <Text style={{ color: theme.ink, flex: 1 }}>{item.label}</Text>
        <Text style={{ color: theme.ink, fontWeight: "700" }}>{item.score === null ? "Not assessed" : `${item.score}/10`}</Text>
      </View>)}
      <Copy>Each rating is the average of saved, evidence-backed scores for that skill.</Copy>
    </Card>}
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
    <Card>
      <Heading eyebrow="Practice milestones">Your learning path</Heading>
      {levelTrack.map(item => <Copy key={item.level}>
        Level {item.level} · {item.title} · {item.reached ? "Reached" : "Next evidence needed"}
      </Copy>)}
    </Card>
    <Card>
      <Heading eyebrow={aiEvidence ? "Your retry results" : "Practice check"}>
        {progress?.evidenceAssessments ?? 0} assessed retries
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
