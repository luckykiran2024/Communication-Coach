import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProductSubscription, Purchase } from "expo-iap";
import { monthlyStoreOffer, paymentConfirmation, subscriptionRequest, verifyAndFinishPurchase } from "../apps/mobile/src/purchase-flow";

const accountToken = "12345678-1234-4234-8234-123456789012";
const sku = "com.c2coach.app.essential.monthly";
const product = {
  id: sku, platform: "android", type: "subs", title: "Essential", nameAndroid: "Essential",
  description: "15 monthly voice sessions", displayPrice: "₹299", currency: "INR",
  subscriptionOffers: [
    { id: "trial", basePlanIdAndroid: "monthly", offerTokenAndroid: "trial-offer", price: 0,
      displayPrice: "Free", type: "promotional" },
    { id: "annual", basePlanIdAndroid: "annual", offerTokenAndroid: "annual-offer", price: 2990,
      displayPrice: "₹2,990", type: "introductory" },
    { id: "monthly", basePlanIdAndroid: "monthly", offerTokenAndroid: "monthly-offer", price: 299,
      displayPrice: "₹299", type: "introductory" },
  ],
} satisfies ProductSubscription;
const purchase = {
  id: "order", productId: sku, purchaseState: "purchased", purchaseToken: "test-token", transactionId: "test-order",
} as Purchase;

test("billing mobile: Android uses the configured base plan and binds an opaque server account", () => {
  assert.deepEqual(subscriptionRequest("android", product, accountToken, "monthly"), {
    type: "subs", request: { google: { skus: [sku], obfuscatedAccountId: accountToken,
      subscriptionOffers: [{ sku, offerToken: "monthly-offer" }] } },
  });
});

test("billing mobile: Android plan changes replace the verified active subscription", () => {
  assert.deepEqual(subscriptionRequest("android", product, accountToken, "monthly", {
    productId: "com.c2coach.app.professional.monthly", purchaseToken: "existing-token",
  }), {
    type: "subs", request: { google: { skus: [sku], obfuscatedAccountId: accountToken,
      subscriptionOffers: [{ sku, offerToken: "monthly-offer" }], purchaseToken: "existing-token",
      subscriptionProductReplacementParams: {
        oldProductId: "com.c2coach.app.professional.monthly", replacementMode: "with-time-proration",
      } } },
  });
});

test("billing mobile: missing products, offers, identifiers and platform mismatches fail closed", () => {
  assert.throws(() => subscriptionRequest("android", product, accountToken, "missing"), /unavailable/);
  assert.throws(() => subscriptionRequest("android", product, "email@example.com", "monthly"), /identifier/);
  assert.throws(() => subscriptionRequest("web", product, accountToken, "monthly"), /matching/);
  assert.throws(() => subscriptionRequest("ios", product, accountToken, "monthly"), /matching/);
});

test("billing mobile: Apple carries the server appAccountToken", () => {
  const apple = { ...product, platform: "ios" } as ProductSubscription;
  assert.deepEqual(subscriptionRequest("ios", apple, accountToken, "monthly"), {
    type: "subs", request: { apple: { sku, appAccountToken: accountToken } },
  });
});

function dependencies() {
  const events: string[] = [];
  return { events,
    createIntent: async (productId: string) => { events.push(productId); return { id: "intent", accountToken }; },
    verify: async () => { events.push("verify"); return { verified: true, accessGranted: true }; },
    finish: async () => { events.push("finish"); },
  };
}

test("billing mobile: pending and unrelated purchases are never verified or acknowledged", async () => {
  const deps = dependencies();
  assert.equal(await verifyAndFinishPurchase({ ...purchase, purchaseState: "pending" }, [sku], deps), "pending");
  assert.equal(await verifyAndFinishPurchase({ ...purchase, productId: "another.app" }, [sku], deps), "ignored");
  assert.deepEqual(deps.events, []);
});

test("billing mobile: restoration creates an intent for the restored SKU, then verifies before finishing", async () => {
  const deps = dependencies();
  assert.equal(await verifyAndFinishPurchase(purchase, [sku], deps), "active");
  assert.deepEqual(deps.events, [sku, "verify", "finish"]);
});

test("billing mobile: verification failure leaves transactions unfinished for a later retry", async () => {
  const deps = dependencies();
  deps.verify = async () => { throw new Error("network unavailable"); };
  await assert.rejects(verifyAndFinishPurchase(purchase, [sku], deps), /network/);
  assert.deepEqual(deps.events, [sku]);
  deps.verify = async () => ({ verified: false, accessGranted: false });
  await assert.rejects(verifyAndFinishPurchase(purchase, [sku], deps), /could not verify/);
  assert.ok(!deps.events.includes("finish"));
});

test("billing mobile: an inactive verified purchase is not presented as paid access", async () => {
  const deps = dependencies();
  deps.verify = async () => ({ verified: true, accessGranted: false });
  assert.equal(await verifyAndFinishPurchase(purchase, [sku], deps), "inactive");
  assert.deepEqual(deps.events, [sku, "finish"]);
});

test("billing mobile: native and preview confirmations never misrepresent one another", () => {
  assert.match(paymentConfirmation(true), /No payment was taken and no paid access/);
  assert.match(paymentConfirmation(false), /store purchase is verified/);
  assert.doesNotMatch(paymentConfirmation(false), /preview/i);
});

test("billing mobile: native SDK base-plan IDs and promotional types cannot be confused", () => {
  assert.equal(monthlyStoreOffer(product, "monthly")?.displayPrice, "₹299");
  const offers = product.subscriptionOffers.map(item => item.id === "monthly" ? { ...item, type: "promotional" as const } : item);
  assert.equal(monthlyStoreOffer({ ...product, subscriptionOffers: offers }, "monthly"), undefined);
});
