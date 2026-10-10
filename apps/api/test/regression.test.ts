import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { MemoryStore } from "./memory-store";
import { startLiveConversation, ProviderUnavailableError } from "../src/conversation-service";
import type { VoiceProvider } from "../src/voice-provider";
import { randomUUID } from "node:crypto";

const validCredentials = { email: "regression@example.com", password: "regression-password-123" };
const validProfile = {
  displayName: "Regression Learner",
  function: "Engineering",
  jobTitle: "Engineering Manager",
  careerLevel: "First-time manager",
  audience: "Product and engineering leadership",
  goal: "Present recommendations",
};

async function registeredApp() {
  const store = new MemoryStore();
  const app = await buildApp(store, { origins: ["http://allowed.example"] });
  const response = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  assert.equal(response.statusCode, 201);
  return { app, store, token: response.json().token as string };
}

test("regression: authentication rejects malformed, missing and expired credentials", async context => {
  let now = new Date("2026-09-24T00:00:00.000Z");
  const store = new MemoryStore();
  const app = await buildApp(store, { now: () => now });
  context.after(() => app.close());
  assert.equal((await app.inject({ url: "/v1/me" })).statusCode, 401);
  assert.equal((await app.inject({ url: "/v1/me", headers: { authorization: "Bearer invalid" } })).statusCode, 401);
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const token = registration.json().token as string;
  assert.equal((await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${token}` } })).statusCode, 200);
  now = new Date("2026-10-01T00:00:00.000Z");
  const expired = await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${token}` } });
  assert.equal(expired.statusCode, 401);
  assert.match(expired.json().error, /expired|sign in/i);
});

test("regression: social auth rejects malformed provider payloads", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: { provider: "google", accessToken: "short" } });
  assert.equal(response.statusCode, 400);
  assert.equal(store.accounts.size, 0);
});

test("regression: Google OAuth stays unavailable when no client audience is configured", async context => {
  const app = await buildApp(new MemoryStore()); context.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: { provider: "google", accessToken: "valid-looking-google-token" } });
  assert.equal(response.statusCode, 503);
  assert.match(response.json().error, /not configured/);
});

test("regression: OAuth identities link by stable provider subject and do not trust changed email claims", async context => {
  const store = new MemoryStore();
  let googleEmail = "oauth-owner@example.com";
  let googleVerified = true;
  let googleAudience = "google-client-id";
  const app = await buildApp(store, {
    oauth: {
      googleClientIds: ["google-client-id"],
      fetchImpl: async input => {
        if (String(input).includes("googleapis")) return new Response(JSON.stringify({ email: googleEmail, sub: "google-subject-1", aud: googleAudience, email_verified: googleVerified }), { status: 200 });
        return new Response(JSON.stringify({ mail: "oauth-owner@example.com", id: "microsoft-subject-1" }), { status: 200 });
      },
    },
  });
  context.after(() => app.close());
  const googlePayload = { provider: "google", accessToken: "google-access-token-123456" };
  googleAudience = "unrecognized-client-id";
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: googlePayload })).statusCode, 401);
  googleAudience = "google-client-id";
  const first = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: googlePayload });
  assert.equal(first.statusCode, 200);
  const firstUserId = first.json().user.id;
  assert.equal(store.oauthIdentities.size, 1);
  googleEmail = "changed-claim@example.com";
  const returning = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: googlePayload });
  assert.equal(returning.statusCode, 200);
  assert.equal(returning.json().user.id, firstUserId);
  assert.equal(returning.json().user.email, "oauth-owner@example.com");
  assert.equal(store.accounts.size, 1);
  const microsoft = await app.inject({
    method: "POST", url: "/v1/auth/oauth", payload: { provider: "microsoft", idToken: "microsoft-id-token-123456" },
  });
  assert.equal(microsoft.statusCode, 503);
  assert.equal(store.oauthIdentities.size, 1);
  googleVerified = false;
  googleEmail = "unverified@example.com";
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: googlePayload })).statusCode, 401);
});

test("regression: server-selected active plan gates business and leadership workshops", async context => {
  const app = await buildApp(new MemoryStore(), { devPlanId: "professional" });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const library = await app.inject({ url: "/v1/scenarios/library" });
  const leadershipScenario = library.json().scenarios.find((item: { module: string; level: number }) => item.module === "leadership" && item.level === 1);
  const businessScenario = library.json().scenarios.find((item: { module: string; level: number }) => item.module === "management" && item.level === 1);
  assert.ok(leadershipScenario);
  assert.ok(businessScenario);

  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...validProfile, planId: "essential" } });
  const professional = await app.inject({ url: "/v1/me/scenarios", headers });
  assert.equal(professional.json().scenarios.some((item: { module: string }) => item.module === "management"), true);
  assert.equal(professional.json().scenarios.some((item: { module: string }) => item.module === "leadership"), false);
  const profileDoesNotGrantExecutiveAccess = await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...validProfile, planId: "executive" } });
  assert.equal(profileDoesNotGrantExecutiveAccess.statusCode, 200);
  const stillProfessional = await app.inject({ url: "/v1/me/scenarios", headers });
  assert.equal(stillProfessional.json().scenarios.some((item: { module: string }) => item.module === "leadership"), false);
  const allowedBusiness = await app.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: businessScenario.id },
  });
  assert.equal(allowedBusiness.statusCode, 201);
  const blockedLeadership = await app.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: leadershipScenario.id },
  });
  assert.equal(blockedLeadership.statusCode, 403);
});

