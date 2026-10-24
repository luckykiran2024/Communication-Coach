import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";
import { verifiedGoogleSubscription, type StorePurchaseInput, type VerifiedStorePurchase } from "../src/store-verifier";
import { billingProvidersSchema, storeCredentialsConfigured } from "../src/billing-configuration";
import { productionConfigurationErrors } from "../src/config";

const sku = "com.communicationcoach.essential.monthly";
const now = new Date("2026-10-24T10:00:00Z");
const input: StorePurchaseInput = { provider: "google", productId: sku, purchaseToken: "fixture-token", transactionId: "forged" };
const google = {
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", testPurchase: {},
  externalAccountIdentifiers: { obfuscatedExternalAccountId: "owner-uuid" },
  lineItems: [{ productId: sku, expiryTime: "2026-11-24T10:00:00Z", latestSuccessfulOrderId: "GPA.provider-order" }],
};

test("billing verifier: Google order and account identity come from the provider, not the phone", () => {
  const verified = verifiedGoogleSubscription(google, input, now)!;
  assert.equal(verified.transactionId, "GPA.provider-order");
  assert.equal(verified.accountToken, "owner-uuid");
  assert.equal(verified.environment, "sandbox");
  assert.equal(verified.status, "active");
});

test("billing verifier: incomplete and pending subscription responses cannot unlock access", () => {
  for (const state of ["SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED", ""]) {
    assert.equal(verifiedGoogleSubscription({ ...google, subscriptionState: state }, input, now), null);
  }
  for (const lineItem of [
    { productId: sku }, { ...google.lineItems[0], expiryTime: "invalid" },
    { ...google.lineItems[0], productId: "unknown" }, { ...google.lineItems[0], latestSuccessfulOrderId: "" },
  ]) assert.equal(verifiedGoogleSubscription({ ...google, lineItems: [lineItem] }, input, now), null);
});

test("billing verifier: cancellation retains paid time, while expired and held subscriptions do not", () => {
  assert.equal(verifiedGoogleSubscription({ ...google, subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }, input, now)!.status,
    "active");
  assert.equal(verifiedGoogleSubscription(google, input, new Date("2026-12-01"))!.status, "expired");
  for (const state of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_EXPIRED"]) {
    assert.notEqual(verifiedGoogleSubscription({ ...google, subscriptionState: state }, input, now)!.status, "active");
  }
});

async function fixture(context: TestContext) {
  const store = new MemoryStore();
  let verified: VerifiedStorePurchase | null = null;
  const app = await buildApp(store, { now: () => now, billing: {
    enabled: true, webhookSecret: "fixture-only", productMap: { [sku]: "essential" },
    verifyPurchase: async () => verified,
  } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register",
    payload: { email: "billing-fixture@example.com", password: "test-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  const account = (await store.accountByEmail("billing-fixture@example.com"))!;
  const intent = await app.inject({ method: "POST", url: "/v1/billing/intents", headers,
    payload: { provider: "google", productId: sku } });
  const purchase = {
    purchaseIntentId: intent.json().intent.id, provider: "google", productId: sku,
    transactionId: "untrusted-client-order", purchaseToken: "fixture-token",
  };
  const proof = { ...verifiedGoogleSubscription(google, input, now)!, accountToken: account.id };
  return { app, store, headers, account, intent, purchase, proof, setProof(value: VerifiedStorePurchase | null) { verified = value; } };
}

test("billing HTTP: intents expose the account token and reject unknown or Free products", async context => {
  const data = await fixture(context);
  assert.equal(data.intent.statusCode, 201);
  assert.equal(data.intent.json().intent.accountToken, data.account.id);
  for (const productId of ["not-a-product", "com.communicationcoach.free.monthly"]) {
    assert.equal((await data.app.inject({ method: "POST", url: "/v1/billing/intents", headers: data.headers,
      payload: { provider: "google", productId } })).statusCode, 400);
  }
});

test("billing HTTP: new purchases require provider-verified account ownership", async context => {
  const data = await fixture(context);
  for (const accountToken of [undefined, null, "another-account"]) {
    data.setProof({ ...data.proof, accountToken });
    const response = await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify",
      headers: data.headers, payload: data.purchase });
    assert.equal(response.statusCode, 402);
  }
  assert.equal(await data.store.entitlement(data.account.id), null);
});

test("billing HTTP: canonical purchase verification is idempotent and reports actual access", async context => {
  const data = await fixture(context);
  data.setProof(data.proof);
  for (const expectedStatus of [201, 200]) {
    const response = await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify",
      headers: data.headers, payload: data.purchase });
    assert.equal(response.statusCode, expectedStatus);
    assert.equal(response.json().accessGranted, true);
    assert.equal(response.json().entitlement.transactionId, "GPA.provider-order");
  }
  data.setProof({ ...data.proof, status: "expired", expiresAt: new Date("2026-10-23") });
  const expired = await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify",
    headers: data.headers, payload: data.purchase });
  assert.equal(expired.json().verified, true);
  assert.equal(expired.json().accessGranted, false);
});

