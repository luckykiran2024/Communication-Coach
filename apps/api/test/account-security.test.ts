import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { ConflictError, type EmailToken } from "../src/store";
import { ConsoleEmailSender, ResendEmailSender, createEmailSender, type AccountEmail } from "../src/email-sender";
import { productionConfigurationErrors } from "../src/config";
import { safeEqual } from "../src/lib/safe-equal";

const credentials = { email: "security@example.com", password: "initial-password-12345" };
const newPassword = "replacement-password-12345";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function setup(context: TestContext) {
  const store = new MemoryStore();
  const emails: AccountEmail[] = [];
  let now = new Date("2026-10-10T12:00:00Z");
  const app = await buildApp(store, {
    now: () => now,
    email: { sender: { async send(message) { emails.push(message); } }, linkBaseUrl: "communicationcoach://" },
    oauth: {
      googleClientIds: ["google-client"],
      fetchImpl: async () => Response.json({
        email: credentials.email, sub: "google-owner", aud: "google-client", email_verified: true,
      }),
    },
  });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: credentials });
  assert.equal(registration.statusCode, 201);
  const userId: string = registration.json().user.id;
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const post = (path: string, payload?: Record<string, unknown>) => app.inject({
    method: "POST", url: `/v1/auth/${path}`, headers, payload,
  });
  return { app, store, emails, userId, headers, post, setNow(value: Date) { now = value; } };
}

test("security: pre-registered unverified email cannot be linked through Google", async context => {
  const { post, store } = await setup(context);
  const response = await post("oauth", { provider: "google", accessToken: "valid-google-token-1234" });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error, "Verify this email with your password first, or reset your password.");
  assert.equal(store.oauthIdentities.size, 0);
});

test("security: verification requires owner and password, then permits verified Google linking", async context => {
  const { app, post, store, emails, userId } = await setup(context);
  assert.equal((await post("verify-email/request")).statusCode, 200);
  const code = emails[0].token;
  assert.match(emails[0].link, /^communicationcoach:\/\/verify-email\?token=/);
  assert.equal(store.emailTokens.has(code), false);
  assert.ok(store.emailTokens.has(hash(code)));
  assert.equal((await post("verify-email/confirm", { token: code, password: "wrong-password-12345" })).statusCode, 401);
  const other = await app.inject({
    method: "POST", url: "/v1/auth/register", payload: { ...credentials, email: "other@example.com" },
  });
  const otherConfirm = await app.inject({
    method: "POST", url: "/v1/auth/verify-email/confirm",
    headers: { authorization: `Bearer ${other.json().token}` }, payload: { token: code, password: credentials.password },
  });
  assert.equal(otherConfirm.statusCode, 400);
  assert.equal((await post("verify-email/confirm", { token: code, password: credentials.password })).statusCode, 200);
  assert.equal((await post("verify-email/confirm", { token: code, password: credentials.password })).statusCode, 400);
  const oauth = await post("oauth", { provider: "google", accessToken: "valid-google-token-1234" });
  assert.equal(oauth.statusCode, 200);
  assert.equal(oauth.json().user.id, userId);
  assert.ok(oauth.json().user.emailVerifiedAt);
});

test("security: new Google accounts are verified, but unverified provider emails fail", async context => {
  let verified = true;
  const store = new MemoryStore();
  const app = await buildApp(store, {
    oauth: { googleClientIds: ["client"], fetchImpl: async () => Response.json({
      email: "new-google@example.com", sub: "google-sub", aud: "client", email_verified: verified,
    }) },
  });
  context.after(() => app.close());
  const payload = { provider: "google", accessToken: "valid-google-token-1234" };
  const first = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload });
  assert.equal(first.statusCode, 200);
  assert.ok(first.json().user.emailVerifiedAt);
  verified = false;
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/oauth", payload })).statusCode, 401);
});