test("regression: manager scenarios require a key and become library content", async context => {
  const { app, store, token } = await registeredApp();
  context.after(() => app.close());
  const scenario = {
    id: "manager-regression-scenario",
    version: 1,
    module: "management",
    functions: ["Engineering"],
    goal: "Present recommendations",
    title: "Explain a changed delivery plan",
    context: "A dependency changed and your delivery plan needs to be updated.",
    question: "Explain what changed, the impact, and your recommendation.",
    independentQuestion: "Give the same recommendation to a different stakeholder without repeating your first answer.",
    rubricVersion: "management-manager-1",
    focus: "Evidence, implications and action",
    level: 1,
  };
  assert.equal((await app.inject({ method: "POST", url: "/v1/manager/scenarios", payload: scenario })).statusCode, 401);
  const created = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers: { "x-manager-key": "development-manager-key" }, payload: scenario });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().message, "Scenario added to the library as a draft for review.");
  assert.equal(created.json().scenario.reviewStatus, "draft");
  const initialRevisions = await app.inject({ method: "GET", url: `/v1/manager/scenarios/${scenario.id}/revisions`, headers: { "x-manager-key": "development-manager-key" } });
  assert.equal(initialRevisions.statusCode, 200);
  assert.equal(initialRevisions.json().revisions.length, 1);
  const initialRevisionId = initialRevisions.json().revisions[0].id as string;
  const library = await app.inject({ url: "/v1/scenarios/library" });
  assert.equal(library.statusCode, 200);
  assert.ok(library.json().count >= 127);
  assert.equal(library.json().scenarios.some((item: { id: string }) => item.id === scenario.id), true);
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers: { authorization: `Bearer ${token}` }, payload: validProfile });
  const recommendations = await app.inject({ url: "/v1/me/scenarios", headers: { authorization: `Bearer ${token}` } });
  assert.equal(recommendations.statusCode, 200);
  assert.equal(recommendations.json().scenarios.some((item: { id: string }) => item.id === scenario.id), false);
  const published = await app.inject({ method: "POST", url: `/v1/manager/scenarios/${scenario.id}/review`, headers: { "x-manager-key": "development-manager-key" }, payload: { status: "published" } });
  assert.equal(published.statusCode, 200);
  assert.equal(published.json().scenario.reviewStatus, "published");
  const publishedRevisions = await app.inject({ method: "GET", url: `/v1/manager/scenarios/${scenario.id}/revisions`, headers: { "x-manager-key": "development-manager-key" } });
  assert.equal(publishedRevisions.json().revisions.length, 2);
  const publishedRecommendations = await app.inject({ url: "/v1/me/scenarios", headers: { authorization: `Bearer ${token}` } });
  assert.equal(publishedRecommendations.json().scenarios.some((item: { id: string }) => item.id === scenario.id), true);
  const createdConversation = await app.inject({ method: "POST", url: "/v1/me/conversations", headers: { authorization: `Bearer ${token}` }, payload: { scenarioId: scenario.id } });
  assert.equal(createdConversation.statusCode, 201);
  const stored = store.scenarioRows.get(scenario.id);
  assert.ok(stored);
  store.scenarioRows.set(scenario.id, { ...stored, title: "Changed after the learner started" });
  const snapshot = await app.inject({ url: `/v1/me/conversations/${createdConversation.json().conversation.id}`, headers: { authorization: `Bearer ${token}` } });
  assert.equal(snapshot.json().scenario.title, scenario.title);
  const rolledBack = await app.inject({ method: "POST", url: `/v1/manager/scenarios/${scenario.id}/rollback`, headers: { "x-manager-key": "development-manager-key" }, payload: { revisionId: initialRevisionId } });
  assert.equal(rolledBack.statusCode, 200);
  assert.equal(rolledBack.json().scenario.reviewStatus, "draft");
  const afterRollbackRecommendations = await app.inject({ url: "/v1/me/scenarios", headers: { authorization: `Bearer ${token}` } });
  assert.equal(afterRollbackRecommendations.json().scenarios.some((item: { id: string }) => item.id === scenario.id), false);
});

test("regression: manager scenario drafts reject blank or oversized content before entering the library", async context => {
  const { app } = await registeredApp();
  context.after(() => app.close());
  const invalid = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers: { "x-manager-key": "development-manager-key" }, payload: { id: " ", version: 1, module: "daily", functions: [], goal: "Start conversations", title: "", context: "Context", question: "Question", independentQuestion: "Transfer", rubricVersion: "r1", focus: "Focus", level: 1 } });
  assert.equal(invalid.statusCode, 400);
  assert.equal((await app.inject({ url: "/v1/scenarios/library" })).json().scenarios.some((scenario: { id: string }) => scenario.id.trim() === ""), false);
});

test("regression: authenticated manager allowlist can publish without the development key", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { managerEmails: ["manager@example.com"] });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "manager@example.com", password: "manager-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const unverified = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers, payload: {} });
  assert.equal(unverified.statusCode, 403);
  await store.markEmailVerified(registration.json().user.id, new Date());
  const response = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers, payload: { id: "manager-authenticated-scenario", version: 1, module: "daily", functions: [], goal: "Start conversations", title: "Open a useful conversation", context: "You meet a colleague before a meeting.", question: "Start the conversation and explain what you are working on.", independentQuestion: "Open a similar conversation with someone from another team.", rubricVersion: "daily-manager-1", focus: "Conversation initiation", level: 1 } });
  assert.equal(response.statusCode, 201);
  const nonManager = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "learner@example.com", password: "learner-password-123" } });
  const forbidden = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers: { authorization: `Bearer ${nonManager.json().token}` }, payload: { id: "manager-forbidden-scenario", version: 1, module: "daily", functions: [], goal: "Start conversations", title: "Should not publish", context: "A context.", question: "A prompt.", independentQuestion: "A retry.", rubricVersion: "daily-manager-1", focus: "Focus", level: 1 } });
  assert.equal(forbidden.statusCode, 403);
});

