import { readFileSync } from "node:fs";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from "@apple/app-store-server-library";
import { GoogleAuth, OAuth2Client } from "google-auth-library";

export type StorePurchaseInput = { provider: "apple" | "google"; productId: string; transactionId: string; purchaseToken: string };
export type VerifiedStorePurchase = { productId: string; transactionId: string; originalTransactionId: string | null; purchaseToken: string; status: "active" | "expired" | "revoked"; environment: "sandbox" | "production"; expiresAt: Date | null; providerEventDate: Date | null };
export type VerifiedAppleNotification = { notificationId: string; notificationType: string; productId: string; transactionId: string; originalTransactionId: string; status: "active" | "expired" | "revoked"; environment: "sandbox" | "production"; expiresAt: Date | null; providerEventDate: Date | null };
type AppleVerifierConfig = { privateKey: string; keyId: string; issuerId: string; bundleId: string; rootCertificates: Buffer[]; appAppleId?: number; environment: "sandbox" | "production" };
type GoogleVerifierConfig = { packageName: string; serviceAccountEmail: string; privateKey: string };

function appleEnvironment(environment: AppleVerifierConfig["environment"]) {
  return environment === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}

function normalizedPrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function entitlementStatus(expiresAt: Date | null, revoked: boolean, now: Date): VerifiedStorePurchase["status"] {
  if (revoked) return "revoked";
  if (expiresAt && expiresAt <= now) return "expired";
  return "active";
}

function dateFromMilliseconds(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}

function appleConfigFromEnv(env: NodeJS.ProcessEnv) {
  const appleRootPaths = (env.APPLE_ROOT_CERT_PATHS ?? "").split(",").map(path => path.trim()).filter(Boolean);
  const appleConfigured = Boolean(env.APPLE_PRIVATE_KEY && env.APPLE_KEY_ID && env.APPLE_ISSUER_ID && env.APPLE_BUNDLE_ID && appleRootPaths.length > 0);
  return appleConfigured ? { privateKey: env.APPLE_PRIVATE_KEY!, keyId: env.APPLE_KEY_ID!, issuerId: env.APPLE_ISSUER_ID!, bundleId: env.APPLE_BUNDLE_ID!, rootCertificates: appleRootPaths.map(path => readFileSync(path)), appAppleId: env.APPLE_APPLE_ID ? Number(env.APPLE_APPLE_ID) : undefined, environment: env.APPLE_ENVIRONMENT === "sandbox" ? "sandbox" as const : "production" as const } : undefined;
}

export function createAppleNotificationVerifier(config: AppleVerifierConfig, now = () => new Date()) {
  const verifier = new SignedDataVerifier(config.rootCertificates, true, appleEnvironment(config.environment), config.bundleId, config.appAppleId);
  return async (signedPayload: string): Promise<VerifiedAppleNotification | null> => {
    const payload = await verifier.verifyAndDecodeNotification(signedPayload);
    const data = payload.data;
    if (!payload.notificationUUID || !data?.signedTransactionInfo) return null;
    const transaction = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    if (!transaction.transactionId || !transaction.originalTransactionId || !transaction.productId || transaction.bundleId !== config.bundleId) return null;
    const expiresAt = dateFromMilliseconds(transaction.expiresDate);
    const revoked = transaction.revocationDate !== undefined || payload.notificationType === "REFUND" || payload.notificationType === "REVOKE";
    const expired = payload.notificationType === "EXPIRED";
    const status = expired ? "expired" : entitlementStatus(expiresAt, revoked, now());
    return {
      notificationId: payload.notificationUUID,
      notificationType: payload.notificationType ?? "UNKNOWN",
      productId: transaction.productId,
      transactionId: transaction.transactionId,
      originalTransactionId: transaction.originalTransactionId,
      status,
      environment: transaction.environment === Environment.SANDBOX ? "sandbox" : "production",
      expiresAt,
      providerEventDate: dateFromMilliseconds(payload.signedDate ?? transaction.signedDate),
    };
  };
}