test("security: expired verification and reset links fail at the exact 30-minute boundary", async context => {
  const { post, emails, setNow, store, userId } = await setup(context);
  await post("verify-email/request");
  await post("password-reset/request", { email: credentials.email });
  setNow(new Date("2026-10-10T12:30:00Z"));
  for (const [index, path] of ["verify-email/confirm", "password-reset/confirm"].entries()) {
    const response = await post(path, { token: emails[index].token, password: credentials.password });
    assert.equal(response.statusCode, 400);
  }
  assert.equal((await store.accountById(userId))?.emailVerifiedAt, null);
});

test("security: verification requests are capped per account across sessions and reset after one hour", async context => {
  const { app, post, emails, setNow } = await setup(context);
  const attempts = await Promise.all(Array.from({ length: 8 }, () => post("verify-email/request")));
  assert.equal(attempts.filter(response => response.statusCode === 200).length, 3);
  assert.equal(attempts.filter(response => response.statusCode === 429).length, 5);
  const login = await post("login", credentials);
  assert.equal((await app.inject({
    method: "POST", url: "/v1/auth/verify-email/request",
    headers: { authorization: `Bearer ${login.json().token}` },
  })).statusCode, 429);
  setNow(new Date("2026-10-10T13:00:00Z"));
  assert.equal((await post("verify-email/request")).statusCode, 200);
  assert.equal(emails.length, 4);
});

test("security: reset requests do not reveal existence or account throttling", async context => {
  const { post, emails } = await setup(context);
  const known = await post("password-reset/request", { email: credentials.email });
  const missing = await post("password-reset/request", { email: "absent@example.com" });
  assert.equal(known.statusCode, missing.statusCode);
  assert.deepEqual(known.json(), missing.json());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.deepEqual((await post("password-reset/request", { email: credentials.email })).json(), missing.json());
  }
  assert.equal(emails.length, 3);
});

test("security: failed email delivery does not reveal account existence", async context => {
  const store = new MemoryStore();
  await store.createAccount(credentials.email, "hash");
  const app = await buildApp(store, { email: { sender: { async send() { throw new Error("private provider detail"); } } } });
  context.after(() => app.close());
  const responses = await Promise.all([credentials.email, "missing@example.com"].map(email =>
    app.inject({ method: "POST", url: "/v1/auth/password-reset/request", payload: { email } })));
  assert.equal(responses[0].statusCode, 200);
  assert.deepEqual(responses[0].json(), responses[1].json());
  assert.doesNotMatch(responses[0].body, /private provider detail/);
});

test("security: reset consumes token once, revokes every session and outstanding token, and changes password", async context => {
  const { app, post, emails, store, userId, headers } = await setup(context);
  await post("verify-email/request");
  await post("password-reset/request", { email: credentials.email });
  await post("password-reset/request", { email: credentials.email });
  const secondSession = await post("login", credentials);
  const oldHash = (await store.accountById(userId))!.passwordHash;
  const payload = { token: emails[1].token, password: newPassword };
  const confirmations = await Promise.all([post("password-reset/confirm", payload), post("password-reset/confirm", payload)]);
  assert.deepEqual(confirmations.map(response => response.statusCode).sort(), [200, 400]);
  assert.equal((await app.inject({ url: "/v1/me", headers })).statusCode, 401);
  assert.equal((await app.inject({
    url: "/v1/me", headers: { authorization: `Bearer ${secondSession.json().token}` },
  })).statusCode, 401);
  assert.equal(store.sessions.size, 0);
  assert.equal((await post("password-reset/confirm", { token: emails[2].token, password: newPassword })).statusCode, 400);
  assert.equal((await post("login", credentials)).statusCode, 401);
  assert.equal((await post("login", { ...credentials, password: newPassword })).statusCode, 200);
  assert.ok((await store.accountById(userId))?.emailVerifiedAt);
  await assert.rejects(() => store.createSession({
    tokenHash: hash("stale-login"), userId, expiresAt: new Date("2026-10-11"),
  }, oldHash), ConflictError);
  assert.equal(await store.consumeEmailToken(hash(emails[0].token), "verify_email", new Date(), userId), null);
});

