import { useEffect, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import type { FeedbackAssessment } from "@coach/core";
import { useAuth } from "../../src/auth";
import { request } from "../../src/api";
import { Action, Card, Copy, Heading, Screen } from "../../src/ui";

type Feedback = { feedback: FeedbackAssessment; nextScenarioId: string | null };

export default function FeedbackScreen() {
  const auth = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (auth.token && id) request<Feedback>(`/v1/me/conversations/${id}/feedback`, auth.token)
      .then(value => { if (active) setResult(value); })
      .catch(failure => { if (active) setError((failure as Error).message); });
    return () => { active = false; };
  }, [auth.token, id]);
  if (auth.loading) return <Screen><Copy>Loading your session…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  async function practiceNext() {
    if (!result?.nextScenarioId) return;
    setBusy(true); setError("");
    try {
      const next = await request<{ conversation: { id: string } }>("/v1/me/conversations", auth.token, "POST", {
        scenarioId: result.nextScenarioId,
      });
      router.push(`/practice/${next.conversation.id}`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading eyebrow="Your practice review">One insight. A stronger next conversation.</Heading>
    <Copy>AI feedback checks your saved words against an observable rubric. It does not assess audio, accent or personality.</Copy>
    {error ? <Copy error>{error}</Copy> : !result && <Copy>Loading verified feedback…</Copy>}
    {result && <>
      <Card><Heading eyebrow="Independent transfer">{result.feedback.transferResult.replaceAll("_", " ")}</Heading>
        <Copy>Rubric: {result.feedback.rubricVersion} · Model: {result.feedback.modelVersion}</Copy>
      </Card>
      {result.feedback.priorities.map((priority, index) => <Card key={`${priority.turnId}-${index}`}>
        <Heading eyebrow={`Priority ${index + 1}`}>{priority.observation}</Heading>
        <Copy>“{priority.quote}”</Copy>
        <Copy>Next exercise: {priority.nextExercise}</Copy>
        <Copy>Evidence confidence: {priority.confidence}</Copy>
      </Card>)}
      {result.feedback.priorities.length === 0 &&
        <Copy>No priority was identified in this review; this is not a perfect-score claim.</Copy>}
      <Action title="Practice this next" disabled={!result.nextScenarioId || busy} busy={busy} onPress={() => void practiceNext()} />
    </>}
    <Action secondary title="Back to today" onPress={() => router.replace("/home")} />
  </Screen>;
}
