import type { ProductSubscription, Purchase, RequestPurchaseProps } from "expo-iap";

export type StoreIntent = { id: string; accountToken: string };
export type SubscriptionChange = { productId: string; purchaseToken: string };
type PurchaseResult = { verified: boolean; accessGranted: boolean };
type PurchaseDependencies = {
  createIntent(productId: string): Promise<StoreIntent>;
  verify(purchase: Purchase, intent: StoreIntent): Promise<PurchaseResult>;
  finish(purchase: Purchase): Promise<void>;
};

export function monthlyStoreOffer(product: ProductSubscription, basePlanId: string) {
  return product.platform === "android"
    ? product.subscriptionOffers.find(item => item.basePlanIdAndroid === basePlanId
      && item.id === basePlanId && item.type === "introductory") : undefined;
}

export function subscriptionRequest(
  platform: string, product: ProductSubscription, accountToken: string, basePlanId: string,
  change?: SubscriptionChange,
): RequestPurchaseProps {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountToken)) {
    throw new Error("The server did not return a valid billing account identifier.");
  }
  if (platform === "ios" && product.platform === "ios") {
    return { type: "subs", request: { apple: { sku: product.id, appAccountToken: accountToken } } };
  }
  if (platform !== "android" || product.platform !== "android") {
    throw new Error("Subscription purchases require the matching Android or iOS store.");
  }
  const offer = monthlyStoreOffer(product, basePlanId);
  if (!offer?.offerTokenAndroid) {
    throw new Error("The monthly subscription is unavailable. Check the store product and base-plan setup.");
  }
  return {
    type: "subs",
    request: { google: {
      skus: [product.id], obfuscatedAccountId: accountToken,
      subscriptionOffers: [{ sku: product.id, offerToken: offer.offerTokenAndroid }],
      ...(change ? {
        purchaseToken: change.purchaseToken,
        subscriptionProductReplacementParams: {
          oldProductId: change.productId,
          replacementMode: "deferred" as const,
        },
      } : {}),
    } },
  };
}

export async function verifyAndFinishPurchase(
  purchase: Purchase, productIds: string[], dependencies: PurchaseDependencies, intent?: StoreIntent | null,
) {
  if (!productIds.includes(purchase.productId)) return "ignored" as const;
  if (purchase.purchaseState === "pending") return "pending" as const;
  if (purchase.purchaseState !== "purchased") throw new Error("The store has not completed this purchase.");
  if (!purchase.purchaseToken) throw new Error("The store did not return a verifiable purchase token.");
  const matchingIntent = intent ?? await dependencies.createIntent(purchase.productId);
  const result = await dependencies.verify(purchase, matchingIntent);
  if (!result.verified) throw new Error("The server could not verify this purchase.");
  await dependencies.finish(purchase);
  return result.accessGranted ? "active" as const : "inactive" as const;
}

export function paymentConfirmation(preview: boolean) {
  return preview
    ? "Preview complete. No payment was taken and no paid access was granted."
    : "Your store purchase is verified. Your practice access has been refreshed.";
}

