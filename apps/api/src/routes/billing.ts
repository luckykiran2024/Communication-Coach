import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Entitlement, PurchaseIntent } from "../store";
import { ApiError } from "../lib/errors";
import { authenticate } from "../lib/auth-context";
import { safeEqual } from "../lib/safe-equal";
import type { RouteDependencies } from "./context";

const billingWebhookSchema = z.object({
  purchaseIntentId: z.string().uuid(),
  productId: z.string().min(1).max(200),
  transactionId: z.string().min(1).max(300),
  originalTransactionId: z.string().min(1).max(300).optional(),
  purchaseToken: z.string().min(1).max(50000).optional(),
  status: z.enum(["active", "expired", "revoked"]),
  environment: z.enum(["sandbox", "production"]),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict();
const billingPurchaseSchema = z.object({
  purchaseIntentId: z.string().uuid(),
  provider: z.enum(["apple", "google"]),
  productId: z.string().min(1).max(200),
  transactionId: z.string().min(1).max(300),
  purchaseToken: z.string().min(1).max(50000),
}).strict();
const appleNotificationSchema = z.object({ signedPayload: z.string().min(1).max(100000) }).strict();
const googlePubSubSchema = z.object({
  message: z.object({ data: z.string().min(1).max(100000), messageId: z.string().min(1).max(200).optional() }).strict(),
  subscription: z.string().min(1).max(500).optional(),
}).strict();
const googleSubscriptionNotificationSchema = z.object({
  packageName: z.string().min(1).max(300),
  eventTimeMillis: z.string().regex(/^\d+$/),
  subscriptionNotification: z.object({
    purchaseToken: z.string().min(1).max(50000),
    subscriptionId: z.string().min(1).max(200),
    notificationType: z.number().int().min(1).max(20),
  }).strict().optional(),
}).strict();
const purchaseIntentSchema = z.object({ provider: z.enum(["apple", "google"]), productId: z.string().min(1).max(200) }).strict();

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/me/entitlement", async request => {
    const { user } = await authenticate(request, deps);
    return { entitlement: await deps.store.entitlement(user.id) };
  });
  app.post("/v1/billing/intents", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (!deps.billingEnabled || !deps.billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const parsed = purchaseIntentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid Apple or Google product.");
    const timestamp = deps.now();
    const intent: PurchaseIntent = {
      id: randomUUID(),
      userId: user.id,
      provider: parsed.data.provider,
      productId: parsed.data.productId,
      nonce: randomBytes(24).toString("base64url"),
      status: "pending",
      createdAt: timestamp,
      expiresAt: new Date(timestamp.getTime() + 15 * 60_000),
    };
    await deps.store.createPurchaseIntent(intent);
    return reply.code(201).send({
      intent: {
        id: intent.id,
        provider: intent.provider,
        productId: intent.productId,
        nonce: intent.nonce,
        status: intent.status,
        expiresAt: intent.expiresAt.toISOString(),
      },
      message: "Purchase intent created. Include the nonce in the store purchase and send only verified store events to the webhook.",
    });
  });
  app.post("/v1/billing/webhooks/:provider", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const provider = (request.params as { provider?: string }).provider;
    if (provider !== "apple" && provider !== "google") throw new ApiError(400, "Choose Apple or Google as the billing provider.");
    if (!safeEqual(request.headers["x-billing-webhook-secret"], deps.billingWebhookSecret)) {
      throw new ApiError(401, "Billing webhook authentication failed.");
    }
    const parsed = billingWebhookSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid entitlement event.");
    const intent = await deps.store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.status === "cancelled" || (intent.status === "pending" && intent.expiresAt <= deps.now())) {
      throw new ApiError(409, "The purchase intent is missing or expired.");
    }
    if (intent.provider !== provider || intent.productId !== parsed.data.productId) throw new ApiError(409, "The store event does not match the purchase intent.");
    const user = await deps.store.accountById(intent.userId);
    if (!user) throw new ApiError(404, "The entitlement account was not found.");
    const existing = await deps.store.entitlementByTransactionId(parsed.data.transactionId);
    if (existing && (existing.userId !== intent.userId || existing.provider !== provider || existing.productId !== parsed.data.productId)) {
      throw new ApiError(409, "The transaction is already linked to another entitlement.");
    }
    const timestamp = deps.now();
    const entitlement: Entitlement = {
      id: existing?.id ?? randomUUID(),
      userId: intent.userId,
      provider,
      productId: parsed.data.productId,
      transactionId: parsed.data.transactionId,
      originalTransactionId: parsed.data.originalTransactionId ?? null,
      purchaseToken: parsed.data.purchaseToken ?? null,
      status: parsed.data.status,
      environment: parsed.data.environment,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      providerEventDate: null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const idempotent = Boolean(existing && existing.status === entitlement.status && existing.environment === entitlement.environment && existing.expiresAt?.getTime() === entitlement.expiresAt?.getTime());
    await deps.store.saveEntitlement(entitlement);
    await deps.store.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, received: true, idempotent });
  });
  app.post("/v1/billing/purchases/verify", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (!deps.billingEnabled || !deps.billingWebhookSecret || !deps.billing?.verifyPurchase) {
      throw new ApiError(503, "Store purchase verification is not configured.");
    }
    const parsed = billingPurchaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the store purchase details for verification.");
    const intent = await deps.store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.userId !== user.id || intent.status === "cancelled" || (intent.status === "pending" && intent.expiresAt <= deps.now())) {
      throw new ApiError(409, "The purchase intent is missing or expired.");
    }
    if (intent.provider !== parsed.data.provider || intent.productId !== parsed.data.productId) {
      throw new ApiError(409, "The purchase does not match the selected package.");
    }
    let verified;
    try {
      verified = await deps.billing.verifyPurchase({
        provider: parsed.data.provider,
        productId: parsed.data.productId,
        transactionId: parsed.data.transactionId,
        purchaseToken: parsed.data.purchaseToken,
      });
    } catch {
      throw new ApiError(503, "The store verification service is temporarily unavailable.");
    }
    if (!verified || verified.productId !== intent.productId || verified.transactionId !== parsed.data.transactionId) {
      throw new ApiError(402, "The store purchase could not be verified.");
    }
    const existing = await deps.store.entitlementByTransactionId(verified.transactionId);
    if (existing && existing.userId !== user.id) throw new ApiError(409, "The transaction is already linked to another account.");
    const timestamp = deps.now();
    const entitlement: Entitlement = {
      id: existing?.id ?? randomUUID(),
      userId: user.id,
      provider: parsed.data.provider,
      productId: verified.productId,
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      purchaseToken: verified.purchaseToken,
      status: verified.status,
      environment: verified.environment,
      expiresAt: verified.expiresAt,
      providerEventDate: verified.providerEventDate,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await deps.store.saveEntitlement(entitlement);
    await deps.store.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, verified: true });
  });
  app.post("/v1/billing/notifications/apple", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billing?.verifyAppleNotification) {
      throw new ApiError(503, "Apple notification verification is not configured.");
    }
    const parsed = appleNotificationSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the signed Apple notification payload.");
    let notification;
    try {
      notification = await deps.billing.verifyAppleNotification(parsed.data.signedPayload);
    } catch {
      throw new ApiError(400, "The Apple notification signature could not be verified.");
    }
    if (!notification || !deps.planForProduct(notification.productId)) {
      throw new ApiError(400, "The Apple notification is invalid or references an unknown product.");
    }
    const byOriginal = await deps.store.entitlementByOriginalTransactionId("apple", notification.originalTransactionId);
    const byTransaction = await deps.store.entitlementByTransactionId(notification.transactionId);
    if (byTransaction && byTransaction.userId !== byOriginal?.userId) throw new ApiError(409, "The Apple transaction is linked to another account.");
    const existing = byOriginal ?? byTransaction;
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    if (existing.providerEventDate && notification.providerEventDate && notification.providerEventDate <= existing.providerEventDate) {
      return reply.send({ received: true, matched: true, idempotent: true });
    }
    const timestamp = deps.now();
    const entitlement: Entitlement = {
      id: existing.transactionId === notification.transactionId ? existing.id : randomUUID(),
      userId: existing.userId,
      provider: "apple",
      productId: notification.productId,
      transactionId: notification.transactionId,
      originalTransactionId: notification.originalTransactionId,
      purchaseToken: existing.purchaseToken,
      status: notification.status,
      environment: notification.environment,
      expiresAt: notification.expiresAt,
      providerEventDate: notification.providerEventDate,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    };
    await deps.store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app.post("/v1/billing/notifications/google", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billing?.verifyPurchase) {
      throw new ApiError(503, "Google notification verification is not configured.");
    }
    const oidcAuthenticated = deps.billing.verifyGoogleNotificationRequest
      ? await deps.billing.verifyGoogleNotificationRequest(request.headers.authorization)
      : false;
    const sharedSecretAuthenticated = Boolean(
      safeEqual(request.headers["x-google-pubsub-secret"], deps.googleNotificationSecret),
    );
    if (!oidcAuthenticated && !sharedSecretAuthenticated) throw new ApiError(401, "Google notification authentication failed.");
    const envelope = googlePubSubSchema.safeParse(request.body);
    if (!envelope.success) throw new ApiError(400, "Provide a valid Google Pub/Sub notification envelope.");
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(envelope.data.message.data, "base64url").toString("utf8"));
    } catch {
      throw new ApiError(400, "The Google notification payload is not valid JSON.");
    }
    const notification = googleSubscriptionNotificationSchema.safeParse(decoded);
    if (!notification.success || !notification.data.subscriptionNotification) return reply.code(202).send({ received: true, matched: false });
    const event = notification.data.subscriptionNotification;
    let verified;
    try {
      verified = await deps.billing.verifyPurchase({
        provider: "google",
        productId: event.subscriptionId,
        transactionId: event.purchaseToken,
        purchaseToken: event.purchaseToken,
      });
    } catch {
      throw new ApiError(503, "The Google verification service is temporarily unavailable.");
    }
    if (!verified || verified.productId !== event.subscriptionId) return reply.code(202).send({ received: true, matched: false });
    const existing = await deps.store.entitlementByPurchaseToken("google", event.purchaseToken);
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    const providerEventDate = new Date(Number(notification.data.eventTimeMillis));
    if (!Number.isFinite(providerEventDate.getTime())) throw new ApiError(400, "The Google notification timestamp is invalid.");
    if (existing.providerEventDate && providerEventDate <= existing.providerEventDate) {
      return reply.send({ received: true, matched: true, idempotent: true });
    }
    const timestamp = deps.now();
    const entitlement: Entitlement = {
      ...existing,
      productId: verified.productId,
      status: verified.status,
      environment: verified.environment,
      expiresAt: verified.expiresAt,
      providerEventDate,
      updatedAt: timestamp,
    };
    await deps.store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
}
