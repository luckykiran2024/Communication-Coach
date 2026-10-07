import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useIAP, type Purchase } from "expo-iap";
import { request } from "./api";
import { Action, Copy } from "./ui";

type Props = { token: string; productId: string; onComplete(): void; onError(message: string): void };

export function StorePurchaseActions({ token, productId, onComplete, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const pendingIntent = useRef<string | null>(null);
  const handledPurchases = useRef(new Set<string>());
  const handlePurchaseRef = useRef<((purchase: Purchase) => Promise<void>) | null>(null);
  const provider = Platform.OS === "ios" ? "apple" as const : "google" as const;

  const { connected, subscriptions, availablePurchases, fetchProducts, requestPurchase, getAvailablePurchases, finishTransaction } = useIAP({
    onPurchaseSuccess: purchase => { void handlePurchaseRef.current?.(purchase); },
    onPurchaseError: error => onError(error.message),
    onError: error => onError(error.message),
  });

  const handlePurchase = useCallback(async (purchase: Purchase) => {
    const purchaseKey = `${purchase.productId}:${purchase.transactionId ?? purchase.purchaseToken ?? purchase.id}`;
    if (handledPurchases.current.has(purchaseKey)) return;
    handledPurchases.current.add(purchaseKey);
    try {
      const purchaseToken = purchase.purchaseToken;
      if (!purchaseToken) throw new Error("The store did not return a verifiable purchase token.");
      const intentId = pendingIntent.current ?? (await request<{ intent: { id: string } }>("/v1/billing/intents", token, "POST", { provider, productId })).intent.id;
      const transactionId = purchase.transactionId ?? purchase.id;
      await request("/v1/billing/purchases/verify", token, "POST", { purchaseIntentId: intentId, provider, productId: purchase.productId, transactionId, purchaseToken });
      await finishTransaction({ purchase, isConsumable: false });
      pendingIntent.current = null;
      onComplete();
    } catch (failure) {
      handledPurchases.current.delete(purchaseKey);
      onError((failure as Error).message);
    }
  }, [finishTransaction, onComplete, onError, productId, provider, token]);
  handlePurchaseRef.current = handlePurchase;

  useEffect(() => {
    if (!connected) return;
    void fetchProducts({ skus: [productId], type: "subs" }).catch(failure => onError((failure as Error).message));
  }, [connected, fetchProducts, onError, productId]);

  useEffect(() => {
    for (const purchase of availablePurchases) void handlePurchase(purchase);
  }, [availablePurchases, handlePurchase]);

  async function buy() {
    setBusy(true);
    try {
      const intent = await request<{ intent: { id: string } }>("/v1/billing/intents", token, "POST", { provider, productId });
      pendingIntent.current = intent.intent.id;
      await requestPurchase({ request: Platform.OS === "ios" ? { apple: { sku: productId } } : { google: { skus: [productId] } }, type: "subs" });
    } catch (failure) {
      pendingIntent.current = null;
      onError((failure as Error).message);
    } finally { setBusy(false); }
  }

  async function restore() {
    setBusy(true);
    try { await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true }); }
    catch (failure) { onError((failure as Error).message); }
    finally { setBusy(false); }
  }

  const product = subscriptions.find(item => item.id === productId);
  return <View style={{ gap: 12 }}><Copy>{connected ? product?.displayPrice ? `Store price: ${product.displayPrice}` : "Store package loaded. Final price is shown by Apple or Google." : "Connect to Apple or Google Play to continue."}</Copy><Action title="Continue to store payment" disabled={!connected || busy} busy={busy} onPress={() => void buy()} /><Action title="Restore previous purchase" secondary disabled={!connected || busy} onPress={() => void restore()} /><Copy>Payment is verified by the server before this transaction is finished. No client-side confirmation grants access.</Copy></View>;
}
