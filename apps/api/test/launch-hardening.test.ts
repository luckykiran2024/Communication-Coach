import { test } from "node:test";
import { legalConsent } from "./legal-consent";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { profileSchema, scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { createRouteDependencies } from "../src/lib/create-route-dependencies";
import { learnerScenarioProgress } from "../src/lib/progress";
import { progressSnapshot } from "../src/lib/progress-snapshot";
import { productionConfigurationErrors } from "../src/config";
import { runtimeEnvironmentSchema } from "../src/runtime-env";
import type { LearningRecord } from "../src/store";
import { coachingReviewFixture } from "../../../packages/core/test/coaching-review.fixture";

test("launch: production billing-off is always free except the paid-provider-disabled dedicated test project", async () => {
  const names = ["NODE_ENV", "COACH_TEST_BACKEND", "VERCEL_PROJECT_ID"];
  const previous = names.map(name => process.env[name]);
  try {
    process.env.NODE_ENV = "production";
    process.env.COACH_TEST_BACKEND = "true";
    for (const [project, assessment, voice, expected] of [
      ["production-project", false, false, "free"],
      ["prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf", true, false, "free"],
      ["prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf", false, true, "free"],
      ["prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf", false, false, "executive"],
    ] as const) {
      process.env.VERCEL_PROJECT_ID = project;
      const deps = await createRouteDependencies(new MemoryStore(), {
        billing: { enabled: false }, devPlanId: "executive", assessment: { enabled: assessment }, voice: { enabled: voice },
      });
      assert.equal((await deps.activePlan(randomUUID())).id, expected);
    }
    process.env.COACH_TEST_BACKEND = "false";
    const deps = await createRouteDependencies(new MemoryStore(), {
      billing: { enabled: false }, devPlanId: "executive", assessment: { enabled: false }, voice: { enabled: false },
    });
    assert.equal((await deps.activePlan(randomUUID())).id, "free");
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});

test("launch: unverified accounts cannot create paid voice calls or reserve free voice allowances", async context => {
  const store = new MemoryStore();
  let calls = 0;
  const app = await buildApp(store, { voice: { enabled: true, apiKey: "fixture-only", fetchImpl: async () => {
    calls += 1;
    throw new Error("Must not call provider");
  } } });
  context.after(() => app.close());
  const registration = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
    email: "unverified-voice@example.com", password: "unverified-voice-test-password",
  } })).json();
  const result = await app.inject({ method: "POST", url: "/v1/voice/sessions",
    headers: { authorization: `Bearer ${registration.token}` },
    payload: { conversationId: randomUUID(), scenarioId: scenarios[0].id } });
  assert.equal(result.statusCode, 403);
  assert.match(result.json().error, /Verify your email/);
  assert.equal(calls, 0);
  assert.equal(store.reservations.size, 0);
  assert.equal(await store.totalVoiceSessions(registration.user.id), 0);
});

test("launch: assessment quota configuration is bounded and enabled feedback requires a server key", () => {
  assert.equal(runtimeEnvironmentSchema.parse({}).ASSESSMENT_DAILY_LIMIT, 10);
  for (const limit of ["0", "101", "1.5", "invalid"]) {
    assert.equal(runtimeEnvironmentSchema.safeParse({ ASSESSMENT_DAILY_LIMIT: limit }).success, false);
  }
  const errors = productionConfigurationErrors({ nodeEnv: "production", devMemoryStore: false,
    corsOrigins: [], managerEmails: [], realtimeEnabled: false, billingEnabled: false,
    storeVerifierConfigured: false, assessmentEnabled: true });
  assert.ok(errors.some(error => error.includes("ASSESSMENT_ENABLED")));
  assert.deepEqual(productionConfigurationErrors({ nodeEnv: "development", vercel: true, devMemoryStore: true,
    corsOrigins: [], managerEmails: [], realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false }),
  ["Vercel deployments must use NODE_ENV=production."]);
});