test("security: verification tokens cannot reset a password and reset tokens cannot verify an email", async context => {
  const { post, emails } = await setup(context);
  await post("verify-email/request");
  await post("password-reset/request", { email: credentials.email });
  assert.equal((await post("password-reset/confirm", { token: emails[0].token, password: newPassword })).statusCode, 400);
  assert.equal((await post("verify-email/confirm", { token: emails[1].token, password: credentials.password })).statusCode, 400);
});

test("security: email endpoints fail closed without delivery and verification requires authentication", async context => {
  const app = await buildApp(new MemoryStore(), { email: { sender: null } });
  context.after(() => app.close());
  assert.equal((await app.inject({ method: "POST", url: "/v1/auth/verify-email/request" })).statusCode, 401);
  for (const email of ["exists@example.com", "missing@example.com"]) {
    const response = await app.inject({ method: "POST", url: "/v1/auth/password-reset/request", payload: { email } });
    assert.equal(response.statusCode, 503);
  }
});

test("security: account deletion removes hashed email tokens", async context => {
  const { post, store, userId } = await setup(context);
  await post("verify-email/request");
  await store.deleteAccount(userId);
  assert.equal(store.emailTokens.size, 0);
});

test("security: Microsoft verifies JWT signature, audience, issuer, expiry and oid/tid identity", async context => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const tid = randomUUID();
  const oid = randomUUID();
  const clientId = randomUUID();
  const store = new MemoryStore();
  const now = new Date("2026-10-10T12:00:00Z");
  const app = await buildApp(store, {
    now: () => now, oauth: { microsoftClientIds: [clientId], microsoftJwks: createLocalJWKSet({ keys: [publicJwk] }) },
  });
  context.after(() => app.close());
  async function token(overrides: Record<string, unknown> = {}, audience = clientId, key = privateKey) {
    return new SignJWT({ tid, oid, email: "microsoft@example.com", ...overrides })
      .setProtectedHeader({ alg: "RS256" }).setSubject("tenant-subject").setAudience(audience)
      .setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
      .setIssuedAt(Math.floor(now.getTime() / 1000)).setExpirationTime(Math.floor(now.getTime() / 1000) + 600)
      .sign(key);
  }
  const post = (idToken: string) => app.inject({ method: "POST", url: "/v1/auth/oauth", payload: { provider: "microsoft", idToken } });
  assert.equal((await post(await token({}, randomUUID()))).statusCode, 401);
  const wrongKey = await generateKeyPair("RS256");
  assert.equal((await post(await token({}, clientId, wrongKey.privateKey))).statusCode, 401);
  assert.equal((await post(await token({ tid: randomUUID() }))).statusCode, 401);
  assert.equal((await post(await token({ oid: "not-an-object-id" }))).statusCode, 401);
  const expired = await new SignJWT({ tid, oid, email: "microsoft@example.com" }).setProtectedHeader({ alg: "RS256" })
    .setSubject("subject").setAudience(clientId).setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setIssuedAt(1).setExpirationTime(2).sign(privateKey);
  assert.equal((await post(expired)).statusCode, 401);
  const signed = await token();
  const first = await post(signed);
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().user.emailVerifiedAt, null);
  assert.ok(await store.oauthIdentity("microsoft", `${tid}:${oid}`));
  const returning = await post(await token({ email: "changed@example.com" }));
  assert.equal(returning.json().user.id, first.json().user.id);
  assert.equal(returning.json().user.email, "microsoft@example.com");
  const resetHash = hash("recovery-proof");
  await store.issueEmailToken({
    tokenHash: resetHash, userId: first.json().user.id, purpose: "password_reset",
    createdAt: now, expiresAt: new Date(now.getTime() + 1800000), usedAt: null,
  }, 3);
  assert.ok(await store.consumeEmailToken(resetHash, "password_reset", now, undefined, "recovered-password-hash"));
  assert.equal(store.oauthIdentities.size, 0);
  assert.equal((await post(signed)).statusCode, 409);
});

