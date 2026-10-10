import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prismaStore } from "../src/prisma-store";
import { buildApp } from "../src/app";
import { ConflictError } from "../src/store";
import type { AccountEmail } from "../src/email-sender";
import { createHash } from "node:crypto";
import { registerAssessmentStoreTests } from "./assessment-store-contract";
import { scenarios } from "@coach/core";
import type { Store } from "../src/store";
import { verifiedTestDatabaseUrl } from "./database-fixture";

const testTransactionOptions = { maxWait: 30000, timeout: 30000 };

function trackedRateStore(db: PrismaClient, keys: Set<string>) {
  const store = prismaStore(db);
  const increment = store.incrementRateLimit;
  store.incrementRateLimit = async (...args: Parameters<Store["incrementRateLimit"]>) => {
    keys.add(args[0]);
    return increment(...args);
  };
  return store;
}

test("PostgreSQL server phase, joined evidence, measured duration and cross-instance atomic rate limits", async context => {
  const url = verifiedTestDatabaseUrl();
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } },
    transactionOptions: testTransactionOptions, log: [{ emit: "event", level: "query" }] });
  const secondDb = new PrismaClient({ datasources: { db: { url: url.toString() } }, transactionOptions: testTransactionOptions });
  const store = prismaStore(db); const second = prismaStore(secondDb);
  const bucket = `verification-${randomUUID()}`;
  let userId: string | undefined;
  context.after(async () => {
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.rateLimitBucket.deleteMany({ where: { keyHash: bucket } });
    await db.$disconnect(); await secondDb.$disconnect();
  });
  const account = await store.createAccount(`${randomUUID()}@phase.integration.example`, "not-used");
  userId = account.id;
  const id = randomUUID(); const now = new Date();
  await store.createConversation({ id, userId, scenarioId: scenarios[0].id, scenarioSnapshot: scenarios[0],
    state: "CREATED", createdAt: now, updatedAt: now });
  assert.equal(await store.advanceConversation(userId, id), false);
  const primary = await store.appendConversationTurn(userId, {
    id: randomUUID(), sessionId: id, role: "user", text: "Primary response with a next action.", createdAt: now,
  });
  assert.equal(primary.phase, "primary");
  const advances = await Promise.all(Array.from({ length: 6 }, (_, index) =>
    (index % 2 ? store : second).advanceConversation(account.id, id)));
  assert.equal(advances.filter(Boolean).length, 1);
  const retry = await second.appendConversationTurn(userId, {
    id: randomUUID(), sessionId: id, role: "user", text: "A new situation needs a different decision.", createdAt: now,
  });
  assert.equal(retry.phase, "independent_retry");
  assert.equal((await store.conversation(userId, id))?.currentPhase, "independent_retry");
  const reservationId = randomUUID(); const voiceId = randomUUID();
  await store.reserveUsage({ id: reservationId, userId, dayKey: "2026-10-10", seconds: 120,
    expiresAt: new Date(now.getTime() + 120000) }, 420);
  await store.createVoiceSession({ id: voiceId, userId, conversationId: id, reservationId, monthKey: "2026-10",
    providerSessionId: "fake", providerCallId: null, providerTerminatedAt: null, status: "active", startedAt: now,
    expiresAt: new Date(now.getTime() + 120000), endedAt: null });
  await store.endVoiceSession(userId, voiceId, new Date(now.getTime() + 65000), "ended", 65);
  assert.equal((await second.measuredVoiceSessions(userId))[0].consumedSeconds, 65);
  const expiredReservation = randomUUID();
  await store.reserveUsage({ id: expiredReservation, userId, dayKey: "2026-10-10", seconds: 120,
    expiresAt: new Date(now.getTime() + 120000) }, 420);
  await store.createVoiceSession({ id: randomUUID(), userId, conversationId: id,
    reservationId: expiredReservation, monthKey: "2026-10", providerSessionId: "expired-fake", providerCallId: null,
    providerTerminatedAt: null, status: "active", startedAt: now,
    expiresAt: new Date(now.getTime() + 120000), endedAt: null });
  await store.updateConversationState(userId, id, "ACTIVE");
  assert.equal(await second.expireVoiceSessions(new Date(now.getTime() + 121000)), 1);
  assert.equal((await store.conversation(userId, id))?.state, "INTERRUPTED");
  assert.equal((await store.conversation(userId, id))?.currentPhase, "independent_retry");
  assert.equal((await store.measuredVoiceSessions(userId)).reduce((sum, row) => sum + (row.consumedSeconds ?? 0), 0), 185);
  await store.updateConversationState(userId, id, "COMPLETED");
  let queries = 0;
  db.$on("query", () => { queries += 1; });
  const records = await store.learningRecords(userId);
  assert.equal(queries, 1, "Conversation, turns and assessment must load in one SQL query");
  assert.equal(records.length, 1);
  assert.equal(records[0].turns.length, 2);
  assert.equal((await store.learningRecords(randomUUID())).length, 0);
  await assert.rejects(() => second.appendConversationTurn(account.id, {
    id: randomUUID(), sessionId: id, role: "user", text: "late write", createdAt: now,
  }), ConflictError);
  const counters = await Promise.all(Array.from({ length: 20 }, (_, index) =>
    (index % 2 ? store : second).incrementRateLimit(bucket, 60000, now)));
  assert.deepEqual(counters.map(row => row.current).sort((first, other) => first - other),
    Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal((await second.incrementRateLimit(bucket, 60000, new Date(now.getTime() + 60000))).current, 1);
});

