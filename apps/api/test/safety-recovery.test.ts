import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { deleteSupabaseIdentity } from "../src/lib/supabase-oauth";
import { legalConsent } from "./legal-consent";
import { requestPathForLog } from "../src/lib/request-log";

test("request logs omit recovery tokens, OAuth codes, fragments and control characters", () => {
  assert.equal(requestPathForLog("/password-reset?token=private-value#private-fragment"), "/password-reset");
  assert.equal(requestPathForLog("/oauth?code=private-code&email=private-address"), "/oauth");
  assert.equal(requestPathForLog("/v1/me\r\n"), "/v1/me");
});

test("account export works before onboarding without exposing password or session credentials", async context => {
  const f = await setup(context);
  const result = await f.app.inject({ url: "/v1/me/export", headers: f.headers });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().profile, null);
  assert.deepEqual(result.json().conversations, []);
  assert.equal(result.json().user.id, f.owner.user.id);
  assert.equal("passwordHash" in result.json().user, false);
  assert.equal("token" in result.json(), false);
});

test("database readiness does not certify disabled production services", async context => {
  const f = await setup(context, { assessment: { enabled: false }, voice: { enabled: false }, billing: { enabled: false }, email: { sender: null } });
  const result = await f.app.inject({ url: "/ready" });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().releaseConfigured, false);
  for (const name of ["assessment", "voice", "billing", "accountEmail"]) assert.equal(result.json().capabilities[name], false);
  assert.equal(result.json().storage, "memory");
});

test("catalog reflects configured voice and purchase services rather than fixed development defaults", async context => {
  const disabled = await setup(context, { voice: { enabled: false }, billing: { enabled: false } });
  const unavailable = (await disabled.app.inject({ url: "/v1/catalog" })).json();
  assert.equal(unavailable.liveVoiceAvailable, false);
  assert.match(unavailable.priceNotice, /not available yet/);
  const enabled = await setup(context, { voice: { enabled: true, apiKey: "synthetic-fixture-key" },
    billing: { enabled: true, verifyPurchase: async () => null, productMap: { "test.professional.monthly": "professional" } } });
  const available = (await enabled.app.inject({ url: "/v1/catalog" })).json();
  assert.equal(available.liveVoiceAvailable, true);
  assert.match(available.priceNotice, /store shows final pricing/);
});

async function setup(context: TestContext, options: Parameters<typeof buildApp>[1] = {}) {
  const store = new MemoryStore();
  const app = await buildApp(store, options);
  context.after(() => app.close());
  const register = async (email: string) => (await app.inject({ method: "POST", url: "/v1/auth/register", payload: { email, password: "safety-fixture-password", ...legalConsent } })).json();
  const owner = await register("owner@example.com");
  const headers = { authorization: `Bearer ${owner.token}` };
  return { store, app, owner, headers, register };
}