test("launch: streaks, weekly activity and mastery days use actual learner answers, not conversation creation", async () => {
  const profile = profileSchema.parse({ displayName: "Maya", function: "Engineering", jobTitle: "Engineer",
    careerLevel: "First-time manager", audience: "Team", goal: "Explain ideas clearly", timezone: "Asia/Kolkata" });
  const now = new Date("2026-10-10T10:00:00Z");
  const createdAt = new Date("2026-09-01T10:00:00Z");
  const record: LearningRecord = { conversation: {
    id: randomUUID(), userId: randomUUID(), scenarioId: scenarios[0].id, state: "COMPLETED", createdAt, updatedAt: now,
  }, assessment: null, turns: [
    { id: randomUUID(), sessionId: "unused", role: "user", phase: "primary", text: "First response",
      createdAt: new Date("2026-10-09T10:00:00Z") },
    { id: randomUUID(), sessionId: "unused", role: "user", phase: "independent_retry", text: "Retry response", createdAt: now },
  ] };
  const empty: LearningRecord = { ...record, conversation: { ...record.conversation, id: randomUUID(), createdAt: now }, turns: [] };
  const result = progressSnapshot([record, empty], [], profile, now, false);
  assert.equal(result.currentStreakDays, 2);
  assert.equal(result.practiceDays, 2);
  assert.equal(result.weeklySessions, 1);
  assert.equal(result.dailyPractice.at(-1)?.textSessions, 1);
  assert.equal(result.dailyPractice.at(-2)?.textSessions, 1);
  assert.equal(result.practiceMinutes, 0);
  const store = new MemoryStore();
  store.learningRecords = async () => [record, empty];
  const progress = await learnerScenarioProgress(store, record.conversation.userId, profile);
  assert.equal(progress.mastery.practiceDays, 2);
});

test("launch: progress exposes evidence-backed cumulative coaching ratings and movement", () => {
  const profile = profileSchema.parse({ displayName: "Maya", function: "Engineering", jobTitle: "Engineer",
    careerLevel: "First-time manager", audience: "Team", goal: "Explain ideas clearly", timezone: "Asia/Kolkata" });
  const now = new Date("2026-10-10T10:00:00Z");
  const makeRecord = (day: number, improvement: number): LearningRecord => {
    const conversationId = randomUUID();
    const turnId = randomUUID();
    const quote = "I recommend confirming the dependency before committing.";
    const review = coachingReviewFixture(turnId, quote);
    review.scores = review.scores.map(item => ({ ...item,
      score: item.score === null ? null : Math.min(10, item.score + improvement) }));
    return {
      conversation: { id: conversationId, userId: randomUUID(), scenarioId: scenarios[0].id,
        state: "FEEDBACK_READY", createdAt: new Date(2026, 9, day), updatedAt: new Date(2026, 9, day) },
      turns: [{ id: turnId, sessionId: conversationId, role: "user", phase: "independent_retry", text: quote,
        createdAt: new Date(2026, 9, day) }],
      assessment: { id: randomUUID(), conversationId, rubricVersion: "fixture", modelVersion: "fixture",
        priorities: [], audioAssessed: false, transferResult: "demonstrated", coachingReview: review,
        inputTokens: 1, outputTokens: 1, costMicros: 1, createdAt: new Date(2026, 9, day) },
    };
  };
  const result = progressSnapshot([makeRecord(8, 0), makeRecord(9, 1)], [], profile, now, true);
  assert.deepEqual(result.assessmentTrend.map(item => [item.score, item.cumulativeScore]), [[7.9, 7.9], [8.9, 8.4]]);
  assert.equal(result.cumulativeScore, 8.4);
  assert.equal(result.scoreMovement, 0.5);
  assert.equal(result.areaRatings.find(item => item.area === "opening")?.score, 8.5);
});