test("billing HTTP: neither renewal IDs nor restore can transfer another account's purchase", async context => {
  const data = await fixture(context);
  data.setProof(data.proof);
  await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify", headers: data.headers, payload: data.purchase });
  const second = await data.app.inject({ method: "POST", url: "/v1/auth/register",
    payload: { email: "second-billing@example.com", password: "test-password-123" } });
  const headers = { authorization: `Bearer ${second.json().token}` };
  const intent = await data.app.inject({ method: "POST", url: "/v1/billing/intents", headers,
    payload: { provider: "google", productId: sku } });
  const secondAccount = (await data.store.accountByEmail("second-billing@example.com"))!;
  data.setProof({ ...data.proof, transactionId: "new-renewal-order", accountToken: secondAccount.id });
  const response = await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify", headers,
    payload: { ...data.purchase, purchaseIntentId: intent.json().intent.id } });
  assert.equal(response.statusCode, 409);
  assert.equal(await data.store.entitlement(secondAccount.id), null);
});

test("billing HTTP: already-linked legacy purchases restore only to their original owner", async context => {
  const data = await fixture(context);
  data.setProof(data.proof);
  await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify", headers: data.headers, payload: data.purchase });
  data.setProof({ ...data.proof, accountToken: null });
  const response = await data.app.inject({ method: "POST", url: "/v1/billing/purchases/verify",
    headers: data.headers, payload: data.purchase });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().accessGranted, true);
});

test("billing configuration: Android-first setup requires Google credentials without pretending Apple is ready", () => {
  const env = { GOOGLE_PLAY_PACKAGE_NAME: "test.coach", GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@company.test",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "fixture-only" };
  assert.equal(storeCredentialsConfigured(env, ["google"]), true);
  assert.equal(storeCredentialsConfigured(env, ["apple"]), false);
  assert.equal(storeCredentialsConfigured(env, ["google", "apple"]), false);
  assert.equal(storeCredentialsConfigured(env, []), false);
  assert.deepEqual(billingProvidersSchema.parse(undefined), ["google", "apple"]);
  for (const value of ["", "razorpay", "google,", "google,google", "Google", " google"]) {
    assert.equal(billingProvidersSchema.safeParse(value).success, false);
  }
});

test("billing configuration: Apple-only production retains all safety gates without demanding Google notifications", () => {
  const errors = productionConfigurationErrors({ nodeEnv: "production", databaseUrl: "postgresql://db.internal/coach",
    devMemoryStore: false, corsOrigins: ["https://coach.company.test"], managerEmails: ["manager@company.test"],
    emailSenderConfigured: true, emailLinkBaseUrl: "https://coach.company.test", realtimeEnabled: false,
    billingEnabled: true, billingProviders: ["apple"], billingWebhookSecret: "fixture-only",
    billingProductMap: JSON.stringify({ [sku]: "essential" }), storeVerifierConfigured: true });
  assert.deepEqual(errors, []);
});

test("billing HTTP: unconfigured stores stay disabled during Android-first testing", async context => {
  const app = await buildApp(new MemoryStore(), { billing: {
    enabled: true, providers: ["google"], webhookSecret: "fixture-only",
  } });
  context.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/v1/auth/register",
    payload: { email: "android-only@example.com", password: "test-password-123" } });
  const headers = { authorization: `Bearer ${registration.json().token}` };
  assert.equal((await app.inject({ method: "POST", url: "/v1/billing/intents", headers,
    payload: { provider: "apple", productId: sku } })).statusCode, 503);
  assert.equal((await app.inject({ method: "POST", url: "/v1/billing/notifications/apple",
    payload: { signedPayload: "fixture" } })).statusCode, 503);
});
