import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { productionConfigurationErrors } from "../src/config";
import { MemoryStore } from "./memory-store";
import { randomUUID } from "node:crypto";
const credentials = { email: "learner@example.com", password: "a-long-test-password" };
const profile = { displayName: "Sam", function: "Engineering", jobTitle: "Engineer", careerLevel: "Experienced individual contributor", audience: "Product team", goal: "Present recommendations" };
test("production configuration rejects unsafe storage, origins and provider settings", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", devMemoryStore: true, corsOrigins: ["http://localhost:3000"], managerEmails: [], realtimeEnabled: true, realtimeApiKey: "", billingEnabled: true, billingWebhookSecret: "replace-with-a-secret", storeVerifierConfigured: false });
  assert.equal(errors.length, 9);
  assert.match(errors.join(" "), /PostgreSQL/);
  assert.match(errors.join(" "), /CORS_ORIGINS/);
  assert.match(errors.join(" "), /OPENAI_API_KEY/);
});
test("development configuration keeps local memory and localhost defaults available", () => {
  assert.deepEqual(productionConfigurationErrors({ nodeEnv: "development", devMemoryStore: true, corsOrigins: ["http://localhost:3000"], managerEmails: [], realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false }), []);
});
test("production configuration rejects malformed manager allowlists and non-HTTPS origins", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", databaseUrl: "postgresql://prod-db/coach", devMemoryStore: false, corsOrigins: ["http://portal.example.com"], managerEmails: ["manager.example.com"], googleClientIds: ["google-client-id"], realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false });
  assert.match(errors.join(" "), /HTTPS production origins/);
  assert.match(errors.join(" "), /valid manager email addresses/);
});
test("production configuration accepts valid manager email allowlists", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", databaseUrl: "postgresql://prod-db/coach", devMemoryStore: false, corsOrigins: ["https://portal.example.com"], managerEmails: ["manager@acme.co"], googleClientIds: ["google-client-id"], realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false });
  assert.equal(errors.some(error => error.includes("MANAGER_EMAILS")), false);
});
test("production configuration rejects documentation placeholders", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", databaseUrl: "postgresql://replace-with-password@db.example/coach", devMemoryStore: false, corsOrigins: ["https://portal.example.com"], managerEmails: ["manager@sub.example.com"], googleClientIds: ["android-client-id"], realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false });
  assert.match(errors.join(" "), /DATABASE_URL/);
  assert.match(errors.join(" "), /MANAGER_EMAILS/);
  assert.match(errors.join(" "), /GOOGLE_OAUTH_CLIENT_IDS/);
});
test("production configuration rejects documentation notification audiences", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", databaseUrl: "postgresql://prod-db/coach", devMemoryStore: false, corsOrigins: ["https://portal.example.com"], managerEmails: ["manager@acme.co"], googleClientIds: ["google-client-id"], realtimeEnabled: false, billingEnabled: true, billingWebhookSecret: "real-secret", googleNotificationAudience: "https://api.example.com/v1/billing/notifications/google", billingProductMap: "{}", storeVerifierConfigured: true });
  assert.match(errors.join(" "), /GOOGLE_PUBSUB_AUDIENCE/);
});
test("account, profile, scenario recommendations and revocable sessions", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store); context.after(() => app.close());
  assert.equal((await app.inject({ url: "/v1/me" })).statusCode, 401);
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials });
  assert.equal(registration.statusCode, 201);
  const { token } = registration.json(); const headers = { authorization: "Bearer " + token };
  assert.equal(store.sessions.has(token), false);
  assert.equal((await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: profile })).statusCode, 200);
  const scenarios = await app.inject({ url: "/v1/me/scenarios", headers });
  assert.equal(scenarios.json().scenarios[0].id, "engineering-delay");
  assert.equal((await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...profile, timezone: "UTC" } })).statusCode, 409);
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/logout", headers })).statusCode, 204);
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: credentials });
  assert.equal(login.statusCode, 200);
});
test("profiles cannot be read or overwritten across accounts", async context => {
  const app = await buildApp(new MemoryStore()); context.after(() => app.close());
  const first = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials })).json();
  const second = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...credentials, email: "second@example.com" } })).json();
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers: { authorization: "Bearer " + first.token }, payload: profile });
  const headers = { authorization: "Bearer " + second.token };
  assert.equal((await app.inject({ url: "/v1/me", headers })).json().profile, null);
  assert.equal((await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: { ...profile, userId: first.user.id } })).statusCode, 400);
});
test("expiry, invalid passwords and live-voice fail-closed behavior", async context => {
  let time = new Date("2026-09-24T00:00:00Z");
  const app = await buildApp(new MemoryStore(), { now: () => time }); context.after(() => app.close());
  const registered = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials })).json();
  const headers = { authorization: "Bearer " + registered.token };
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { ...credentials, password: "incorrect-password" } })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/v1/voice/sessions", headers })).statusCode, 503);
  assert.equal((await app.inject({ method: "POST", url: "/v1/voice/sessions" })).statusCode, 401);
  time = new Date("2026-10-02T00:00:00Z");
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
});

