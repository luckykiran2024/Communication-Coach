import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { deepLinkToSubscriptions, getAvailablePurchases, useIAP, type Purchase } from "expo-iap";
import Constants from "expo-constants";
import { request } from "./api";
import { monthlyStoreOffer, subscriptionRequest, verifyAndFinishPurchase, type StoreIntent, type SubscriptionChange } from "./purchase-flow";
import { Action, Copy } from "./ui";

type Props = {
  token: string; productId: string; productIds: string[];
  onComplete(): Promise<void>; onError(message: string): void;
};

export function StorePurchaseActions({ token, productId, productIds, onComplete, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pendingIntent = useRef<StoreIntent | null>(null);
  const handledPurchases = useRef(new Set<string>());
  const handlePurchaseRef = useRef<((purchase: Purchase) => Promise<void>) | null>(null);
  const provider = Platform.OS === "ios" ? "apple" as const : "google" as const;
  const basePlanId = process.env.EXPO_PUBLIC_GOOGLE_BASE_PLAN_ID ?? "monthly";

  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: purchase => { void handlePurchaseRef.current?.(purchase); },
    onPurchaseError: error => { setBusy(false); onError(error.message); },
    onError: error => { setBusy(false); onError(error.message); },
  });

  const createIntent = useCallback(async (sku: string) => {
    const response = await request<{ intent: StoreIntent }>("/v1/billing/intents", token, "POST", { provider, productId: sku });
    return response.intent;
  }, [provider, token]);

  const handlePurchase = useCallback(async (purchase: Purchase) => {
    if (!productIds.includes(purchase.productId)) return;
    const purchaseKey = `${purchase.productId}:${purchase.transactionId ?? purchase.purchaseToken ?? purchase.id}`;
    if (handledPurchases.current.has(purchaseKey)) return;
    handledPurchases.current.add(purchaseKey);
    setBusy(true);
    try {
      const result = await verifyAndFinishPurchase(purchase, productIds, {
        createIntent,
        verify: (item, intent) => request("/v1/billing/purchases/verify", token, "POST", {
          purchaseIntentId: intent.id, provider, productId: item.productId,
          transactionId: item.transactionId ?? item.id, purchaseToken: item.purchaseToken,
        }),
        finish: item => finishTransaction({ purchase: item, isConsumable: false }),
      }, purchase.productId === productId ? pendingIntent.current : null);
      if (result === "pending") {
        handledPurchases.current.delete(purchaseKey);
        setNotice("Payment is pending. Access will change only after the store confirms it.");
        return;
      }
      pendingIntent.current = null;
      if (result === "active") await onComplete();
      else setNotice("The purchase was verified, but no active subscription remains.");
    } catch (failure) {
      handledPurchases.current.delete(purchaseKey);
      pendingIntent.current = null;
      onError((failure as Error).message);
    } finally { setBusy(false); }
  }, [createIntent, finishTransaction, onComplete, onError, productId, productIds, provider, token]);
  handlePurchaseRef.current = handlePurchase;

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: [productId], type: "subs" }).catch(failure => onError((failure as Error).message));
  }, [connected, fetchProducts, onError, productId]);

  const product = subscriptions.find(item => item.id === productId);
  const monthlyOffer = product ? monthlyStoreOffer(product, basePlanId) : undefined;
  const storePrice = product?.platform === "android" ? monthlyOffer?.displayPrice : product?.displayPrice;
  const purchaseReady = Boolean(product && (product.platform === "ios" || monthlyOffer?.offerTokenAndroid));

  async function manageSubscription() {
    onError("");
    try {
      const packageName = Constants.expoConfig?.android?.package;
      if (Platform.OS === "android" && !packageName) throw new Error("The Android application identifier is unavailable.");
      await deepLinkToSubscriptions(Platform.OS === "android" ? { packageNameAndroid: packageName, skuAndroid: productId } : {});
    } catch (failure) { onError((failure as Error).message); }
  }

  async function buy() {
    if (!product || busy) return;
    setBusy(true); setNotice(""); onError("");
    try {
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const activePurchase = purchases.find(item => productIds.includes(item.productId) && item.purchaseState === "purchased");
      if (activePurchase?.productId === productId) {
        setNotice("This package is already active. Restore it if the app has not refreshed your access yet.");
        return;
      }
      let change: SubscriptionChange | undefined;
      if (Platform.OS === "android" && activePurchase) {
        if (!activePurchase.purchaseToken) throw new Error("Google Play did not return the current subscription token required to change plans.");
        change = { productId: activePurchase.productId, purchaseToken: activePurchase.purchaseToken };
      }
      const intent = await createIntent(productId);
      const purchase = subscriptionRequest(Platform.OS, product, intent.accountToken, basePlanId, change);
      pendingIntent.current = intent;
      await requestPurchase(purchase);
      if (change) setNotice("Google Play will schedule this package for your next renewal date. Your current package remains active until then.");
    } catch (failure) {
      pendingIntent.current = null;
      onError((failure as Error).message);
    } finally { setBusy(false); }
  }

  async function restore() {
    setBusy(true); setNotice(""); onError("");
    try {
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const matching = purchases.filter(item => productIds.includes(item.productId));
      if (!matching.length) setNotice("No previous Communication Coach purchases were found for this store account.");
      for (const purchase of matching) await handlePurchase(purchase);
    }
    catch (failure) { onError((failure as Error).message); }
    finally { setBusy(false); }
  }

  return <View style={{ gap: 12 }}>
    <Copy>{!connected ? "Connect to Apple or Google Play to continue."
      : storePrice ? `Store price: ${storePrice}`
        : "This subscription is unavailable. Check the store product and test account setup."}</Copy>
    <Action title="Continue to store payment" disabled={!connected || !purchaseReady || busy}
      busy={busy} onPress={() => void buy()} />
    <Action title="Restore previous purchase" secondary disabled={!connected || busy} onPress={() => void restore()} />
    <Action title="Manage store subscription" secondary disabled={busy} onPress={() => void manageSubscription()} />
    {Boolean(notice) && <Copy>{notice}</Copy>}
    <Copy>Subscriptions renew automatically until cancelled in your store account. Review the final price and terms there.</Copy>
    <Copy>Package changes are deferred to your next renewal date. C2Coach does not switch or prorate an active package mid-cycle.</Copy>
    <Copy>Access requires server verification. Test purchases must use a sandbox account and test payment method.</Copy>
  </View>;
}