test("regression: persisted manager role grants access without an email allowlist", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { managerEmails: [] });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "role-manager@example.com", password: "manager-password-123" } });
  const account = store.accounts.get(registration.json().user.id);
  assert.ok(account);
  account.role = "manager";
  const response = await app.inject({ method: "POST", url: "/v1/manager/scenarios", headers: { authorization: `Bearer ${registration.json().token}` }, payload: { id: "role-manager-scenario", version: 1, module: "daily", functions: [], goal: "Start conversations", title: "Open a useful conversation", context: "You meet a colleague before a meeting.", question: "Start the conversation and explain what you are working on.", independentQuestion: "Open a similar conversation with someone from another team.", rubricVersion: "daily-manager-1", focus: "Conversation initiation", level: 1 } });
  assert.equal(response.statusCode, 201);
});

test("regression: billing entitlement webhooks are authenticated, idempotent and owner-scoped", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { billing: { enabled: true, webhookSecret: "billing-secret" } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "billing-owner@example.com", password: "billing-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  assert.deepEqual((await app.inject({ url: "/v1/me/entitlement", headers })).json(), { entitlement: null });
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: validProfile });
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().planId, "free");
  const intentResponse = await app.inject({ method: "POST", url: "/v1/billing/intents", headers, payload: { provider: "google", productId: "com.coach.executive.monthly" } });
  assert.equal(intentResponse.statusCode, 201);
  const purchaseIntentId = intentResponse.json().intent.id as string;
  assert.ok(intentResponse.json().intent.nonce);
  const event = { purchaseIntentId, productId: "com.coach.executive.monthly", transactionId: "google-transaction-1", status: "active", environment: "sandbox", expiresAt: "2026-11-01T00:00:00.000Z" };
  assert.equal((await app.inject({ method: "POST", url: "/v1/billing/webhooks/google", payload: event })).statusCode, 401);
  const created = await app.inject({ method: "POST", url: "/v1/billing/webhooks/google", headers: { "x-billing-webhook-secret": "billing-secret" }, payload: event });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().received, true);
  assert.equal(created.json().idempotent, false);
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().planId, "executive");
  const repeated = await app.inject({ method: "POST", url: "/v1/billing/webhooks/google", headers: { "x-billing-webhook-secret": "billing-secret" }, payload: event });
  assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.json().idempotent, true);
  const updated = await app.inject({ method: "POST", url: "/v1/billing/webhooks/google", headers: { "x-billing-webhook-secret": "billing-secret" }, payload: { ...event, status: "expired", expiresAt: null } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().entitlement.status, "expired");
  assert.equal((await app.inject({ url: "/v1/me/entitlement", headers })).json().entitlement.status, "expired");
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().planId, "free");
  const other = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "billing-other@example.com", password: "billing-password-123" } });
  const otherHeaders = { authorization: `Bearer ${other.json().token}` };
  const otherIntent = await app.inject({ method: "POST", url: "/v1/billing/intents", headers: otherHeaders, payload: { provider: "google", productId: "com.coach.executive.monthly" } });
  const conflict = await app.inject({ method: "POST", url: "/v1/billing/webhooks/google", headers: { "x-billing-webhook-secret": "billing-secret" }, payload: { ...event, purchaseIntentId: otherIntent.json().intent.id, transactionId: "google-transaction-1" } });
  assert.equal(conflict.statusCode, 409);
});

test("regression: verified mobile store purchases grant only matched entitlements", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { billing: { enabled: true, webhookSecret: "billing-secret", verifyPurchase: async input => ({ productId: input.productId, transactionId: input.transactionId, originalTransactionId: input.transactionId, purchaseToken: input.purchaseToken, status: "active", environment: "sandbox", expiresAt: new Date("2026-11-01T00:00:00.000Z"), providerEventDate: new Date("2026-10-01T00:00:00.000Z") }) } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "store-purchase@example.com", password: "store-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const intent = await app.inject({ method: "POST", url: "/v1/billing/intents", headers, payload: { provider: "apple", productId: "com.communicationcoach.professional.monthly" } });
  assert.equal(intent.statusCode, 201);
  const payload = { purchaseIntentId: intent.json().intent.id, provider: "apple", productId: "com.communicationcoach.professional.monthly", transactionId: "apple-transaction-1", purchaseToken: "signed-store-payload" };
  assert.equal((await app.inject({ method: "POST", url: "/v1/billing/purchases/verify", payload })).statusCode, 401);
  const verified = await app.inject({ method: "POST", url: "/v1/billing/purchases/verify", headers, payload });
  assert.equal(verified.statusCode, 201);
  assert.equal(verified.json().verified, true);
  assert.equal(verified.json().entitlement.productId, payload.productId);
  assert.equal((await app.inject({ url: "/v1/me/entitlement", headers })).json().entitlement.transactionId, payload.transactionId);
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().planId, "professional");
});

