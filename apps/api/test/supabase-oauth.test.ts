import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { supabaseGoogleIdentity, supabaseOAuthConfigured } from "../src/lib/supabase-oauth";
import { hashPassword } from "../src/password";
import { profileSchema } from "@coach/core";

const url = "https://nrrmhftccqsofjvoaffm.supabase.co";
const publishableKey = "sb_publishable_test-key";
const accessToken = "supabase-access-token-for-tests";
const password = "existing-password-12345";
const email = "learner@example.com";
const subject = "google-subject-123";
const userId = "00000000-0000-4000-8000-000000000001";
function providerUser() {
  return { id: userId, role: "authenticated", identities: [{
    id: subject, identity_id: "identity-row-id", provider: "google", user_id: userId,
    identity_data: { sub: subject, email, email_verified: true },
  }] };
}
async function setup(context: TestContext, fetchImpl: typeof fetch = async () => Response.json(providerUser())) {
  const store = new MemoryStore();
  const app = await buildApp(store, { oauth: { supabase: { enabled: true, url, publishableKey, fetchImpl } } });
  context.after(() => app.close());
  const signIn = (body: Record<string, unknown> = { accessToken }) => app.inject({
    method: "POST", url: "/v1/auth/supabase", payload: body,
  });
  return { app, store, signIn };
}

test("supabase: only explicit hosted URL and publishable key configuration is accepted", () => {
  const valid = { enabled: true, url, publishableKey };
  assert.equal(supabaseOAuthConfigured(valid), true);
  for (const invalid of [
    undefined, { ...valid, enabled: false }, { ...valid, publishableKey: "sb_secret_not-for-clients" },
    { ...valid, publishableKey: "service-role-token" }, { ...valid, url: "http://localhost:54321" },
    { ...valid, url: `${url}/extra` }, { ...valid, url: `${url}?other=true` },
    { ...valid, url: "https://nrrmhftccqsofjvoaffm.supabase.co.attacker.test" },
    { ...valid, url: "https://user:password@nrrmhftccqsofjvoaffm.supabase.co" },
  ]) assert.equal(supabaseOAuthConfigured(invalid), false);
});

test("supabase: disabled or missing config fails closed without calling a provider", async context => {
  const app = await buildApp(new MemoryStore(), { oauth: { supabase: { enabled: false } } });
  context.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/v1/auth/supabase", payload: { accessToken } });
  assert.equal(response.statusCode, 503);
});

test("supabase: identity is fetched from the pinned Auth server, not decoded from client claims", async () => {
  const identity = await supabaseGoogleIdentity(accessToken, {
    enabled: true, url, publishableKey,
    fetchImpl: async (input, init) => {
      assert.equal(String(input), `${url}/auth/v1/user`);
      assert.deepEqual(init?.headers, { apikey: publishableKey, Authorization: `Bearer ${accessToken}` });
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal);
      return Response.json(providerUser());
    },
  });
  assert.deepEqual(identity, { email, subject, emailVerified: true });
});

test("supabase: new Google account gets a revocable application session", async context => {
  const { app, store, signIn } = await setup(context);
  const response = await signIn();
  assert.equal(response.statusCode, 200);
  assert.match(response.json().token, /^[a-f0-9]{64}$/);
  assert.equal(response.json().user.email, email);
  assert.ok(response.json().user.emailVerifiedAt);
  assert.equal(store.accounts.size, 1);
  assert.equal(store.oauthIdentities.size, 1);
  assert.equal([...store.oauthIdentities.values()][0].subject, subject);
  const headers = { authorization: `Bearer ${response.json().token}` };
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 200);
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/logout", headers })).statusCode, 204);
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
});