test("content reports are owner-only, bounded, persistent and manager-reviewed", async context => {
  const f = await setup(context, { managerEmails: ["moderator@example.com"] });
  const id = randomUUID();
  await f.store.createConversation({ id, userId: f.owner.user.id, scenarioId: scenarios[0].id, state: "INTERRUPTED", createdAt: new Date(), updatedAt: new Date() });
  const payload = { conversationId: id, target: "voice", reason: "unsafe", details: "Synthetic QA concern" };
  const report = () => f.app.inject({ method: "POST", url: "/v1/me/content-reports", headers: f.headers, payload });
  assert.equal((await report()).statusCode, 409);
  await f.store.addConversationTurn({ id: randomUUID(), sessionId: id, role: "assistant", phase: "primary", text: "Synthetic test content", createdAt: new Date() });
  const other = await f.register("other@example.com");
  assert.equal((await f.app.inject({ method: "POST", url: "/v1/me/content-reports", headers: { authorization: `Bearer ${other.token}` }, payload })).statusCode, 404);
  assert.equal((await f.app.inject({ method: "POST", url: "/v1/me/content-reports", headers: f.headers, payload: { ...payload, details: "x".repeat(1001) } })).statusCode, 400);
  const submitted = await report(); assert.equal(submitted.statusCode, 201);
  assert.equal((await f.store.contentReports()).length, 1);
  assert.equal((await f.app.inject({ url: "/v1/manager/content-reports", headers: f.headers })).statusCode, 403);
  const moderator = await f.register("moderator@example.com");
  await f.store.markEmailVerified(moderator.user.id, new Date());
  const managerHeaders = { authorization: `Bearer ${moderator.token}` };
  assert.equal((await f.app.inject({ url: "/v1/manager/content-reports", headers: managerHeaders })).json().reports[0].details, payload.details);
  const detailUrl = `/v1/manager/content-reports/${submitted.json().id}`;
  assert.equal((await f.app.inject({ url: detailUrl, headers: f.headers })).statusCode, 403);
  assert.equal((await f.app.inject({ url: detailUrl, headers: managerHeaders })).json().turns[0].text, "Synthetic test content");
  assert.equal((await f.app.inject({ method: "POST", url: `/v1/manager/content-reports/${submitted.json().id}/resolve`, headers: managerHeaders })).statusCode, 200);
  assert.equal((await f.store.contentReports())[0].status, "resolved");
  await f.store.deleteAccount(f.owner.user.id);
  assert.equal((await f.store.contentReports()).length, 0);
});

test("identity deletion failures preserve local data; retries and 404 completion revoke the old app session", async context => {
  let fail = true; let calls = 0;
  const id = randomUUID();
  const f = await setup(context, { oauth: { supabase: { enabled: true, url: "https://testproject.supabase.co", publishableKey: "sb_publishable_fixture", adminKey: "server-only-fixture",
    fetchImpl: async (url, init) => {
      calls++; assert.equal(String(url), `https://testproject.supabase.co/auth/v1/admin/users/${id}`);
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: fail ? 503 : 404 });
    },
  } } });
  await f.store.linkSupabaseUser(f.owner.user.id, id);
  const deletion = () => f.app.inject({ method: "DELETE", url: "/v1/me", headers: f.headers });
  assert.equal((await deletion()).statusCode, 503);
  assert.ok(await f.store.accountById(f.owner.user.id));
  assert.equal((await f.app.inject({ url: "/v1/me", headers: f.headers })).statusCode, 200);
  assert.equal((await f.app.inject({ method: "POST", url: "/v1/me/content-reports", headers: f.headers, payload: {} })).statusCode, 409);
  fail = false;
  assert.equal((await deletion()).statusCode, 204);
  assert.equal(calls, 2);
  assert.equal(await f.store.accountById(f.owner.user.id), null);
  assert.equal((await f.app.inject({ url: "/v1/me", headers: f.headers })).statusCode, 401);
});

test("identity deletion without admin credentials never sends a request or deletes application data", async () => {
  await assert.rejects(deleteSupabaseIdentity(randomUUID(), { enabled: true, url: "https://testproject.supabase.co", publishableKey: "sb_publishable_fixture", fetchImpl: async () => { throw new Error("must not call"); } }), /unavailable/);
});

test("deletion and voice reservation serialize so neither can orphan a provider call", async () => {
  for (const deletionFirst of [true, false]) {
    const store = new MemoryStore();
    const userId = (await store.createAccount("race@example.com", "unused")).id;
    const reservation = { id: randomUUID(), userId, dayKey: "2026-11-06", seconds: 60, expiresAt: new Date(Date.now() + 60000) };
    const operations = [() => store.beginAccountDeletion(userId, new Date()), () => store.reserveUsage(reservation, 120)];
    if (!deletionFirst) operations.reverse();
    const results = await Promise.allSettled(operations.map(operation => operation()));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    if (deletionFirst) await assert.rejects(store.reserveUsage(reservation, 120), /deletion is pending/);
    else {
      await store.settleUsage(reservation.id, 0);
      await store.beginAccountDeletion(userId, new Date());
    }
  }
});
