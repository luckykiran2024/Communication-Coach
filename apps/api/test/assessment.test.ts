import { test, type TestContext } from "node:test";
import { legalConsent } from "./legal-consent";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { assessmentRubrics, scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { OpenAIAssessmentProvider, type AssessmentProvider } from "../src/assessment-provider";
import type { AccountEmail } from "../src/email-sender";
import { coachingReviewFixture, priorityCoachingFixture } from "../../../packages/core/test/coaching-review.fixture";

const scenario = scenarios.find(item => item.module === "daily")!;
const model = "test-assessment";
const primary = "The handoff is ready because testing passed. Next, Maya will review it by Friday.";
const retry = "The dependency changed. I recommend pausing rollout; Ravi will confirm the revised date tomorrow.";
async function setup(context: TestContext, provider?: AssessmentProvider, enabled = true, timeoutMs = 30000) {
  const store = new MemoryStore();
  const app = await buildApp(store, { assessment: { enabled, provider, apiKey: "", model, timeoutMs } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
    email: "assessment-route@example.com", password: "assessment-password-123",
  } });
  const { token, user } = registration.json();
  await store.markEmailVerified(user.id, new Date());
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
    rubricVersion: assessmentRubrics[scenario.module].version, modelVersion: model, audioAssessed: false as const, transferResult,
    coachingReview: coachingReviewFixture(turnId, quote),
    priorities: [{ observation: "You name a next owner.", quote, turnId, nextExercise: "State the decision in one sentence.",
      confidence: "medium" as const, coaching: priorityCoachingFixture }],
  }, inputTokens: 120, outputTokens: 40, costMicros: 15 };
}

test("assessment: valid grounded feedback is owner-only, persistent and used for mastery", async context => {
  const fixture = await setup(context, { assess: async input => output(input.turns[1].id) });
  assert.equal((await fixture.complete()).statusCode, 200);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "FEEDBACK_READY");
  const feedback = await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}/feedback`, headers: fixture.headers });
  assert.deepEqual(feedback.json().feedback.coachingReview, coachingReviewFixture(fixture.turns[1].id, retry));
  assert.equal(feedback.json().scenario.title, scenario.title);
  assert.equal(feedback.json().feedback.priorities[0].coaching.title, priorityCoachingFixture.title);
  assert.equal(feedback.statusCode, 200);
  assert.equal(feedback.json().feedback.priorities.length, 1);
  const progress = (await fixture.app.inject({ url: "/v1/me/progress", headers: fixture.headers })).json();
  assert.equal(progress.successfulRetries, 1);
  assert.equal(progress.skillSignal, null);
  assert.equal(progress.evidenceSource, "ai_assessment");
  const other = (await fixture.app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
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
    assert.equal(Object.keys(JSON.parse(body.input).coachingAreas).length, 7);
    assert.ok(body.text.format.schema.required.includes("coachingReview"));
    assert.match(body.instructions, /hypothetical rewrite/);
    assert.match(body.instructions, /No claim of past improvement/);
    return Response.json({ status: "completed", usage: { input_tokens: 12, output_tokens: 4 },
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] });
  } });
  const result = await provider.assess({ scenario, model, signal: new AbortController().signal,
    turns: [{ id: "turn", sessionId: "session", role: "user", phase: "primary", text: primary, createdAt: new Date() }] });
  assert.equal(result.costMicros, null);
  assert.equal(result.inputTokens, 12);
});

test("coaching review API: invented score evidence fails closed even when priority quotes are valid", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => {
    calls += 1;
    const result = output(input.turns[1].id);
    result.value.coachingReview.scores[0].evidence[0].quote = "An invented opening";
    return result;
  } });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(calls, 2);
  assert.equal(await fixture.store.assessment(fixture.user.id, fixture.id), null);
  assert.equal((await fixture.store.conversationTurns(fixture.user.id, fixture.id)).length, 2);
});

test("coaching review API: new output without detailed coaching is rejected rather than filled with fake scores", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => {
    calls += 1;
    const result = output(input.turns[1].id);
    const { coachingReview: _review, ...legacy } = result.value;
    return { ...result, value: legacy };
  } });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(calls, 2);
  assert.equal(await fixture.store.assessment(fixture.user.id, fixture.id), null);
});

test("coaching review API: earlier saved feedback remains owner-readable without a fabricated scorecard", async context => {
  const fixture = await setup(context, undefined, false);
  const { coachingReview: _review, ...legacy } = output(fixture.turns[1].id).value;
  const priorities = legacy.priorities.map(({ coaching: _coaching, ...priority }) => priority);
  await fixture.store.saveAssessment(fixture.user.id, {
    ...legacy, priorities, rubricVersion: "tasc-assessment-1", transferResult: "demonstrated",
    id: randomUUID(), conversationId: fixture.id, inputTokens: 100, outputTokens: 50, costMicros: null, createdAt: new Date(),
  });
  await fixture.store.updateConversationState(fixture.user.id, fixture.id, "FEEDBACK_READY");
  const response = await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}/feedback`, headers: fixture.headers });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().feedback.coachingReview, undefined);
  assert.equal(response.json().feedback.priorities[0].quote, retry);
});