test("supabase: password proof is required to link an unverified existing account", async context => {
  const { app, store, signIn } = await setup(context);
  const user = await store.createAccount(email, await hashPassword(password));
  const profile = profileSchema.parse({ displayName: "Existing learner", function: "Engineering", jobTitle: "Engineer",
    careerLevel: "Experienced individual contributor", audience: "My team", goal: "Present recommendations" });
  await store.saveProfile(user.id, profile);
  assert.equal((await signIn()).statusCode, 409);
  assert.equal((await signIn({ accessToken, password: "incorrect-password-123" })).statusCode, 401);
  assert.equal(store.oauthIdentities.size, 0);
  const response = await signIn({ accessToken, password });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, user.id);
  assert.equal(store.accounts.size, 1);
  assert.equal((await store.profile(user.id))?.displayName, profile.displayName);
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password } });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().user.id, user.id);
});

test("supabase: verified existing accounts retain their account ID", async context => {
  const { store, signIn } = await setup(context);
  const user = await store.createAccount(email, await hashPassword(password));
  await store.markEmailVerified(user.id, new Date());
  const response = await signIn();
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, user.id);
});

test("supabase: existing Google subjects remain authoritative when email changes", async context => {
  let returnedEmail = email;
  const { store, signIn } = await setup(context, async () => {
    const result = providerUser(); result.identities[0].identity_data.email = returnedEmail;
    return Response.json(result);
  });
  const first = await signIn();
  returnedEmail = "changed@example.com";
  await store.createAccount(returnedEmail, await hashPassword(password));
  const second = await signIn();
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().user.id, first.json().user.id);
  assert.equal(second.json().user.email, email);
});

test("supabase: rejects expired, foreign-project and forged sessions without account writes", async context => {
  const { store, signIn } = await setup(context, async () => Response.json({ message: "invalid JWT" }, { status: 401 }));
  assert.equal((await signIn()).statusCode, 401);
  assert.equal(store.accounts.size, 0);
  assert.equal(store.sessions.size, 0);
});

test("supabase: editable user metadata, email-only identities and unverified Google emails are refused", async context => {
  const results: unknown[] = [
    { ...providerUser(), identities: [], user_metadata: { sub: subject, email, email_verified: true, provider: "google" } },
    { ...providerUser(), identities: [{ ...providerUser().identities[0], provider: "email" }] },
    { ...providerUser(), identities: [{ ...providerUser().identities[0], user_id: "another-user" }] },
    { ...providerUser(), role: "service_role" },
    { ...providerUser(), identities: [{ ...providerUser().identities[0], identity_data: { sub: subject, email } }] },
    { ...providerUser(), identities: "invalid-shape" },
    null,
  ];
  for (const result of results) {
    await assert.rejects(supabaseGoogleIdentity(accessToken, {
      enabled: true, url, publishableKey, fetchImpl: async () => Response.json(result),
    }), { statusCode: 401 });
  }
  const { store, signIn } = await setup(context, async () => Response.json(results[0]));
  assert.equal((await signIn()).statusCode, 401);
  assert.equal(store.accounts.size, 0);
});

test("supabase: malformed input is rejected and credentials cannot inject identity claims", async context => {
  const { signIn, store } = await setup(context);
  for (const payload of [{ accessToken: "short" }, { accessToken, userId }, { accessToken, provider: "google" },
    { accessToken, password: "short" }]) {
    assert.equal((await signIn(payload)).statusCode, 400);
  }
  assert.equal(store.accounts.size, 0);
});

test("supabase: upstream failures are sanitized and retriable", async () => {
  for (const fetchImpl of [
    async () => Response.json({ secret: "provider-detail" }, { status: 503 }),
    async () => { throw new Error("secret-network-detail"); },
    async () => Response.json({}, { status: 429 }),
  ]) {
    await assert.rejects(supabaseGoogleIdentity(accessToken, { enabled: true, url, publishableKey, fetchImpl }),
      (error: Error & { statusCode?: number }) => error.statusCode === 503 && !/secret|provider-detail/.test(error.message));
  }
});

test("supabase: exchange throttling limits repeated password attempts", async context => {
  const { signIn } = await setup(context);
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await signIn({ accessToken: "short" })).statusCode, 400);
  assert.equal((await signIn()).statusCode, 429);
});