registerAssessmentStoreTests("PostgreSQL assessment store", async () => {
  const url = verifiedTestDatabaseUrl();
  const db = new PrismaClient({
    datasources: { db: { url: url.toString() } }, transactionOptions: testTransactionOptions,
  });
  return { store: prismaStore(db), close: () => db.$disconnect() };
});

test("PostgreSQL profile persistence, concurrent timezone lock, and cascading deletion", async context => {
  const databaseUrl = verifiedTestDatabaseUrl().toString();
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, transactionOptions: testTransactionOptions });
  const rateKeys = new Set<string>();
  const store = trackedRateStore(db, rateKeys);
  const options = {
    rateLimitNamespace: randomUUID(),
    now: () => new Date("2026-10-09T12:00:00.000Z"),
    devPlanId: "executive",
    billing: { enabled: false },
  };
  const app = await buildApp(store, options);
  let userId: string | undefined;
  let scenarioId: string | undefined;
  context.after(async () => {
    await app.close();
    if (scenarioId) await db.customScenario.deleteMany({ where: { id: scenarioId } });
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.rateLimitBucket.deleteMany({ where: { keyHash: { in: [...rateKeys] } } });
    await db.$disconnect();
  });
  const email = randomUUID() + "@integration.example";
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password: "integration-test-password" } });
  assert.equal(registration.statusCode, 201);
  const registeredUserId: string = registration.json().user.id;
  userId = registeredUserId;
  const headers = { authorization: "Bearer " + registration.json().token };
  const parallelReservations = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => store.reserveUsage({
    id: randomUUID(), userId: registeredUserId, dayKey: "2026-10-09", seconds: 120,
    expiresAt: new Date(`2026-10-09T00:0${index % 10}:00.000Z`),
  }, 600)));
  assert.equal(parallelReservations.filter(result => result.status === "fulfilled").length, 5);
  assert.equal((await store.usage(registeredUserId, "2026-10-09")).reservedSeconds, 600);
  const profile = { displayName: "Test learner", function: "Engineering", jobTitle: "Engineer", careerLevel: "Experienced individual contributor", audience: "Team", goal: "Explain ideas clearly" };
  const responses = await Promise.all(["Asia/Kolkata", "UTC"].map(timezone => app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...profile, timezone } })));
  assert.deepEqual(responses.map(response => response.statusCode).sort(), [200,409]);
  const secondApp = await buildApp(trackedRateStore(db, rateKeys), options); context.after(() => secondApp.close());
  const me = await secondApp.inject({ url: "/v1/me", headers });
  assert.equal(me.json().profile.displayName, "Test learner");
  const practice = await secondApp.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "engineering-delay" },
  });
  assert.equal(practice.statusCode, 201);
  const voiceStartedAt = new Date("2026-10-09T12:00:00.000Z");
  const sessionReservationId = randomUUID();
  await store.reserveUsage({
    id: sessionReservationId, userId: registeredUserId, dayKey: "2026-10-09", seconds: 120,
    expiresAt: new Date("2026-10-09T12:02:00.000Z"),
  }, 720);
  const voiceSession = () => store.createVoiceSession({
    id: randomUUID(), userId: registeredUserId, conversationId: practice.json().conversation.id,
    reservationId: sessionReservationId, providerSessionId: randomUUID(), providerCallId: null,
    monthKey: "2026-10",
    providerTerminatedAt: null, status: "active", startedAt: voiceStartedAt,
    expiresAt: new Date("2026-10-09T12:02:00.000Z"), endedAt: null,
  });
  const sessionAttempts = await Promise.allSettled([voiceSession(), voiceSession()]);
  assert.equal(sessionAttempts.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(sessionAttempts.filter(result => result.status === "rejected").length, 1);
  const monthlyAttempts = await Promise.allSettled(Array.from({ length: 10 }, () =>
    store.reserveVoiceSession(registeredUserId, "2026-10", 2, false)));
  assert.equal(monthlyAttempts.filter(result => result.status === "fulfilled").length, 2);
  assert.equal((await store.voiceMonthUsage(registeredUserId, "2026-10")).sessionsUsed, 2);
  await assert.rejects(() => store.reserveVoiceSession(registeredUserId, "2026-11", 2, true), ConflictError);
  await store.releaseVoiceSession(registeredUserId, "2026-10", false);
  await store.reserveVoiceSession(registeredUserId, "2026-11", 2, true);
  assert.equal(await store.totalVoiceSessions(registeredUserId), 2);
  await assert.rejects(() => store.reserveVoiceSession(registeredUserId, "2026-11", 2, true), ConflictError);
  await store.releaseVoiceSession(registeredUserId, "2026-11", true);
  await store.releaseVoiceSession(registeredUserId, "2026-11", true);
  assert.equal((await store.voiceMonthUsage(registeredUserId, "2026-11")).sessionsUsed, 0);
  const activeSession = await store.activeVoiceSession(registeredUserId);
  assert.ok(activeSession);
  await store.endVoiceSession(registeredUserId, activeSession.id, new Date("2026-10-09T12:00:30.000Z"), "ended", 30);
  await assert.rejects(() => store.endVoiceSession(
    registeredUserId, activeSession.id, new Date("2026-10-09T12:00:30.000Z"), "ended", 30,
  ), ConflictError);
  assert.equal((await store.voiceMonthUsage(registeredUserId, "2026-10")).consumedSeconds, 30);
  await db.user.update({ where: { id: registeredUserId }, data: { role: "manager" } });
  const managerHeaders = headers;
  scenarioId = `integration-${randomUUID()}`;
  const scenario = { id: scenarioId, version: 1, module: "daily", functions: [], goal: "Explain ideas clearly", title: "Explain a change", context: "A project change needs a clear explanation.", question: "Explain the change, impact and next step.", independentQuestion: "Explain a similar change to another colleague without repeating your first answer.", rubricVersion: "integration-1", focus: "Clarity and action", level: 1 };
  const createdScenario = await secondApp.inject({
    method: "POST", url: "/v1/manager/scenarios", headers: managerHeaders, payload: scenario,
  });
  assert.equal(createdScenario.statusCode, 201);
  const initialRevisions = await secondApp.inject({
    url: `/v1/manager/scenarios/${scenarioId}/revisions`, headers: managerHeaders,
  });
  assert.equal(initialRevisions.json().revisions.length, 1);
  const published = await secondApp.inject({
    method: "POST", url: `/v1/manager/scenarios/${scenarioId}/review`,
    headers: managerHeaders, payload: { status: "published" },
  });
  assert.equal(published.statusCode, 200);
  const rolledBack = await secondApp.inject({
    method: "POST", url: `/v1/manager/scenarios/${scenarioId}/rollback`,
    headers: managerHeaders, payload: { revisionId: initialRevisions.json().revisions[0].id },
  });
  assert.equal(rolledBack.statusCode, 200);
  assert.equal(rolledBack.json().scenario.reviewStatus, "draft");
  const finalRevisions = await secondApp.inject({
    url: `/v1/manager/scenarios/${scenarioId}/revisions`, headers: managerHeaders,
  });
  assert.equal(finalRevisions.json().revisions.length, 3);
  await db.user.delete({ where: { id: userId } });
  assert.equal(await db.userProfile.count({ where: { userId } }), 0);
  assert.equal(await db.authSession.count({ where: { userId } }), 0);
  assert.equal(await db.usageReservation.count({ where: { userId } }), 0);
  assert.equal(await db.voiceSession.count({ where: { userId } }), 0);
  assert.equal(await db.voiceMonthUsage.count({ where: { userId } }), 0);
  assert.equal(await db.emailVerificationToken.count({ where: { userId } }), 0);
});

