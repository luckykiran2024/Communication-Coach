import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assessmentRubrics, scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { OpenAIAssessmentProvider, type AssessmentProvider } from "../src/assessment-provider";

const scenario = scenarios.find(item => item.module === "daily")!;
const model = "test-assessment";
const primary = "The handoff is ready because testing passed. Next, Maya will review it by Friday.";
const retry = "The dependency changed. I recommend pausing rollout; Ravi will confirm the revised date tomorrow.";
async function setup(context: TestContext, provider?: AssessmentProvider, enabled = true, timeoutMs = 30000) {
  const store = new MemoryStore();
  const app = await buildApp(store, { assessment: { enabled, provider, apiKey: "", model, timeoutMs } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: {
    email: "assessment-route@example.com", password: "assessment-password-123",
  } });
  const { token, user } = registration.json();
  const headers = { authorization: `Bearer ${token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: {
    displayName: "Asha", function: "Engineering", jobTitle: "Engineer", careerLevel: "First-time manager",
    audience: "My team", goal: "Explain ideas clearly",
  } });
  const id = randomUUID();
  await store.createConversation({ id, userId: user.id, scenarioId: scenario.id, scenarioSnapshot: scenario,
    state: "CREATED", createdAt: new Date(), updatedAt: new Date() });
  const turns = [
    { id: randomUUID(), sessionId: id, role: "user" as const, phase: "primary" as const, text: primary, createdAt: new Date() },
    { id: randomUUID(), sessionId: id, role: "user" as const, phase: "independent_retry" as const,
      text: retry, createdAt: new Date() },
  ];
  for (const turn of turns) await store.addConversationTurn(turn);
  return { store, app, id, headers, user, turns,
    complete: () => app.inject({ method: "POST", url: `/v1/me/conversations/${id}/complete`, headers }) };
}
function output(turnId: string, quote = retry, transferResult = "demonstrated") {
  return { value: {
    rubricVersion: assessmentRubrics[scenario.module].version, modelVersion: model, audioAssessed: false, transferResult,
    priorities: [{ observation: "You name a next owner.", quote, turnId, nextExercise: "State the decision in one sentence.",
      confidence: "medium" }],
  }, inputTokens: 120, outputTokens: 40, costMicros: 15 };
}

test("assessment: valid grounded feedback is owner-only, persistent and used for mastery", async context => {
  const fixture = await setup(context, { assess: async input => output(input.turns[1].id) });
  assert.equal((await fixture.complete()).statusCode, 200);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "FEEDBACK_READY");
  const feedback = await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}/feedback`, headers: fixture.headers });
  assert.equal(feedback.statusCode, 200);
  assert.equal(feedback.json().feedback.priorities.length, 1);
  const progress = (await fixture.app.inject({ url: "/v1/me/progress", headers: fixture.headers })).json();
  assert.equal(progress.successfulRetries, 1);
  assert.equal(progress.skillSignal, null);
  assert.equal(progress.evidenceSource, "ai_assessment");
  const other = (await fixture.app.inject({ method: "POST", url: "/v1/auth/register", payload: {
    email: "other-assessment@example.com", password: "assessment-password-123",
  } })).json();
  assert.equal((await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}/feedback`,
    headers: { authorization: `Bearer ${other.token}` } })).statusCode, 404);
  assert.equal((await fixture.complete()).statusCode, 409);
});

test("assessment: hallucinated quotes retry once, fail closed and retain learner turns", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => { calls += 1; return output(input.turns[1].id, "Invented quote"); } });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(calls, 2);
  assert.equal(fixture.store.assessmentUsageRows.size, 2);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "FAILED");
  assert.equal((await fixture.store.conversationTurns(fixture.user.id, fixture.id)).length, 2);
  assert.equal(await fixture.store.assessment(fixture.user.id, fixture.id), null);
});

test("assessment: a corrected retry succeeds and all paid attempts stay in the usage ledger", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => {
    calls += 1;
    return output(input.turns[1].id, calls === 1 ? "not in the transcript" : retry, "partial");
  } });
  assert.equal((await fixture.complete()).statusCode, 200);
  assert.equal(calls, 2);
  assert.equal([...fixture.store.assessmentUsageRows.values()].reduce((sum, item) => sum + item.costMicros!, 0), 30);
  assert.equal((await fixture.app.inject({ url: "/v1/me/progress", headers: fixture.headers })).json().successfulRetries, 0);
});

test("assessment: more than two priorities are rejected", async context => {
  const fixture = await setup(context, { assess: async input => {
    const result = output(input.turns[1].id);
    result.value.priorities.push(result.value.priorities[0], result.value.priorities[0]);
    return result;
  } });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(fixture.store.assessmentRows.size, 0);
});

test("assessment: an exact assistant quote is still rejected as non-learner evidence", async context => {
  const assistantId = randomUUID();
  const fixture = await setup(context, { assess: async () => output(assistantId, "Coach-only words") });
  await fixture.store.addConversationTurn({ id: assistantId, sessionId: fixture.id, role: "assistant", phase: "primary",
    text: "Coach-only words", createdAt: new Date() });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(fixture.store.assessmentUsageRows.size, 2);
  assert.equal(fixture.store.assessmentRows.size, 0);
});

test("assessment: missing provider preserves editable practice; disabled flag labels the local check", async context => {
  const missing = await setup(context);
  assert.equal((await missing.complete()).statusCode, 503);
  assert.equal((await missing.store.conversation(missing.user.id, missing.id))?.state, "CREATED");
  const disabled = await setup(context, undefined, false);
  const response = await disabled.complete();
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().evidenceSource, "local_check");
  assert.equal(disabled.store.assessmentRows.size, 0);
});

test("assessment: concurrent completes admit one assessment and timeout is bounded even for an ignoring provider", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => { calls += 1; return output(input.turns[1].id); } });
  const results = await Promise.all(Array.from({ length: 10 }, () => fixture.complete()));
  assert.equal(results.filter(result => result.statusCode === 200).length, 1);
  assert.equal(calls, 1);
  const hung = await setup(context, { assess: () => new Promise(() => undefined) }, true, 10);
  assert.equal((await hung.complete()).statusCode, 503);
  assert.equal([...hung.store.assessmentUsageRows.values()][0].costMicros, null);
});

test("assessment: a missing legacy scenario does not claim completion or call the provider", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => { calls += 1; return output(input.turns[1].id); } });
  const conversation = (await fixture.store.conversation(fixture.user.id, fixture.id))!;
  await fixture.store.createConversation({ ...conversation, scenarioId: "removed-legacy-scenario", scenarioSnapshot: undefined });
  assert.equal((await fixture.complete()).statusCode, 404);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "CREATED");
  assert.equal((await fixture.store.conversationTurns(fixture.user.id, fixture.id)).length, 2);
  assert.equal(calls, 0);
  assert.equal(fixture.store.assessmentUsageRows.size, 0);
});

test("assessment provider: sends strict Responses schema, no storage and only learner turns", async () => {
  const provider = new OpenAIAssessmentProvider({ apiKey: "fixture-secret", fetchImpl: async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    assert.deepEqual(body.text.format.schema.properties.audioAssessed.enum, [false]);
    assert.equal(body.text.format.schema.$schema, undefined);
    assert.equal(JSON.parse(body.input).turns.length, 1);
    return Response.json({ status: "completed", usage: { input_tokens: 12, output_tokens: 4 },
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] });
  } });
  const result = await provider.assess({ scenario, model, signal: new AbortController().signal,
    turns: [{ id: "turn", sessionId: "session", role: "user", phase: "primary", text: primary, createdAt: new Date() }] });
  assert.equal(result.costMicros, null);
  assert.equal(result.inputTokens, 12);
});