test("logout all revokes every session for the authenticated account", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "logout-all@example.com", password: "correct horse battery staple" } });
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "logout-all@example.com", password: "correct horse battery staple" } });
  const firstHeaders = { authorization: `Bearer ${registration.json().token}` };
  const secondHeaders = { authorization: `Bearer ${login.json().token}` };
  assert.equal((await app.inject({ url: "/v1/me", headers: firstHeaders })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/logout-all", headers: firstHeaders })).statusCode, 204);
  assert.equal((await app.inject({ url: "/v1/me", headers: firstHeaders })).statusCode, 401);
  assert.equal((await app.inject({ url: "/v1/me", headers: secondHeaders })).statusCode, 401);
});
test("account deletion cascades private data and revokes the current session", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store);
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email: "delete-me@example.com", password: "delete-account-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: profile });
  assert.equal((await app.inject({ method: "DELETE", url: "/v1/me", headers })).statusCode, 204);
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
  assert.equal(store.accounts.size, 0);
  assert.equal(store.profiles.size, 0);
  assert.equal(store.sessions.size, 0);
});
test("plan catalog preserves the four allowances and registration is rate limited", async context => {
  const app = await buildApp(new MemoryStore()); context.after(() => app.close());
  const catalog = (await app.inject({ url: "/v1/catalog" })).json();
  assert.deepEqual(catalog.plans.map((plan: { dailySeconds: number }) => plan.dailySeconds), [1200,1200,1200,2400]);
  assert.equal(catalog.liveVoiceAvailable, false);
  for (let attempt = 0; attempt < 5; attempt++) await app.inject({ method: "POST", url: "/v1/auth/register", payload: {} });
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/register", payload: {} })).statusCode, 429);
});
test("voice usage is calculated on the profile timezone and remains fail-closed", async context => {
  let time = new Date("2026-09-24T18:00:00Z");
  const app = await buildApp(new MemoryStore(), { now: () => time }); context.after(() => app.close());
  const registered = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials })).json();
  const headers = { authorization: "Bearer " + registered.token };
  const profile = { displayName: "Asha", function: "Engineering", jobTitle: "Engineer", careerLevel: "Experienced individual contributor", audience: "Team", goal: "Explain ideas clearly", timezone: "Asia/Kolkata" };
  assert.equal((await app.inject({ method: "PUT", url: "/v1/me/profile", headers, payload: profile })).statusCode, 200);
  const usage = (await app.inject({ url: "/v1/me/voice-usage", headers })).json();
  assert.equal(usage.dayKey, "2026-09-24");
  assert.equal(usage.allowanceSeconds, 1200);
  assert.equal(usage.remainingSeconds, 1200);
  assert.equal(usage.liveVoiceAvailable, false);
  time = new Date("2026-09-24T18:30:00Z");
  assert.equal((await app.inject({ url: "/v1/me/voice-usage", headers })).json().dayKey, "2026-09-25");
});
test("usage reservations cap concurrent voice time and release unused seconds on settlement", async () => {
  const store = new MemoryStore();
  const userId = randomUUID();
  const firstReservationId = randomUUID();
  await store.reserveUsage({ id: firstReservationId, userId, dayKey: "2026-09-24", seconds: 900, expiresAt: new Date() }, 1200);
  await assert.rejects(() => store.reserveUsage({ id: randomUUID(), userId, dayKey: "2026-09-24", seconds: 400, expiresAt: new Date() }, 1200), /exhausted/);
  await store.settleUsage(firstReservationId, 600);
  const reservationId = randomUUID();
  await store.reserveUsage({ id: reservationId, userId, dayKey: "2026-09-24", seconds: 300, expiresAt: new Date() }, 1200);
  await store.settleUsage(reservationId, 100);
  await store.reserveUsage({ id: randomUUID(), userId, dayKey: "2026-09-24", seconds: 500, expiresAt: new Date() }, 1200);
  assert.equal((await store.usage(userId, "2026-09-24")).reservedSeconds, 1200);
});