test("PostgreSQL single-use email tokens, cross-instance rate limits and password-reset revocation", async context => {
  const databaseUrl = verifiedTestDatabaseUrl().toString();
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, transactionOptions: testTransactionOptions });
  const rateKeys = new Set<string>();
  const store = trackedRateStore(db, rateKeys);
  const emails: AccountEmail[] = [];
  const now = new Date("2026-10-10T12:00:00Z");
  const options = {
    now: () => now,
    rateLimitNamespace: randomUUID(),
    email: { sender: { async send(message: AccountEmail) { emails.push(message); } } },
  };
  const app = await buildApp(store, options);
  const secondApp = await buildApp(trackedRateStore(db, rateKeys), options);
  let userId: string | undefined;
  context.after(async () => {
    await app.close();
    await secondApp.close();
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    await db.rateLimitBucket.deleteMany({ where: { keyHash: { in: [...rateKeys] } } });
    await db.$disconnect();
  });
  const credentials = { email: `${randomUUID()}@security.integration.example`, password: "initial-integration-password" };
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials });
  assert.equal(registration.statusCode, 201);
  userId = registration.json().user.id;
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const post = (url: string, payload?: Record<string, unknown>) => app.inject({ method: "POST", url, headers, payload });
  const requests = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    (index % 2 ? app : secondApp).inject({ method: "POST", url: "/v1/auth/verify-email/request", headers })));
  assert.equal(requests.filter(response => response.statusCode === 200).length, 3);
  assert.equal(requests.filter(response => response.statusCode === 429).length, 5);
  assert.equal(await db.emailVerificationToken.count({ where: { userId } }), 3);
  const tokenHash = createHash("sha256").update(emails[0].token).digest("hex");
  assert.equal(await db.emailVerificationToken.findUnique({ where: { tokenHash: emails[0].token } }), null);
  assert.ok(await db.emailVerificationToken.findUnique({ where: { tokenHash } }));
  const verification = await Promise.all([app, secondApp].map(instance => instance.inject({
    method: "POST", url: "/v1/auth/verify-email/confirm", headers,
    payload: { token: emails[0].token, password: credentials.password },
  })));
  assert.deepEqual(verification.map(response => response.statusCode).sort(), [200, 400]);
  const verified = await secondApp.inject({ url: "/v1/me", headers });
  assert.equal(verified.json().user.emailVerifiedAt, now.toISOString());
  assert.equal(await store.consumeEmailToken(
    createHash("sha256").update(emails[1].token).digest("hex"), "verify_email",
    new Date(now.getTime() + 1800000), userId,
  ), null);
  const secondLogin = await post("/v1/auth/login", credentials);
  const oldPasswordHash = (await store.accountById(userId!))!.passwordHash;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: null } });
  await store.saveOAuthIdentity({
    id: randomUUID(), provider: "microsoft", subject: "legacy-unverified-provider", userId: userId!,
    createdAt: now, updatedAt: now,
  });
  assert.equal((await post("/v1/auth/password-reset/request", { email: credentials.email })).statusCode, 200);
  const password = "replacement-integration-password";
  const resetToken = emails.find(message => message.purpose === "password_reset")!.token;
  const resets = await Promise.all([app, secondApp].map(instance => instance.inject({
    method: "POST", url: "/v1/auth/password-reset/confirm", payload: { token: resetToken, password },
  })));
  assert.deepEqual(resets.map(response => response.statusCode).sort(), [200, 400]);
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
  assert.equal((await secondApp.inject({
    url: "/v1/me", headers: { authorization: `Bearer ${secondLogin.json().token}` },
  })).statusCode, 401);
  assert.equal(await db.authSession.count({ where: { userId } }), 0);
  assert.equal(await db.emailVerificationToken.count({ where: { userId, usedAt: null } }), 0);
  assert.equal(await db.oAuthIdentity.count({ where: { userId } }), 0);
  assert.equal((await post("/v1/auth/login", credentials)).statusCode, 401);
  assert.equal((await post("/v1/auth/login", { ...credentials, password })).statusCode, 200);
  await assert.rejects(() => store.createSession({
    tokenHash: "stale-integration-session", userId: userId!, expiresAt: new Date(now.getTime() + 3600000),
  }, oldPasswordHash), ConflictError);
  await db.user.delete({ where: { id: userId } });
  assert.equal(await db.emailVerificationToken.count({ where: { userId } }), 0);
  assert.equal(await db.authSession.count({ where: { userId } }), 0);
});