test("assessment: verified email is required before a paid call, without closing practice", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => { calls += 1; return output(input.turns[1].id); } });
  fixture.store.accounts.get(fixture.user.id)!.emailVerifiedAt = null;
  assert.equal((await fixture.complete()).statusCode, 403);
  assert.equal(calls, 0);
  assert.equal(fixture.store.assessmentRunRows.size, 0);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "CREATED");
});

test("assessment: failed feedback can be retried explicitly, concurrent retries cannot duplicate paid calls", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => {
    calls += 1;
    if (calls === 1) throw new Error("network lost");
    return output(input.turns[1].id);
  } });
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(calls, 1);
  const detail = await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}`, headers: fixture.headers });
  assert.equal(detail.json().feedbackRetryAvailable, true);
  const retries = await Promise.all(Array.from({ length: 8 }, () => fixture.app.inject({
    method: "POST", url: `/v1/me/conversations/${fixture.id}/feedback/retry`, headers: fixture.headers,
  })));
  assert.ok(retries.some(result => result.statusCode === 200));
  assert.equal(calls, 2);
  assert.equal(fixture.store.assessmentRunRows.size, 2);
  assert.equal(fixture.store.assessmentUsageRows.size, 2);
  assert.equal([...fixture.store.assessmentUsageRows.values()][0].costMicros, null);
  const replay = await fixture.app.inject({
    method: "POST", url: `/v1/me/conversations/${fixture.id}/feedback/retry`, headers: fixture.headers,
  });
  assert.equal(replay.statusCode, 200);
  assert.equal(calls, 2);
  const other = await fixture.store.createAccount("retry-other@example.com", "unused");
  assert.equal(await fixture.store.assessment(other.id, fixture.id), null);
  const registration = (await fixture.app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
    email: "retry-route-other@example.com", password: "long-retry-owner-password",
  } })).json();
  assert.equal((await fixture.app.inject({ method: "POST", url: `/v1/me/conversations/${fixture.id}/feedback/retry`,
    headers: { authorization: `Bearer ${registration.token}` } })).statusCode, 404);
  assert.equal(calls, 2);
});

test("assessment: timeout aborts the foreground request; late results reconcile usage but cannot publish feedback", async context => {
  let release!: (result: ReturnType<typeof output>) => void;
  let signal: AbortSignal | undefined;
  const fixture = await setup(context, { assess: input => {
    signal = input.signal;
    assert.ok(input.requestId);
    return new Promise(resolve => { release = resolve; });
  } }, true, 10);
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(signal?.aborted, true);
  assert.equal([...fixture.store.assessmentUsageRows.values()][0].costMicros, null);
  release(output(fixture.turns[1].id));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal([...fixture.store.assessmentUsageRows.values()][0].costMicros, 15);
  assert.equal((await fixture.store.conversation(fixture.user.id, fixture.id))?.state, "FAILED");
  assert.equal(await fixture.store.assessment(fixture.user.id, fixture.id), null);
});

test("assessment: retries consume the daily allowance, and exhausted quota never calls the provider", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async () => { calls += 1; throw new Error("offline"); } });
  const app = await buildApp(fixture.store, { assessment: { enabled: true, provider: {
    assess: async () => { calls += 1; throw new Error("offline"); },
  }, dailyLimit: 1, model } });
  context.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${fixture.id}/complete`,
    headers: fixture.headers })).statusCode, 503);
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${fixture.id}/feedback/retry`,
    headers: fixture.headers })).statusCode, 429);
  assert.equal(calls, 1);
});

test("assessment provider: correlates requests and preserves provider IDs for billing reconciliation", async () => {
  const controller = new AbortController();
  const requestId = randomUUID();
  const provider = new OpenAIAssessmentProvider({ apiKey: "test-only", fetchImpl: async (_url, init) => {
    assert.equal(init?.signal, controller.signal);
    assert.equal(new Headers(init?.headers).get("X-Client-Request-Id"), requestId);
    return Response.json({ id: "resp_test", status: "completed", usage: { input_tokens: 10, output_tokens: 5 },
      output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] },
    { headers: { "x-request-id": "req_test" } });
  } });
  const result = await provider.assess({ scenario, turns: [], model, signal: controller.signal, requestId });
  assert.equal(result.providerRequestId, "req_test");
  assert.equal(result.providerResponseId, "resp_test");
});

test("assessment: deadline cancellation reaches the provider fetch and never automatically repeats a network failure", async context => {
  let fetchAborted = false;
  let calls = 0;
  const provider = new OpenAIAssessmentProvider({ apiKey: "fixture-only", fetchImpl: (_url, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => {
        fetchAborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
  } });
  const fixture = await setup(context, provider, true, 10);
  assert.equal((await fixture.complete()).statusCode, 503);
  assert.equal(fetchAborted, true);
  assert.equal(calls, 1);
  assert.equal(fixture.store.assessmentUsageRows.size, 1);
  assert.equal([...fixture.store.assessmentUsageRows.values()][0].costMicros, null);
});

test("assessment: reopening a killed review recovers the lease and offers an explicit retry", async context => {
  let calls = 0;
  const fixture = await setup(context, { assess: async input => { calls += 1; return output(input.turns[1].id); } });
  const run = await fixture.store.claimAssessmentRun(fixture.user.id, fixture.id, new Date(Date.now() - 120000), 10);
  assert.ok(run.expiresAt < new Date());
  const detail = await fixture.app.inject({ url: `/v1/me/conversations/${fixture.id}`, headers: fixture.headers });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().conversation.state, "FAILED");
  assert.equal(detail.json().feedbackRetryAvailable, true);
  assert.equal(calls, 0);
  assert.equal((await fixture.app.inject({ method: "POST", url: `/v1/me/conversations/${fixture.id}/feedback/retry`,
    headers: fixture.headers })).statusCode, 200);
  assert.equal(calls, 1);
});

test("learner journey: onboarding, practice, feedback recovery, next exercise and measured progress", async context => {
  const store = new MemoryStore();
  const emails: AccountEmail[] = [];
  let calls = 0;
  const app = await buildApp(store, {
    devPlanId: "free", email: { sender: { async send(email) { emails.push(email); } } },
    assessment: { enabled: true, model, provider: { assess: async input => {
      calls += 1;
      if (calls === 1) throw new Error("Simulated interrupted provider connection");
      return output(input.turns.find(turn => turn.phase === "independent_retry")!.id);
    } } },
  });
  context.after(() => app.close());
  const password = "learner-journey-fixture-password";
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
    email: "learner-journey@example.com", password,
  } });
  assert.equal(registration.statusCode, 201);
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const post = (url: string, payload?: Record<string, unknown>) => app.inject({ method: "POST", url, headers, payload });
  assert.equal((await post("/v1/auth/verify-email/request")).statusCode, 200);
  assert.equal((await post("/v1/auth/verify-email/confirm", { token: emails[0].token, password })).statusCode, 200);
  assert.equal((await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: {
    displayName: "Maya", function: "Engineering", jobTitle: "Engineer", careerLevel: "First-time manager",
    audience: "Team", goal: "Explain ideas clearly",
  } })).statusCode, 200);
  const catalog = await app.inject({ url: "/v1/me/scenarios", headers });
  assert.equal(catalog.statusCode, 200);
  const selected = catalog.json().scenarios[0];
  assert.equal(selected.module, "daily");
  const created = await post("/v1/me/conversations", { scenarioId: selected.id });
  assert.equal(created.statusCode, 201);
  const id = created.json().conversation.id;
  const path = `/v1/me/conversations/${id}`;
  assert.equal((await post(`${path}/turns`, { role: "user", text: primary })).json().turn.phase, "primary");
  assert.equal((await post(`${path}/advance`)).statusCode, 200);
  assert.equal((await post(`${path}/turns`, { role: "user", text: retry })).json().turn.phase, "independent_retry");
  assert.equal((await post(`${path}/complete`)).statusCode, 503);
  assert.equal((await app.inject({ url: path, headers })).json().feedbackRetryAvailable, true);
  assert.equal((await post(`${path}/feedback/retry`)).statusCode, 200);
  const feedback = await app.inject({ url: `${path}/feedback`, headers });
  assert.equal(feedback.statusCode, 200);
  assert.equal(feedback.json().feedback.priorities[0].quote, retry);
  assert.ok(feedback.json().nextScenarioId);
  assert.notEqual(feedback.json().nextScenarioId, selected.id);
  assert.equal((await post("/v1/me/conversations", { scenarioId: feedback.json().nextScenarioId })).statusCode, 201);
  const progress = (await app.inject({ url: "/v1/me/progress", headers })).json();
  assert.equal(progress.completedSessions, 1);
  assert.equal(progress.evidenceAssessments, 1);
  assert.equal(progress.successfulRetries, 1);
  assert.equal(progress.currentStreakDays, 1);
  assert.equal(progress.weeklySessions, 1);
  assert.equal(progress.measuredVoiceSeconds, 0);
  assert.equal(progress.skillSignal, null);
  assert.equal(calls, 2);
});