test("regression: verified Apple lifecycle notifications update matching entitlements and ignore stale events", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { now: () => new Date("2026-10-06T00:00:00.000Z"), billing: { enabled: true, verifyAppleNotification: async signedPayload => signedPayload === "renewal" ? { notificationId: "notification-renewal", notificationType: "DID_RENEW", productId: "com.communicationcoach.professional.monthly", transactionId: "apple-renewal-2", originalTransactionId: "apple-original-1", status: "active", environment: "sandbox", expiresAt: new Date("2026-12-01T00:00:00.000Z"), providerEventDate: new Date("2026-10-05T00:00:00.000Z") } : signedPayload === "stale" ? { notificationId: "notification-stale", notificationType: "EXPIRED", productId: "com.communicationcoach.professional.monthly", transactionId: "apple-renewal-1", originalTransactionId: "apple-original-1", status: "expired", environment: "sandbox", expiresAt: new Date("2026-10-01T00:00:00.000Z"), providerEventDate: new Date("2026-10-04T00:00:00.000Z") } : null } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "apple-lifecycle@example.com", password: "apple-lifecycle-password" } });
  const userId = registration.json().user.id as string;
  await store.saveEntitlement({ id: randomUUID(), userId, provider: "apple", productId: "com.communicationcoach.professional.monthly", transactionId: "apple-renewal-1", originalTransactionId: "apple-original-1", purchaseToken: "apple-purchase-token", status: "active", environment: "sandbox", expiresAt: new Date("2026-11-01T00:00:00.000Z"), providerEventDate: new Date("2026-10-01T00:00:00.000Z"), createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-01T00:00:00.000Z") });
  const renewal = await app.inject({ method: "POST", url: "/v1/billing/notifications/apple", payload: { signedPayload: "renewal" } });
  assert.equal(renewal.statusCode, 200);
  assert.equal(renewal.json().entitlement.transactionId, "apple-renewal-2");
  assert.equal(renewal.json().entitlement.purchaseToken, "apple-purchase-token");
  const stale = await app.inject({ method: "POST", url: "/v1/billing/notifications/apple", payload: { signedPayload: "stale" } });
  assert.equal(stale.statusCode, 200);
  assert.equal(stale.json().idempotent, true);
  assert.equal((await app.inject({ method: "GET", url: "/v1/me/entitlement", headers: { authorization: `Bearer ${registration.json().token}` } })).json().entitlement.transactionId, "apple-renewal-2");
});

test("regression: Google Pub/Sub lifecycle notifications reverify tokens before updating entitlements", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { billing: { enabled: true, googleNotificationSecret: "google-secret", verifyPurchase: async input => ({ productId: input.productId, transactionId: input.transactionId, originalTransactionId: input.purchaseToken, purchaseToken: input.purchaseToken, status: "active", environment: "sandbox", expiresAt: new Date("2026-12-01T00:00:00.000Z"), providerEventDate: null }) } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "google-lifecycle@example.com", password: "google-lifecycle-password" } });
  const userId = registration.json().user.id as string;
  await store.saveEntitlement({ id: randomUUID(), userId, provider: "google", productId: "com.communicationcoach.professional.monthly", transactionId: "google-transaction-1", originalTransactionId: "google-purchase-token", purchaseToken: "google-purchase-token", status: "active", environment: "sandbox", expiresAt: new Date("2026-11-01T00:00:00.000Z"), providerEventDate: new Date("2026-10-01T00:00:00.000Z"), createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-01T00:00:00.000Z") });
  const data = Buffer.from(JSON.stringify({ packageName: "com.communicationcoach", eventTimeMillis: "1791244800000", subscriptionNotification: { purchaseToken: "google-purchase-token", subscriptionId: "com.communicationcoach.professional.monthly", notificationType: 2 } })).toString("base64");
  const payload = { message: { data, messageId: "google-message-1" } };
  assert.equal((await app.inject({ method: "POST", url: "/v1/billing/notifications/google", payload })).statusCode, 401);
  const response = await app.inject({ method: "POST", url: "/v1/billing/notifications/google", headers: { "x-google-pubsub-secret": "google-secret" }, payload });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().entitlement.purchaseToken, "google-purchase-token");
  assert.equal((await app.inject({ method: "GET", url: "/v1/me/entitlement", headers: { authorization: `Bearer ${registration.json().token}` } })).json().entitlement.providerEventDate, "2026-10-06T00:00:00.000Z");
});

