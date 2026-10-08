import { useEffect, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { modules, type LearningModule, type Scenario } from "@coach/core";
import { request, type Recommendations } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Action, Card, Copy, Heading, Screen } from "../../src/ui";

const pathTitles: Record<LearningModule, string> = {
  daily: "Daily Communication",
  leadership: "Leadership",
  management: "Professional Workshop",
};

export default function WorkshopPath() {
  const auth = useAuth();
  const { module: moduleParam, completedScenarioId: completedParam } = useLocalSearchParams<{ module?: string; completedScenarioId?: string }>();
  const moduleId = modules.find(item => item.id === moduleParam)?.id;
  const completedScenarioId = Array.isArray(completedParam) ? completedParam[0] : completedParam;
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [error, setError] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [startingScenario, setStartingScenario] = useState("");

  async function load() {
    try {
      const response = await request<Recommendations>("/v1/me/scenarios", auth.token);
      setScenarios(response.scenarios.filter(scenario => scenario.module === moduleId));
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  useEffect(() => {
    if (auth.token && moduleId) void load();
  }, [auth.token, moduleId]);

  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  if (!moduleId) return <Screen><Heading>Workshop not found</Heading><Action title="Back to today" onPress={() => router.replace("/home")} /></Screen>;

  const pathScenarios = scenarios ?? [];
  const completedIndex = completedScenarioId ? pathScenarios.findIndex(scenario => scenario.id === completedScenarioId) : -1;
  const activeIndex = completedIndex >= 0 ? completedIndex + 1 : 0;
  const activeScenario = pathScenarios[activeIndex];
  const module = modules.find(item => item.id === moduleId);

  async function startPractice(scenario: Scenario) {
    setStartingScenario(scenario.id);
    setError("");
    try {
      const result = await request<{ conversation: { id: string } }>("/v1/me/conversations", auth.token, "POST", { scenarioId: scenario.id });
      router.push(`/practice/${result.conversation.id}`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStartingScenario("");
    }
  }

  return <Screen>
    <Heading eyebrow="Practice path">{pathTitles[moduleId]}</Heading>
    <Copy>{module?.description ?? "Build your communication skills one exercise at a time."}</Copy>
    {completedIndex >= 0 && <Card tone="accent"><Heading eyebrow="Exercise complete">Nice work. Let’s keep going.</Heading><Copy>Your response and independent retry are saved. Continue with the next exercise, or explore more examples below.</Copy></Card>}
    {scenarios === null && !error && <Copy>Loading your exercises…</Copy>}
    {error && <><Copy error>{error}</Copy><Action title="Retry" secondary onPress={() => void load()} /></>}
    {activeScenario ? <Card>
      <Heading eyebrow={`Exercise ${activeIndex + 1} of ${pathScenarios.length}`}>{activeScenario.title}</Heading>
      <Copy>{activeScenario.context}</Copy>
      <Copy>{activeScenario.question}</Copy>
      <Copy>Focus: {activeScenario.focus}</Copy>
      <Action title="Start this exercise" icon="play" busy={startingScenario === activeScenario.id} disabled={Boolean(startingScenario)} onPress={() => void startPractice(activeScenario)} />
    </Card> : scenarios !== null && pathScenarios.length > 0 ? <Card tone="accent">
      <Heading eyebrow="Path complete">You’ve finished these exercises.</Heading>
      <Copy>You can revisit them or practice with more examples whenever you’re ready.</Copy>
    </Card> : scenarios !== null ? <Copy>No exercises are available in this path yet. Try another workshop or come back later.</Copy> : null}
    <Card>
      <Heading eyebrow="Keep building your skills">Practice with more examples</Heading>
      <Copy>Explore other exercises in this workshop and choose the one you want to try next.</Copy>
      <Action title={showExamples ? "Hide other examples" : "Practice with more examples"} secondary onPress={() => setShowExamples(value => !value)} />
      {showExamples && pathScenarios.filter(scenario => scenario.id !== activeScenario?.id).map((scenario, index) => <Card key={scenario.id}>
        <Heading eyebrow={`Example ${index + 1}`}>{scenario.title}</Heading>
        <Copy>{scenario.context}</Copy>
        <Action title="Practice this example" disabled={Boolean(startingScenario)} busy={startingScenario === scenario.id} onPress={() => void startPractice(scenario)} />
      </Card>)}
      {showExamples && pathScenarios.length <= 1 && <Copy>There are no additional examples in this path yet.</Copy>}
    </Card>
    <Action title="Back to today" secondary onPress={() => router.replace("/home")} />
  </Screen>;
}

