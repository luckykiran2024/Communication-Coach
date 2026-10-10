import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { profileSchema, scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { productionConfigurationErrors } from "../src/config";

test("serverless: cron refuses missing or incorrect credentials, supports Vercel GET and idempotent POST", async context => {
  const store = new MemoryStore();
  let calls = 0;
  store.expireVoiceSessions = async () => { calls += 1; return 0; };
  const app = await buildApp(store, { cronSecret: "a-secure-test-scheduler-secret", runtime: "serverless" });
  context.after(() => app.close());
  const url = "/internal/cron/reap-voice-sessions";
  assert.equal((await app.inject({ method: "POST", url })).statusCode, 401);
  assert.equal((await app.inject({ url, headers: { authorization: "Bearer incorrect" } })).statusCode, 401);
  assert.equal(calls, 0);
  assert.equal((await app.inject({ url, headers: { authorization: "Bearer a-secure-test-scheduler-secret" } })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url,
    headers: { "x-cron-secret": "a-secure-test-scheduler-secret" } })).statusCode, 200);
  assert.equal(calls, 2);
  const disabled = await buildApp(store, { cronSecret: "" });
  context.after(() => disabled.close());
  assert.equal((await disabled.inject({ url })).statusCode, 503);
});

test("serverless: rate counters span application instances, reset on expiry and fail closed on storage failure", async context => {
  const store = new MemoryStore();
  let now = new Date("2026-10-10T10:00:00Z");
  const options = { rateLimitMax: 3, now: () => now };
  const first = await buildApp(store, options);
  const second = await buildApp(store, options);
  context.after(async () => { await first.close(); await second.close(); });
  for (const app of [first, second, first]) assert.equal((await app.inject({ url: "/health" })).statusCode, 200);
  assert.equal((await second.inject({ url: "/health" })).statusCode, 429);
  now = new Date(now.getTime() + 60000);
  assert.equal((await second.inject({ url: "/health" })).statusCode, 200);
  store.incrementRateLimit = async () => { throw new Error("offline"); };
  assert.equal((await first.inject({ url: "/health" })).statusCode, 503);
  const errors = productionConfigurationErrors({ nodeEnv: "production", vercel: true, rateLimitStorage: "memory",
    devMemoryStore: true, corsOrigins: [], managerEmails: [], realtimeEnabled: false, billingEnabled: false,
    storeVerifierConfigured: false });
  assert.ok(errors.some(error => error.includes("shared PostgreSQL")));
  assert.ok(errors.some(error => error.includes("CRON_SECRET")));
});

test("progress: measured settled seconds, not target length, drive minutes; text sessions and missing durations stay separate",
  async context => {
    const store = new MemoryStore();
    const now = new Date("2026-10-10T10:00:00Z");
    const app = await buildApp(store, { now: () => now, assessment: { enabled: false } });
    context.after(() => app.close());
    const registration = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: {
      email: "measured@example.com", password: "measured-voice-password",
    } })).json();
    const userId = registration.user.id;
    await store.saveProfile(userId, profileSchema.parse({ displayName: "Maya", function: "Engineering", jobTitle: "Engineer",
      careerLevel: "First-time manager", audience: "Team", goal: "Explain ideas clearly", practiceMinutes: 20 }));
    const conversationIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const id = randomUUID(); conversationIds.push(id);
      await store.createConversation({ id, userId, scenarioId: scenarios[0].id, scenarioSnapshot: scenarios[0],
        state: "COMPLETED", createdAt: now, updatedAt: now });
      await store.addConversationTurn({ id: randomUUID(), sessionId: id, role: "user", phase: "primary",
        text: "I recommend a clear next action because the deadline matters.", createdAt: now });
    }
    for (const seconds of [70, 35]) {
      const id = randomUUID(); const reservationId = randomUUID();
      await store.reserveUsage({ id: reservationId, userId, dayKey: "2026-10-10", seconds: 420,
        expiresAt: new Date(now.getTime() + 420000) }, 2000);
      await store.createVoiceSession({ id, userId, conversationId: conversationIds[0], reservationId, monthKey: "2026-10",
        providerSessionId: "fake", providerCallId: null, providerTerminatedAt: null, status: "active", startedAt: now,
        expiresAt: new Date(now.getTime() + 420000), endedAt: null });
      await store.endVoiceSession(userId, id, new Date(now.getTime() + seconds * 1000), "ended", seconds);
    }
    store.conversationTurns = async () => { throw new Error("N+1 turns query prohibited"); };
    await store.createVoiceSession({ id: randomUUID(), userId, conversationId: conversationIds[0],
      reservationId: randomUUID(), monthKey: "2026-10", providerSessionId: "missing-reservation", providerCallId: null,
      providerTerminatedAt: null, status: "ended", startedAt: now, expiresAt: now, endedAt: now });
    store.assessment = async () => { throw new Error("N+1 assessment query prohibited"); };
    const result = await app.inject({ url: "/v1/me/progress", headers: { authorization: `Bearer ${registration.token}` } });
    assert.equal(result.statusCode, 200);
    const progress = result.json();
    assert.equal(progress.measuredVoiceSeconds, 105);
    assert.equal(progress.practiceMinutes, 1.75);
    assert.equal(progress.weeklyPracticeMinutes, 1.75);
    assert.equal(progress.textSessions, 2);
    assert.equal(progress.dailyPractice.at(-1).minutes, 1.75);
    assert.equal(progress.unknownVoiceDurations, 1);
    assert.equal((await store.learningRecords("another-owner")).length, 0);
  });