test("regression: progress is private and starts without invented skill scores", async context => {
  const { app, token } = await registeredApp();
  context.after(() => app.close());
  const profile = await app.inject({ method: "PUT", url: "/v1/me/profile", headers: { authorization: `Bearer ${token}` }, payload: validProfile });
  assert.equal(profile.statusCode, 200);
  const planChange = await app.inject({ method: "PUT", url: "/v1/me/profile", headers: { authorization: `Bearer ${token}` }, payload: { ...validProfile, planId: "executive" } });
  assert.equal(planChange.statusCode, 200);
  assert.equal((await app.inject({ url: "/v1/me", headers: { authorization: `Bearer ${token}` } })).json().profile.planId, "executive");
  const response = await app.inject({ url: "/v1/me/progress", headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  const progress = response.json();
  assert.deepEqual({ totalSessions: progress.totalSessions, completedSessions: progress.completedSessions, weeklySessions: progress.weeklySessions, practiceMinutes: progress.practiceMinutes, weeklyPracticeMinutes: progress.weeklyPracticeMinutes, currentStreakDays: progress.currentStreakDays, skillSignal: progress.skillSignal, skillSignalStatus: progress.skillSignalStatus }, { totalSessions: 0, completedSessions: 0, weeklySessions: 0, practiceMinutes: 0, weeklyPracticeMinutes: 0, currentStreakDays: 0, skillSignal: null, skillSignalStatus: "awaiting_assessment" });
  assert.deepEqual(progress.mastery, { level: 1, title: "Getting started", practiceDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0, nextLevel: 2, progressPercent: 0, nextRequirements: { level: 2, title: "Finding your voice", minimumPracticeDays: 2, completedScenarios: 1, successfulRetries: 1, evidenceAssessments: 1 } });
  assert.equal(progress.practiceDays, 0);
  assert.equal(progress.completedScenarios, 0);
  assert.equal(progress.successfulRetries, 0);
  assert.equal(progress.evidenceAssessments, 0);
  assert.equal(progress.dailyPractice.length, 7);
  assert.equal(progress.levelTrack.length, 5);
});

test("regression: registration normalizes email and rejects duplicate accounts", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const first = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...validCredentials, email: "  REGRESSION@EXAMPLE.COM " } });
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().user.email, validCredentials.email);
  const duplicate = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(store.accounts.size, 1);
});

test("regression: invalid profile input cannot create partial learner state", async context => {
  const { app, token } = await registeredApp();
  context.after(() => app.close());
  const headers = { authorization: `Bearer ${token}` };
  const invalid = await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...validProfile, goal: "Infer confidence from voice" } });
  assert.equal(invalid.statusCode, 400);
  const me = await app.inject({ url: "/v1/me", headers });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().profile, null);
});