test("security: Microsoft never links accounts by an unverified email claim", async context => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const tid = randomUUID();
  const oid = randomUUID();
  const store = new MemoryStore();
  const user = await store.createAccount(credentials.email, "password-hash");
  await store.markEmailVerified(user.id, new Date());
  const app = await buildApp(store, {
    oauth: { microsoftClientIds: ["client"], microsoftJwks: createLocalJWKSet({ keys: [await exportJWK(publicKey)] }) },
  });
  context.after(() => app.close());
  const idToken = await new SignJWT({ tid, oid, email: credentials.email, email_verified: true })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("subject").setAudience("client").setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);
  const response = await app.inject({ method: "POST", url: "/v1/auth/oauth", payload: { provider: "microsoft", idToken } });
  assert.equal(response.statusCode, 409);
  assert.equal(store.oauthIdentities.size, 0);
  assert.equal((await app.inject({
    method: "POST", url: "/v1/auth/oauth", payload: { provider: "microsoft", accessToken: "old-graph-token-1234567" },
  })).statusCode, 400);
});

test("security: production disables console email and requires real sender plus HTTPS links", async () => {
  const prior = process.env.NODE_ENV;
  let logged = false;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(() => new ConsoleEmailSender(() => { logged = true; }).send({
      to: credentials.email, purpose: "verify_email", token: "secret", link: "secret",
    }));
    assert.equal(logged, false);
    assert.equal(createEmailSender({ NODE_ENV: "production", EMAIL_PROVIDER: "console" }), null);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
  const config = {
    nodeEnv: "production", databaseUrl: "postgresql://database/coach", devMemoryStore: false,
    corsOrigins: ["https://coach.acme.co"], managerEmails: ["manager@acme.co"],
    realtimeEnabled: false, billingEnabled: false, storeVerifierConfigured: false,
    emailSenderConfigured: true, emailLinkBaseUrl: "https://coach.acme.co",
  };
  assert.deepEqual(productionConfigurationErrors(config), []);
  assert.match(productionConfigurationErrors({ ...config, emailSenderConfigured: false }).join(" "), /EMAIL_PROVIDER/);
  assert.match(productionConfigurationErrors({ ...config, emailLinkBaseUrl: "http://localhost" }).join(" "), /HTTPS/);
  assert.match(productionConfigurationErrors({ ...config, microsoftClientIds: ["placeholder"] }).join(" "), /MICROSOFT/);
});

test("security: Resend adapter sends text-only single-use links and sanitizes provider failures", async () => {
  const calls: RequestInit[] = [];
  const sender = new ResendEmailSender("test-key", "coach@acme.co", async (_url, init) => {
    calls.push(init!);
    return Response.json({ id: "message-id" });
  });
  await sender.send({ to: credentials.email, purpose: "password_reset", link: "https://coach.acme.co/password-reset", token: "code" });
  const body = JSON.parse(calls[0].body as string);
  assert.equal(body.subject, "Reset your Communication Coach password");
  assert.match(body.text, /30 minutes/);
  assert.equal(body.html, undefined);
  const failing = new ResendEmailSender("test-key", "coach@acme.co", async () =>
    new Response("sensitive provider detail", { status: 500 }));
  await assert.rejects(() => failing.send({ to: "", purpose: "verify_email", link: "", token: "" }), /Account email delivery failed/);
});

test("security: constant-time secret boundary handles malformed and different-length values", () => {
  assert.equal(safeEqual("secret", "secret"), true);
  for (const input of [undefined, null, ["secret"], "", "short", "different-secret"]) assert.equal(safeEqual(input, "secret"), false);
  assert.equal(safeEqual("", ""), false);
});

test("security: token issuance is atomic independently of request throttles", async () => {
  const store = new MemoryStore();
  const user = await store.createAccount(credentials.email, "hash");
  const now = new Date("2026-10-10T12:00:00Z");
  const tokens: EmailToken[] = Array.from({ length: 10 }, () => ({
    userId: user.id, tokenHash: hash(randomUUID()), purpose: "verify_email",
    createdAt: now, expiresAt: new Date(now.getTime() + 1800000), usedAt: null,
  }));
  const result = await Promise.all(tokens.map(token => store.issueEmailToken(token, 3)));
  assert.equal(result.filter(Boolean).length, 3);
});