test("launch: future and assistant-only turns do not count as activity; unfinished learner work does", () => {
  const profile = profileSchema.parse({ displayName: "Maya", function: "Engineering", jobTitle: "Engineer",
    careerLevel: "First-time manager", audience: "Team", goal: "Explain ideas clearly", timezone: "Asia/Kolkata" });
  const now = new Date("2026-10-10T19:00:00Z");
  const record: LearningRecord = { conversation: {
    id: randomUUID(), userId: randomUUID(), scenarioId: scenarios[0].id, state: "CREATED", createdAt: now, updatedAt: now,
  }, assessment: null, turns: [
    { id: randomUUID(), sessionId: "unused", role: "assistant", phase: "primary", text: "Coach words", createdAt: now },
    { id: randomUUID(), sessionId: "unused", role: "user", phase: "primary", text: "Future",
      createdAt: new Date(now.getTime() + 86400000) },
  ] };
  assert.equal(progressSnapshot([record], [], profile, now, false).currentStreakDays, 0);
  record.turns.push({ ...record.turns[1], id: randomUUID(), text: "Learner answer", createdAt: now });
  const result = progressSnapshot([record], [], profile, now, false);
  assert.equal(result.currentStreakDays, 1);
  assert.equal(result.practiceDays, 0);
  assert.equal(result.weeklySessions, 1);
  assert.equal(result.dailyPractice.at(-1)?.day, "10-11");
});

test("launch: authenticated cleanup recovers stuck assessments without a voice provider", async context => {
  const store = new MemoryStore();
  const now = new Date();
  const owner = await store.createAccount("cron-assessment@example.com", "unused");
  await store.markEmailVerified(owner.id, now);
  const id = randomUUID();
  await store.createConversation({ id, userId: owner.id, scenarioId: scenarios[0].id,
    state: "CREATED", createdAt: now, updatedAt: now });
  const run = await store.claimAssessmentRun(owner.id, id, now, 10);
  const app = await buildApp(store, { runtime: "serverless", voice: { enabled: false }, cronSecret: "test-cleanup-only",
    now: () => new Date(run.expiresAt.getTime() + 1) });
  context.after(() => app.close());
  assert.equal((await app.inject({ url: "/internal/cron/reap-voice-sessions" })).statusCode, 401);
  assert.equal((await store.conversation(owner.id, id))?.state, "ASSESSING");
  assert.equal((await app.inject({ url: "/internal/cron/reap-voice-sessions",
    headers: { authorization: "Bearer test-cleanup-only" } })).statusCode, 200);
  assert.equal((await store.conversation(owner.id, id))?.state, "FAILED");
});

test("launch: public catalog excludes drafts and deprecated content; only verified managers can list unpublished work", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { managerEmails: ["content-manager@example.com"] });
  context.after(() => app.close());
  await store.createCustomScenario({ ...scenarios[0], id: "deprecated-launch-fixture", reviewStatus: "deprecated" });
  const publicCatalog = await app.inject({ url: "/v1/scenarios/library" });
  assert.equal(publicCatalog.statusCode, 200);
  const items = publicCatalog.json().scenarios as { id: string; reviewStatus?: string }[];
  assert.ok(items.length >= 100);
  assert.ok(items.every(item => !item.reviewStatus || item.reviewStatus === "published"));
  assert.equal(items.some(item => item.id === "deprecated-launch-fixture"), false);
  assert.equal((await app.inject({ url: "/v1/manager/scenarios" })).statusCode, 401);
  const manager = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...legalConsent,
    email: "content-manager@example.com", password: "content-manager-test-password",
  } })).json();
  const headers = { authorization: `Bearer ${manager.token}` };
  assert.equal((await app.inject({ url: "/v1/manager/scenarios", headers })).statusCode, 403);
  await store.markEmailVerified(manager.user.id, new Date());
  const privateCatalog = await app.inject({ url: "/v1/manager/scenarios", headers });
  assert.equal(privateCatalog.statusCode, 200);
  assert.ok(privateCatalog.json().scenarios.some((item: { reviewStatus?: string }) => item.reviewStatus === "draft"));
  assert.ok(privateCatalog.json().scenarios.some((item: { id: string }) => item.id === "deprecated-launch-fixture"));
});
