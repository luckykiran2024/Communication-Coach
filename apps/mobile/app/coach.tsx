import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { Platform } from "react-native";
import { modules, type Scenario } from "@coach/core";
import { request, type Recommendations, type VoiceUsage } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Heading, Icon, ProgressBar, Screen, useTheme } from "../src/ui";

export default function AiCoach() {
  const auth = useAuth();
  const theme = useTheme();
  const [usage, setUsage] = useState<VoiceUsage | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [startingScenario, setStartingScenario] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!auth.token) return;
    try {
      const [voiceUsage, recommendations] = await Promise.all([
        request<VoiceUsage>("/v1/me/voice-usage", auth.token),
        request<Recommendations>("/v1/me/scenarios", auth.token),
      ]);
      setUsage(voiceUsage);
      setScenarios(recommendations.scenarios.slice(0, 4));
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  useEffect(() => { void load(); }, [auth.token]);

  const allowancePercent = useMemo(() => {
    if (!usage || usage.sessionsAllowed <= 0) return 0;
    return (usage.sessionsRemaining / usage.sessionsAllowed) * 100;
  }, [usage]);

  if (auth.loading) return <Screen><Copy>Loading AI Coach…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const unavailableReason = !usage ? "Checking your voice allowance…"
    : Platform.OS === "web" ? "Live role-play is available in the Android or iOS app. This browser supports text practice and the local microphone check."
      : !usage.liveVoiceAvailable ? "Live voice is temporarily unavailable. You can continue with text practice."
        : usage.sessionsRemaining <= 0 ? "You have no voice sessions remaining. Choose a plan to continue live role-play."
          : "";

  async function startScenario(scenario: Scenario) {
    setStartingScenario(scenario.id);
    setError("");
    try {
      const result = await request<{ conversation: { id: string } }>(
        "/v1/me/conversations", auth.token, "POST", { scenarioId: scenario.id },
      );
      router.push(`/practice/${result.conversation.id}`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStartingScenario("");
    }
  }

  return <Screen>
    <Heading eyebrow="AI Live Coach">Practise a real conversation.</Heading>
    <Copy>Choose a situation, speak naturally, and let the coach respond as the person in the scenario. Each live session lasts up to seven minutes.</Copy>

    <Card tone="accent">
      <Icon name="coach" size={34} color={theme.accent} />
      <Heading eyebrow={`${usage?.planTitle ?? "Your"} access`}>
        {unavailableReason ? "Live voice availability" : "Your coach is ready."}
      </Heading>
      <Copy>{usage?.lifetimeFreeLimit
        ? `${usage.sessionsRemaining} of ${usage.sessionsAllowed} free AI Coach sessions remain (lifetime).`
        : `${usage?.sessionsRemaining ?? "—"} of ${usage?.sessionsAllowed ?? "—"} AI Coach sessions remain this billing month.`}</Copy>
      <ProgressBar value={allowancePercent} />
      {usage?.planId === "free" && <Copy>After your free sessions, Professional is the recommended plan for continued AI role-play practice.</Copy>}
      {Boolean(unavailableReason) && <Copy>{unavailableReason}</Copy>}
      {usage && usage.sessionsRemaining <= 0 && <Action title="View plans" secondary onPress={() => router.push("/plans")} />}
      {Platform.OS === "web" && <Action title="Open text practice" secondary onPress={() => router.push("/workshop/daily")} />}
    </Card>

    <Card>
      <Heading eyebrow="How it works">One situation. One real conversation.</Heading>
      <Copy>1. The coach sets the scene and plays your stakeholder.</Copy>
      <Copy>2. You respond aloud and answer up to two follow-up questions.</Copy>
      <Copy>3. Your saved response can be reviewed for strengths, priorities, and a stronger retry.</Copy>
    </Card>

    <Heading eyebrow="Recommended for you">Choose a live role-play</Heading>
    {scenarios.map(scenario => {
      const module = modules.find(item => item.id === scenario.module);
      return <Card key={scenario.id}>
        <Heading eyebrow={module?.title ?? "Practice"}>{displayTitle(scenario.title)}</Heading>
        <Copy>{scenario.context}</Copy>
        <Copy>Coach role: {auth.me?.profile?.audience || "Your workplace stakeholder"}</Copy>
        <Action title="Start this role-play" icon="coach" busy={startingScenario === scenario.id}
          disabled={Boolean(startingScenario) || Boolean(unavailableReason)}
          onPress={() => void startScenario(scenario)} />
      </Card>;
    })}
    {scenarios.length === 0 && !error && <Copy>Loading relevant role-plays…</Copy>}
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Try again" secondary onPress={() => void load()} /></>}
  </Screen>;
}

function displayTitle(title: string) {
  return title.replace(/\s*·\s*(?:Clarity foundation|Structured message|Evidence and trade-offs|Audience adaptation|Leadership transfer)$/i, "");
}

