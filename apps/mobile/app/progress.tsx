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
  const maxMinutes = Math.max(1, ...daily.map(day => day.minutes));
  const aiEvidence = progress?.evidenceSource === "ai_assessment";
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
      <ProgressBar value={Math.min(100, weeklyMinutes / Math.max(1, profile.practiceMinutes * 7) * 100)} />
      <Copy>Your {profile.practiceMinutes}-minute daily target is a goal, not recorded practice.</Copy>
      {Boolean(progress?.unknownVoiceDurations) &&
        <Copy>{progress?.unknownVoiceDurations} call durations are unavailable and are excluded—not estimated.</Copy>}
    </Card>
    <Card>
      <Heading eyebrow="Completed text practice">{progress?.textSessions ?? 0} sessions</Heading>
      <Copy>Completed conversations with saved learner responses and no settled voice call. No minutes are invented.</Copy>
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
    <Card>
      <Heading eyebrow="Practice milestones">Your learning path</Heading>
      {(progress?.levelTrack ?? []).map(item => <Copy key={item.level}>
        Level {item.level} · {item.title} · {item.reached ? "Reached" : "Next evidence needed"}
      </Copy>)}
    </Card>
    <Card>
      <Heading eyebrow={aiEvidence ? "Evidence-linked AI feedback" : "Local evidence check"}>
        {progress?.successfulRetries ?? 0} demonstrated retries
      </Heading>
      <Copy>{progress?.evidenceAssessments ?? 0} saved comparisons. {aiEvidence
        ? "Only validated feedback showing demonstrated transfer counts as a successful retry."
        : "AI feedback is disabled. Local checks are a limited development fallback, not an AI quality rating."}</Copy>
      {!aiEvidence && progress?.skillSignalStatus === "available" &&
        <Copy>Local heuristic signal: {progress.skillSignal}%. This is not a validated ability score.</Copy>}
    </Card>
    <Copy>Your goal: {profile.goal}</Copy>
  </Screen>;
}