test("regression: private routes never expose another account profile", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const first = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const second = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...validCredentials, email: "other-regression@example.com" } });
  const firstHeaders = { authorization: `Bearer ${first.json().token}` };
  const secondHeaders = { authorization: `Bearer ${second.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers: firstHeaders, payload: validProfile });
  const secondMe = await app.inject({ url: "/v1/me", headers: secondHeaders });
  assert.equal(secondMe.json().profile, null);
  const attemptedOverwrite = await app.inject({ method: "PUT", url: "/v1/me/profile", headers: secondHeaders, payload: { ...validProfile, userId: first.json().user.id } });
  assert.equal(attemptedOverwrite.statusCode, 400);
});

test("regression: usage endpoint is private, timezone-bound and never unlocks live voice", async context => {
  let now = new Date("2026-09-24T18:00:00.000Z");
  const store = new MemoryStore();
  const app = await buildApp(store, { now: () => now });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  assert.equal((await app.inject({ url: "/v1/me/voice-usage" })).statusCode, 401);
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...validProfile, timezone: "Asia/Kolkata" } });
  const usage = await app.inject({ url: "/v1/me/voice-usage", headers });
  assert.equal(usage.statusCode, 200);
  assert.deepEqual(usage.json(), { planId: "executive", planTitle: "Executive", timezone: "Asia/Kolkata", dayKey: "2026-09-24", monthKey: "2026-09", sessionsUsedThisMonth: 0, sessionsRemainingThisMonth: 40, sessionsAllowed: 40, sessionsRemaining: 40, lifetimeFreeLimit: false, consumedSecondsThisMonth: 0, maxSessionSeconds: 420, reservedSecondsToday: 0, consumedSecondsToday: 0, resetsAt: "2026-09-24T18:30:00.000Z", monthResetsAt: "2026-09-30T18:30:00.000Z", enforcement: "server_reservations", liveVoiceAvailable: false });
  now = new Date("2026-09-24T18:31:00.000Z");
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().dayKey, "2026-09-25");
  const voice = await app.inject({ method: "POST", url: "/v1/voice/sessions", headers });
  assert.equal(voice.statusCode, 503);
  assert.equal(store.reservations.size, 0);
});

test("regression: monthly usage rolls over at midnight in the profile timezone", async context => {
  let now = new Date("2026-10-31T18:29:00.000Z");
  const app = await buildApp(new MemoryStore(), { now: () => now });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...validProfile, timezone: "Asia/Kolkata" } });
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().monthKey, "2026-10");
  now = new Date("2026-10-31T18:30:00.000Z");
  const usage = (await app.inject({ url: "/v1/me/voice-usage", headers })).json();
  assert.equal(usage.monthKey, "2026-11");
  assert.equal(usage.sessionsRemaining, 40);
});

test("regression: Essential plan filters leadership from recommendations and conversation creation", async context => {
  const app = await buildApp(new MemoryStore(), { devPlanId: "essential" });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: validProfile });
  const recommendations = await app.inject({ url: "/v1/me/scenarios", headers });
  assert.equal(recommendations.json().scenarios.some((scenario: { module: string }) => scenario.module !== "daily"), false);
  const createLeadership = await app.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "founder-pitch" },
  });
  assert.equal(createLeadership.statusCode, 403);
});

test("regression: free tier allows exactly two lifetime seven-minute voice sessions", async context => {
  const store = new MemoryStore();
  let time = new Date("2026-10-09T12:00:00.000Z");
  const app = await buildApp(store, {
    now: () => new Date(time),
    devPlanId: "free",
    voice: {
      enabled: true,
      apiKey: "server-only-key",
      fetchImpl: async () => new Response(JSON.stringify({
        value: "secret", expires_at: 1790000000, session: { id: randomUUID() },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    },
  });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: validProfile });
  for (let index = 0; index < 2; index++) {
    const practice = await app.inject({ method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "daily-opening" } });
    assert.equal(practice.statusCode, 201);
    const session = await app.inject({
      method: "POST", url: "/v1/voice/sessions", headers,
      payload: { conversationId: practice.json().conversation.id, scenarioId: "daily-opening" },
    });
    assert.equal(session.statusCode, 201);
    assert.equal(session.json().model, "gpt-realtime-2.1-mini");
    assert.equal(session.json().expiresAt <= new Date(time.getTime() + 420_000).toISOString(), true);
    time = new Date(time.getTime() + 1_000);
    const stopped = await app.inject({ method: "POST", url: `/v1/voice/sessions/${session.json().sessionId}/stop`, headers });
    assert.equal(stopped.statusCode, 200);
    assert.equal(stopped.json().consumedSeconds, 1);
  }
  const thirdPractice = await app.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "daily-opening" },
  });
  const thirdSession = await app.inject({
    method: "POST", url: "/v1/voice/sessions", headers,
    payload: { conversationId: thirdPractice.json().conversation.id, scenarioId: "daily-opening" },
  });
  assert.equal(thirdSession.statusCode, 409);
  assert.match(thirdSession.json().error, /two free voice sessions/i);
  const usage = (await app.inject({ url: "/v1/me/voice-usage", headers })).json();
  assert.equal(usage.sessionsRemaining, 0);
  assert.equal(usage.sessionsUsedThisMonth, 2);
  assert.equal(usage.consumedSecondsThisMonth, 2);
});

test("regression: concurrent monthly session reservations never exceed plan cap", async () => {
  const store = new MemoryStore();
  const userId = randomUUID();
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => store.reserveVoiceSession(userId, "2026-10", 2, false)));
  assert.equal(attempts.filter(result => result.status === "fulfilled").length, 2);
  assert.equal((await store.voiceMonthUsage(userId, "2026-10")).sessionsUsed, 2);
});

test("regression: conversation creation authorizes scenarios and preserves ownership", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const first = await app.inject({ method: "POST", url: "/v1/auth/register", payload: validCredentials });
  const second = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...validCredentials, email: "conversation-owner@example.com" } });
  const firstHeaders = { authorization: `Bearer ${first.json().token}` };
  const secondHeaders = { authorization: `Bearer ${second.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers: firstHeaders, payload: validProfile });
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers: secondHeaders, payload: { ...validProfile, function: "Finance" } });
  const created = await app.inject({ method: "POST", url: "/v1/me/conversations", headers: firstHeaders, payload: { scenarioId: "engineering-delay" } });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().conversation.state, "CREATED");
  assert.equal(created.json().liveVoiceAvailable, false);
  const recent = await app.inject({ url: "/v1/me/conversations", headers: firstHeaders });
  assert.equal(recent.statusCode, 200);
  assert.equal(recent.json().conversations[0].scenario.id, "engineering-delay");
  const id = created.json().conversation.id as string;
  const own = await app.inject({ url: `/v1/me/conversations/${id}`, headers: firstHeaders });
  assert.equal(own.statusCode, 200);
  assert.equal(own.json().scenario.id, "engineering-delay");
  assert.equal(own.json().turns.length, 0);
  const turn = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/turns`, headers: firstHeaders, payload: { role: "user", text: "I will explain the delay, its impact, and the next decision." } });
  assert.equal(turn.statusCode, 201);
  assert.equal(turn.json().turn.role, "user");
  assert.equal(turn.json().turn.phase, "primary");
  const incomplete = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/complete`, headers: firstHeaders });
  assert.equal(incomplete.statusCode, 409);
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/advance`,
    headers: firstHeaders })).statusCode, 200);
  const retry = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/turns`, headers: firstHeaders, payload: { role: "user", phase: "independent_retry", text: "I recommend a staged plan because the evidence shows risk. Next, I will confirm the owner and timeline." } });
  assert.equal(retry.statusCode, 201);
  assert.equal(retry.json().turn.phase, "independent_retry");
  assert.equal((await app.inject({ url: `/v1/me/conversations/${id}`, headers: firstHeaders })).json().turns.length, 2);
  const completed = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/complete`, headers: firstHeaders });
  assert.equal(completed.statusCode, 200);
  assert.equal(completed.json().conversation.state, "COMPLETED");
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/complete`, headers: firstHeaders })).statusCode, 409);
  const exported = await app.inject({ url: "/v1/me/export", headers: firstHeaders });
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.json().user.email, validCredentials.email);
  assert.equal(exported.json().conversations[0].turns[0].text, "I will explain the delay, its impact, and the next decision.");
  assert.equal("passwordHash" in exported.json().user, false);
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/turns`, headers: secondHeaders, payload: { role: "user", text: "private" } })).statusCode, 404);
  assert.equal((await app.inject({ url: `/v1/me/conversations/${id}`, headers: secondHeaders })).statusCode, 404);
  assert.equal((await app.inject({ method: "POST", url: "/v1/me/conversations", headers: secondHeaders, payload: { scenarioId: "engineering-delay" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/v1/me/conversations", headers: firstHeaders, payload: { scenarioId: "unknown" } })).statusCode, 403);
});

test("regression: security headers, cache policy and CORS stay enabled", async context => {
  const { app } = await registeredApp();
  context.after(() => app.close());
  const response = await app.inject({ url: "/health", headers: { origin: "http://allowed.example" } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["access-control-allow-origin"], "http://allowed.example");
  assert.ok(response.headers["x-content-type-options"]);
  assert.ok(response.headers["x-frame-options"]);
});

test("regression: database readiness reports dependency failure without exposing details", async context => {
  const store = new MemoryStore();
  store.ready = async () => { throw new Error("database password should not escape"); };
  const app = await buildApp(store);
  context.after(() => app.close());
  const response = await app.inject({ url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { status: "database_unavailable" });
  assert.doesNotMatch(response.body, /database password/);
});

test("regression: live lifecycle reserves usage and reaches ACTIVE only after provider connection", async () => {
  const store = new MemoryStore();
  const conversationId = randomUUID();
  const userId = randomUUID();
  const now = new Date("2026-09-24T00:00:00.000Z");
  await store.createConversation({ id: conversationId, userId, scenarioId: "engineering-delay", state: "CREATED", createdAt: now, updatedAt: now });
  const provider: VoiceProvider = { name: "test-provider", async connect() { return { providerSessionId: "provider-session", expiresAt: new Date(now.getTime() + 600_000) }; }, async terminate() {} };
  const result = await startLiveConversation({ store, provider, userId, conversationId, scenarioId: "engineering-delay", dayKey: "2026-09-24", allowanceSeconds: 1200, maximumSeconds: 600, now: () => now });
  assert.equal(result.state, "ACTIVE");
  assert.equal((await store.conversation(userId, conversationId))?.state, "ACTIVE");
  assert.equal((await store.usage(userId, "2026-09-24")).reservedSeconds, 600);
});

test("regression: provider failure releases the reservation and never leaves a connecting session", async () => {
  const store = new MemoryStore();
  const conversationId = randomUUID();
  const userId = randomUUID();
  const now = new Date("2026-09-24T00:00:00.000Z");
  await store.createConversation({ id: conversationId, userId, scenarioId: "engineering-delay", state: "CREATED", createdAt: now, updatedAt: now });
  const provider: VoiceProvider = { name: "disabled-provider", async connect() { throw new Error("provider disabled"); }, async terminate() {} };
  await assert.rejects(() => startLiveConversation({ store, provider, userId, conversationId, scenarioId: "engineering-delay", dayKey: "2026-09-24", allowanceSeconds: 1200, maximumSeconds: 600, now: () => now }), ProviderUnavailableError);
  assert.equal((await store.conversation(userId, conversationId))?.state, "FAILED");
  assert.equal((await store.usage(userId, "2026-09-24")).reservedSeconds, 0);
});

test("regression: expired voice sessions settle usage and leave learning resumable", async () => {
  const store = new MemoryStore();
  const userId = randomUUID();
  const conversationId = randomUUID();
  const reservationId = randomUUID();
  const sessionId = randomUUID();
  const startedAt = new Date("2026-09-24T00:00:00.000Z");
  await store.createConversation({ id: conversationId, userId, scenarioId: "engineering-delay", state: "ACTIVE", createdAt: startedAt, updatedAt: startedAt });
  await store.reserveUsage({ id: reservationId, userId, dayKey: "2026-09-24", seconds: 1200, expiresAt: new Date("2026-09-24T00:20:00.000Z") }, 1200);
  await store.createVoiceSession({
    id: sessionId, userId, conversationId, reservationId, monthKey: "2026-09", providerSessionId: "provider-session",
    providerCallId: "call_expired", providerTerminatedAt: null, status: "active", startedAt,
    expiresAt: new Date("2026-09-24T00:02:00.000Z"), endedAt: null,
  });
  assert.equal(await store.expireVoiceSessions(new Date("2026-09-24T00:02:05.000Z")), 1);
  assert.equal((await store.voiceSession(userId, sessionId))?.status, "expired");
  assert.equal((await store.conversation(userId, conversationId))?.state, "INTERRUPTED");
  assert.equal((await store.usage(userId, "2026-09-24")).reservedSeconds, 120);
  assert.equal((await store.usage(userId, "2026-09-24")).consumedSeconds, 120);
  assert.deepEqual((await store.pendingVoiceProviderCalls()).map(session => session.providerCallId), ["call_expired"]);
  await store.markVoiceProviderTerminated(sessionId, new Date("2026-09-24T00:22:00.000Z"));
  assert.equal((await store.pendingVoiceProviderCalls()).length, 0);
});

test("regression: voice capabilities clearly identify the web preview boundary", async context => {
  const { app, token } = await registeredApp();
  context.after(() => app.close());
  const response = await app.inject({ url: "/v1/voice/capabilities", headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { platform: "web", transport: "react-native-webrtc", nativeModuleAvailable: false, developmentBuild: false, providerConfigured: false, liveVoiceAvailable: false, code: "WEB_PREVIEW_ONLY" });
  const nativeResponse = await app.inject({ url: "/v1/voice/capabilities?platform=android", headers: { authorization: `Bearer ${token}` } });
  assert.equal(nativeResponse.json().code, "DEV_CLIENT_REQUIRED");
  assert.equal(nativeResponse.json().platform, "android");
  const readyResponse = await app.inject({ url: "/v1/voice/capabilities?platform=android&nativeModuleAvailable=true&developmentBuild=true", headers: { authorization: `Bearer ${token}` } });
  assert.equal(readyResponse.json().code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(readyResponse.json().liveVoiceAvailable, false);
});

test("regression: configured realtime voice creates a reserved provider session without exposing the API key", async context => {
  const store = new MemoryStore();
  let providerRequest: Request | undefined;
  let time = new Date("2026-10-06T00:00:00.000Z");
  const app = await buildApp(store, {
    now: () => new Date(time),
    voice: {
      enabled: true,
      apiKey: "server-only-key",
      fetchImpl: async (input, init) => {
        providerRequest = new Request(input, init);
        return new Response(JSON.stringify({ value: "ephemeral-client-secret", expires_at: 1790000000, session: { id: "realtime-session-1" } }), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "voice-provider@example.com", password: "voice-provider-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: validProfile });
  const conversation = await app.inject({ method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "engineering-delay" } });
  assert.equal(conversation.statusCode, 201);
  const browserAttempt = await app.inject({ method: "POST", url: "/v1/voice/sessions", headers: { ...headers, origin: "http://localhost:8081" }, payload: { conversationId: conversation.json().conversation.id, scenarioId: "engineering-delay" } });
  assert.equal(browserAttempt.statusCode, 403);
  const session = await app.inject({ method: "POST", url: "/v1/voice/sessions", headers, payload: { conversationId: conversation.json().conversation.id, scenarioId: "engineering-delay" } });
  assert.equal(session.statusCode, 201);
  assert.equal(session.json().clientSecret, "ephemeral-client-secret");
  assert.equal(session.json().conversation.state, "ACTIVE");
  assert.equal(session.json().providerSessionCreated, true);
  assert.equal(session.json().liveVoiceAvailable, false);
  assert.equal(store.reservations.size, 1);
  assert.equal(store.voiceSessions.size, 1);
  assert.equal(providerRequest?.headers.get("authorization"), "Bearer server-only-key");
  const primaryInstructions = (await providerRequest!.clone().json()).session.instructions;
  assert.match(primaryInstructions, /at most 2 probing questions/);
  assert.match(primaryInstructions, /Do not begin the independent retry/);
  const bound = await app.inject({ method: "POST", url: `/v1/voice/sessions/${session.json().sessionId}/bind`, headers, payload: { providerCallId: "call_123" } });
  assert.equal(bound.statusCode, 200);
  const transcript = await app.inject({ method: "POST", url: `/v1/voice/sessions/${session.json().sessionId}/transcript`, headers, payload: { role: "user", text: "I would explain the change and next step." } });
  assert.equal(transcript.statusCode, 201);
  assert.equal((await app.inject({ url: `/v1/me/conversations/${conversation.json().conversation.id}`, headers })).json().turns[0].text, "I would explain the change and next step.");
  const capabilities = await app.inject({ url: "/v1/voice/capabilities?platform=android&nativeModuleAvailable=true&developmentBuild=true", headers });
  assert.equal(capabilities.json().providerConfigured, true);
  assert.equal(capabilities.json().liveVoiceAvailable, true);
  assert.equal(capabilities.json().code, "READY");
  const otherConversation = await app.inject({
    method: "POST", url: "/v1/me/conversations", headers, payload: { scenarioId: "engineering-delay" },
  });
  const duplicateSession = await app.inject({
    method: "POST", url: "/v1/voice/sessions", headers,
    payload: { conversationId: otherConversation.json().conversation.id, scenarioId: "engineering-delay" },
  });
  assert.equal(duplicateSession.statusCode, 409);
  time = new Date(time.getTime() + 120_000);
  const stopped = await app.inject({
    method: "POST", url: `/v1/voice/sessions/${session.json().sessionId}/stop`, headers,
    payload: { consumedSeconds: 0 },
  });
  assert.equal(stopped.statusCode, 200);
  assert.equal(stopped.json().consumedSeconds, 120);
  assert.equal(stopped.json().providerTermination, "completed");
  assert.match(String(providerRequest?.url), /realtime\/calls\/call_123\/hangup/);
  assert.equal(stopped.json().status, "ended");
  assert.equal((await store.usage(registration.json().user.id, "2026-10-06")).reservedSeconds, 120);
  assert.equal((await store.conversation(registration.json().user.id, conversation.json().conversation.id))?.state, "INTERRUPTED");
  assert.equal((await app.inject({ method: "POST",
    url: `/v1/me/conversations/${conversation.json().conversation.id}/advance`, headers })).statusCode, 200);
  const retryVoice = await app.inject({ method: "POST", url: "/v1/voice/sessions", headers,
    payload: { conversationId: conversation.json().conversation.id, scenarioId: "engineering-delay" } });
  assert.equal(retryVoice.statusCode, 201);
  const retryInstructions = (await providerRequest!.clone().json()).session.instructions;
  assert.match(retryInstructions, /Present this new situation/);
  assert.match(retryInstructions, /Never score/);
  const retryTranscript = await app.inject({ method: "POST",
    url: `/v1/voice/sessions/${retryVoice.json().sessionId}/transcript`, headers,
    payload: { role: "user", phase: "primary", text: "I would tailor the recommendation for another stakeholder." } });
  assert.equal(retryTranscript.json().turn.phase, "independent_retry");
  time = new Date(time.getTime() + 30000);
  assert.equal((await app.inject({ method: "POST", url: `/v1/voice/sessions/${retryVoice.json().sessionId}/stop`,
    headers, payload: { consumedSeconds: 0 } })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/v1/me/conversations/${conversation.json().conversation.id}/complete`, headers })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: `/v1/voice/sessions/${session.json().sessionId}/stop`, headers, payload: { consumedSeconds: 90 } })).statusCode, 409);
});