export function createStorePurchaseVerifier(config: { apple?: AppleVerifierConfig; google?: GoogleVerifierConfig; now?: () => Date }) {
  const now = config.now ?? (() => new Date());
  const appleClient = config.apple ? new AppStoreServerAPIClient(normalizedPrivateKey(config.apple.privateKey), config.apple.keyId, config.apple.issuerId, config.apple.bundleId, appleEnvironment(config.apple.environment)) : null;
  const appleVerifier = config.apple ? new SignedDataVerifier(config.apple.rootCertificates, true, appleEnvironment(config.apple.environment), config.apple.bundleId, config.apple.appAppleId) : null;
  const googleAuth = config.google ? new GoogleAuth({ credentials: { client_email: config.google.serviceAccountEmail, private_key: normalizedPrivateKey(config.google.privateKey) }, scopes: ["https://www.googleapis.com/auth/androidpublisher"] }) : null;

  return async (input: StorePurchaseInput): Promise<VerifiedStorePurchase | null> => {
    if (input.provider === "apple") {
      if (!appleClient || !appleVerifier) return null;
      const response = await appleClient.getTransactionInfo(input.transactionId);
      if (!response.signedTransactionInfo) return null;
      const transaction = await appleVerifier.verifyAndDecodeTransaction(response.signedTransactionInfo);
      if (transaction.transactionId !== input.transactionId || transaction.productId !== input.productId || transaction.bundleId !== config.apple?.bundleId) return null;
      const expiresAt = dateFromMilliseconds(transaction.expiresDate);
      return { productId: transaction.productId, transactionId: transaction.transactionId, originalTransactionId: transaction.originalTransactionId ?? null, purchaseToken: input.purchaseToken, status: entitlementStatus(expiresAt, transaction.revocationDate !== undefined, now()), environment: transaction.environment === Environment.SANDBOX ? "sandbox" : "production", expiresAt, providerEventDate: dateFromMilliseconds(transaction.signedDate) };
    }
    if (!googleAuth || !config.google) return null;
    const client = await googleAuth.getClient();
    const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.google.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`;
    const response = await fetch(endpoint, { headers: await client.getRequestHeaders(endpoint) });
    if (!response.ok) return null;
    const purchase = await response.json() as { subscriptionState?: string; testPurchase?: unknown; lineItems?: Array<{ productId?: string; expiryTime?: string }> };
    const lineItem = purchase.lineItems?.find(item => item.productId === input.productId);
    if (!lineItem?.productId) return null;
    const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const state = purchase.subscriptionState ?? "";
    const activeState = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" || state === "SUBSCRIPTION_STATE_CANCELED";
    const status = activeState ? entitlementStatus(expiresAt, false, now()) : "revoked";
    return { productId: lineItem.productId, transactionId: input.transactionId, originalTransactionId: input.purchaseToken, purchaseToken: input.purchaseToken, status, environment: purchase.testPurchase ? "sandbox" : "production", expiresAt, providerEventDate: null };
  };
}

export function createStorePurchaseVerifierFromEnv(env: NodeJS.ProcessEnv) {
  const apple = appleConfigFromEnv(env);
  const googleConfigured = env.GOOGLE_PLAY_PACKAGE_NAME && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!apple && !googleConfigured) return undefined;
  return createStorePurchaseVerifier({
    apple,
    google: googleConfigured ? { packageName: env.GOOGLE_PLAY_PACKAGE_NAME!, serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY! } : undefined,
  });
}

export function createAppleNotificationVerifierFromEnv(env: NodeJS.ProcessEnv) {
  const apple = appleConfigFromEnv(env);
  return apple ? createAppleNotificationVerifier(apple) : undefined;
}

export function createGooglePubSubAuthenticator(audience: string) {
  const client = new OAuth2Client();
  return async (authorization: string | undefined) => {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return false;
    try {
      const ticket = await client.verifyIdToken({ idToken: token, audience });
      const payload = ticket.getPayload();
      return payload?.aud === audience && payload.email_verified === true;
    } catch {
      return false;
    }
  };
}

export function createGooglePubSubAuthenticatorFromEnv(env: NodeJS.ProcessEnv) {
  return env.GOOGLE_PUBSUB_AUDIENCE ? createGooglePubSubAuthenticator(env.GOOGLE_PUBSUB_AUDIENCE) : undefined;
}
