import Fastify, { type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { assessCommunicationEvidence, conversationCreateSchema, credentialsSchema, getEngagementLevel, getMasteryLevel, isPublishedScenario, masteryLevels, oauthSchema, profileSchema, recommendScenarios, modules, plansSchema, scenarioSchema, scenarios, userConversationTurnSchema, voiceTransportStatus } from "@coach/core";
import planData from "../config/plans.json";
import { ConflictError, type Entitlement, type OAuthIdentity, type PurchaseIntent, type Store, type VoiceSession } from "./store";
import { hashPassword, verifyPassword } from "./password";
import { ProviderUnavailableError, startLiveConversation } from "./conversation-service";
import { RealtimeVoiceProvider } from "./realtime-voice-provider";
import type { VerifiedAppleNotification, VerifiedStorePurchase } from "./store-verifier";

class ApiError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function dayKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function nextReset(date: Date, timezone: string) {
  const current = dayKey(date, timezone);
  for (let minute = 1; minute <= 36 * 60; minute++) {
    const candidate = new Date(date.getTime() + minute * 60_000);
    if (dayKey(candidate, timezone) !== current) return candidate.toISOString();
  }
  return new Date(date.getTime() + 24 * 60 * 60_000).toISOString();
}
function billingProductMap(value: string | undefined) {
  if (!value) return {} as Record<string, string>;
  try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {}; } catch { return {}; }
}
export async function buildApp(store: Store, options: { logger?: boolean; origins?: string[]; now?: () => Date; managerEmails?: string[]; billing?: { enabled?: boolean; webhookSecret?: string; googleNotificationSecret?: string; verifyGoogleNotificationRequest?: (authorization: string | undefined) => Promise<boolean>; productMap?: Record<string, string>; verifyPurchase?: (input: { provider: "apple" | "google"; productId: string; transactionId: string; purchaseToken: string }) => Promise<VerifiedStorePurchase | null>; verifyAppleNotification?: (signedPayload: string) => Promise<VerifiedAppleNotification | null> }; voice?: { enabled?: boolean; apiKey?: string; model?: string; voice?: string; fetchImpl?: typeof fetch }; oauth?: { googleClientIds?: string[]; fetchImpl?: typeof fetch } } = {}) {
  const now = options.now ?? (() => new Date());
  const app = Fastify({ logger: options.logger ? { redact: ["req.headers.authorization", "req.headers.cookie"], serializers: { req: request => ({ method: request.method, url: request.url }) } } : false, bodyLimit: 16384, trustProxy: false });
  await app.register(helmet);
  await app.register(cors, { origin: options.origins ?? ["http://localhost:3000", "http://localhost:8081"] });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  const plans = plansSchema.parse(planData);
  const standardDailyAllowanceSeconds = plans.find(plan => plan.id === "executive")?.dailySeconds ?? 20 * 60;
  const dummyHash = await hashPassword(randomBytes(32).toString("hex"));
  const availableScenarios = async () => [...scenarios, ...(await store.customScenarios())];
  const configuredManagerKey = process.env.MANAGER_SCENARIO_KEY ?? (process.env.NODE_ENV === "production" ? "" : "development-manager-key");
  const configuredManagerEmails = new Set((options.managerEmails ?? (process.env.MANAGER_EMAILS ?? "").split(",")).map(email => email.trim().toLowerCase()).filter(Boolean));
  const billingEnabled = options.billing?.enabled ?? process.env.BILLING_ENABLED === "true";
  const billingWebhookSecret = options.billing?.webhookSecret ?? process.env.BILLING_WEBHOOK_SECRET ?? "";
  const googleNotificationSecret = options.billing?.googleNotificationSecret ?? process.env.GOOGLE_PUBSUB_WEBHOOK_SECRET ?? billingWebhookSecret;
  const configuredBillingProductMap = options.billing?.productMap ?? billingProductMap(process.env.BILLING_PRODUCT_MAP);
  const realtimeEnabled = options.voice?.enabled ?? process.env.OPENAI_REALTIME_ENABLED === "true";
  const realtimeApiKey = options.voice?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const realtimeConfigured = realtimeEnabled && realtimeApiKey.length > 0;
  const realtimeProvider = realtimeConfigured ? new RealtimeVoiceProvider({ apiKey: realtimeApiKey, model: options.voice?.model ?? process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1", voice: options.voice?.voice ?? process.env.OPENAI_REALTIME_VOICE ?? "marin", fetchImpl: options.voice?.fetchImpl }) : null;
  async function reapVoiceSessions() {
    await store.expireVoiceSessions(now());
    if (!realtimeProvider) return;
    const pending = await store.pendingVoiceProviderCalls();
    await Promise.all(pending.map(async session => {
      if (!session.providerCallId) return;
      try { await realtimeProvider.terminate(session.providerCallId); await store.markVoiceProviderTerminated(session.id, now()); }
      catch { return; }
    }));
  }
  const expiryTimer = setInterval(() => { void reapVoiceSessions().catch(() => undefined); }, 30_000);
  expiryTimer.unref();
  app.addHook("onClose", async () => { clearInterval(expiryTimer); });
  function planForProduct(productId: string) {
    const configuredPlanId = configuredBillingProductMap[productId];
    const plan = plans.find(item => item.id === configuredPlanId);
    if (plan) return plan;
    if (process.env.NODE_ENV === "production") return undefined;
    return plans.find(item => productId.endsWith(`.${item.id}.monthly`) || productId.endsWith(`.${item.id}`));
  }
  async function dailyAllowance(userId: string) {
    if (!billingEnabled) return standardDailyAllowanceSeconds;
    const entitlement = await store.entitlement(userId);
    if (!entitlement || entitlement.status !== "active" || (entitlement.expiresAt && entitlement.expiresAt <= now())) return 0;
    return planForProduct(entitlement.productId)?.dailySeconds ?? 0;
  }
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
  const billingPurchaseSchema = z.object({ purchaseIntentId: z.string().uuid(), provider: z.enum(["apple", "google"]), productId: z.string().min(1).max(200), transactionId: z.string().min(1).max(300), purchaseToken: z.string().min(1).max(50000) }).strict();
  const appleNotificationSchema = z.object({ signedPayload: z.string().min(1).max(100000) }).strict();
  const googlePubSubSchema = z.object({ message: z.object({ data: z.string().min(1).max(100000), messageId: z.string().min(1).max(200).optional() }).strict(), subscription: z.string().min(1).max(500).optional() }).strict();
  const googleSubscriptionNotificationSchema = z.object({ packageName: z.string().min(1).max(300), eventTimeMillis: z.string().regex(/^\d+$/), subscriptionNotification: z.object({ purchaseToken: z.string().min(1).max(50000), subscriptionId: z.string().min(1).max(200), notificationType: z.number().int().min(1).max(20) }).strict().optional() }).strict();
  const purchaseIntentSchema = z.object({ provider: z.enum(["apple", "google"]), productId: z.string().min(1).max(200) }).strict();
  const voiceSessionSchema = z.object({ conversationId: z.string().uuid(), scenarioId: z.string().min(1).max(100) }).strict();
  const voiceStopSchema = z.object({ consumedSeconds: z.number().int().min(0).max(1200).default(0) }).strict().default({});
  const voiceProviderCallSchema = z.object({ providerCallId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/) }).strict();
  const voiceTranscriptSchema = z.object({ role: z.enum(["user", "assistant"]), phase: z.enum(["primary", "independent_retry"]).default("primary"), text: z.string().trim().min(1).max(10000) }).strict();
  const reviewScenarioSchema = z.object({ status: z.enum(["draft", "published", "deprecated"]) }).strict();
  const rollbackScenarioSchema = z.object({ revisionId: z.string().uuid() }).strict();
  async function requireManager(request: FastifyRequest) {
    if (process.env.NODE_ENV !== "production" && configuredManagerKey && request.headers["x-manager-key"] === configuredManagerKey) return { userId: null as string | null };
    const { user } = await authenticate(request);
    if (user.role !== "manager" && !configuredManagerEmails.has(user.email)) throw new ApiError(403, "Manager access is required.");
    return { userId: user.id };
  }
  const completedStates = new Set(["COMPLETED", "ASSESSING", "FEEDBACK_READY"]);
  async function learnerScenarioProgress(userId: string, profile: Awaited<ReturnType<Store["profile"]>>) {
    if (!profile) return { mastery: getMasteryLevel({ practiceDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 }), completedScenarioIds: [] as string[] };
    const conversations = await store.conversations(userId);
    const completed = conversations.filter(conversation => completedStates.has(conversation.state));
    const evidenceRows = await Promise.all(completed.map(async conversation => {
      const turns = await store.conversationTurns(userId, conversation.id);
      const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
      const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
      return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    }));
    const assessments = evidenceRows.filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null);
    const practiceDays = new Set(completed.map(conversation => dayKey(conversation.createdAt, profile.timezone))).size;
    const completedScenarioIds = [...new Set(completed.map(conversation => conversation.scenarioId))];
    return { mastery: getMasteryLevel({ practiceDays, completedScenarios: completedScenarioIds.length, successfulRetries: assessments.filter(assessment => assessment.passed).length, evidenceAssessments: assessments.length }), completedScenarioIds };
  }

  async function authenticate(request: FastifyRequest) {
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new ApiError(401, "Sign in to continue.");
    const tokenHash = digest(token);
    const session = await store.sessionByHash(tokenHash);
    if (!session || session.expiresAt <= now()) throw new ApiError(401, "Your session has expired. Please sign in.");
    const user = await store.accountById(session.userId);
    if (!user) throw new ApiError(401, "Sign in to continue.");
    return { user, tokenHash };
  }
  async function issueSession(user: { id: string; email: string }) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now().getTime() + 7 * 86400000);
    await store.createSession({ tokenHash: digest(token), userId: user.id, expiresAt });
    return { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email } };
  }
  async function verifiedOAuthIdentity(provider: "google" | "microsoft", accessToken: string) {
    type ProviderIdentityResponse = { email?: string; mail?: string; userPrincipalName?: string; sub?: string; id?: string; aud?: string | string[]; email_verified?: boolean | string };
    const response = provider === "google"
      ? await (options.oauth?.fetchImpl ?? fetch)(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
      : await (options.oauth?.fetchImpl ?? fetch)("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new ApiError(401, "The provider sign-in token is invalid or expired.");
    const data = await response.json() as ProviderIdentityResponse;
    const email = (data.email ?? data.mail ?? data.userPrincipalName ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new ApiError(401, "The provider did not return an email address.");
    const subject = (provider === "google" ? data.sub : data.id)?.trim() ?? "";
    if (!subject) throw new ApiError(401, "The provider did not return a stable account identifier.");
    if (provider === "google" && data.email_verified !== true && data.email_verified !== "true") throw new ApiError(401, "The Google email is not verified.");
    if (provider === "google") {
      const allowedClientIds = options.oauth?.googleClientIds ?? [];
      const audiences = data.aud ? (Array.isArray(data.aud) ? data.aud : [data.aud]) : [];
      if (allowedClientIds.length > 0 && !audiences.some(audience => allowedClientIds.includes(audience))) throw new ApiError(401, "The Google sign-in token was issued for an unrecognized application.");
    }
    return { email, subject };
  }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ConflictError) return reply.code(409).send({ error: error.message || "Unable to create account. Try signing in." });
    const failure = error instanceof Error ? error as Error & { statusCode?: number } : new Error("Unknown error");
    const status = "statusCode" in failure && typeof failure.statusCode === "number" && failure.statusCode >= 400 && failure.statusCode < 500 ? failure.statusCode : 500;
    if (status === 500) request.log.error({ errorType: failure.name }, "Request failed");
    return reply.code(status).send({ error: status === 500 ? "Service unavailable. Please try again." : failure.message });
  });
  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
  app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));
  app.get("/ready", async (_request, reply) => {
    try { await store.ready(); return { status: "ready" }; }
    catch { return reply.code(503).send({ status: "database_unavailable" }); }
  });
  app.get("/v1/catalog", async () => ({ modules, plans, priceNotice: "Proposed monthly INR prices. Store pricing and purchases are not configured.", liveVoiceAvailable: false }));
  app.get("/v1/me/entitlement", async request => {
    const { user } = await authenticate(request);
    return { entitlement: await store.entitlement(user.id) };
  });
  app.post("/v1/billing/intents", async (request, reply) => {
    const { user } = await authenticate(request);
    if (!billingEnabled || !billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const parsed = purchaseIntentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid Apple or Google product.");
    const timestamp = now();
    const intent: PurchaseIntent = { id: randomUUID(), userId: user.id, provider: parsed.data.provider, productId: parsed.data.productId, nonce: randomBytes(24).toString("base64url"), status: "pending", createdAt: timestamp, expiresAt: new Date(timestamp.getTime() + 15 * 60_000) };
    await store.createPurchaseIntent(intent);
    return reply.code(201).send({ intent: { id: intent.id, provider: intent.provider, productId: intent.productId, nonce: intent.nonce, status: intent.status, expiresAt: intent.expiresAt.toISOString() }, message: "Purchase intent created. Include the nonce in the store purchase and send only verified store events to the webhook." });
  });
  app.post("/v1/billing/webhooks/:provider", async (request, reply) => {
    if (!billingEnabled || !billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const provider = (request.params as { provider?: string }).provider;
    if (provider !== "apple" && provider !== "google") throw new ApiError(400, "Choose Apple or Google as the billing provider.");
    if (request.headers["x-billing-webhook-secret"] !== billingWebhookSecret) throw new ApiError(401, "Billing webhook authentication failed.");
    const parsed = billingWebhookSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid entitlement event.");
    const intent = await store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.status === "cancelled" || (intent.status === "pending" && intent.expiresAt <= now())) throw new ApiError(409, "The purchase intent is missing or expired.");
    if (intent.provider !== provider || intent.productId !== parsed.data.productId) throw new ApiError(409, "The store event does not match the purchase intent.");
    const user = await store.accountById(intent.userId);
    if (!user) throw new ApiError(404, "The entitlement account was not found.");
    const existing = await store.entitlementByTransactionId(parsed.data.transactionId);
    if (existing && (existing.userId !== intent.userId || existing.provider !== provider || existing.productId !== parsed.data.productId)) throw new ApiError(409, "The transaction is already linked to another entitlement.");
    const timestamp = now();
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
    await store.saveEntitlement(entitlement);
    await store.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, received: true, idempotent });
  });
  app.post("/v1/billing/purchases/verify", async (request, reply) => {
    const { user } = await authenticate(request);
    if (!billingEnabled || !billingWebhookSecret || !options.billing?.verifyPurchase) throw new ApiError(503, "Store purchase verification is not configured.");
    const parsed = billingPurchaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the store purchase details for verification.");
    const intent = await store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.userId !== user.id || intent.status === "cancelled" || (intent.status === "pending" && intent.expiresAt <= now())) throw new ApiError(409, "The purchase intent is missing or expired.");
    if (intent.provider !== parsed.data.provider || intent.productId !== parsed.data.productId) throw new ApiError(409, "The purchase does not match the selected package.");
    let verified: VerifiedStorePurchase | null;
    try { verified = await options.billing.verifyPurchase({ provider: parsed.data.provider, productId: parsed.data.productId, transactionId: parsed.data.transactionId, purchaseToken: parsed.data.purchaseToken }); }
    catch { throw new ApiError(503, "The store verification service is temporarily unavailable."); }
    if (!verified || verified.productId !== intent.productId || verified.transactionId !== parsed.data.transactionId) throw new ApiError(402, "The store purchase could not be verified.");
    const existing = await store.entitlementByTransactionId(verified.transactionId);
    if (existing && existing.userId !== user.id) throw new ApiError(409, "The transaction is already linked to another account.");
    const timestamp = now();
    const entitlement: Entitlement = { id: existing?.id ?? randomUUID(), userId: user.id, provider: parsed.data.provider, productId: verified.productId, transactionId: verified.transactionId, originalTransactionId: verified.originalTransactionId, purchaseToken: verified.purchaseToken, status: verified.status, environment: verified.environment, expiresAt: verified.expiresAt, providerEventDate: verified.providerEventDate, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
    await store.saveEntitlement(entitlement);
    await store.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, verified: true });
  });
  app.post("/v1/billing/notifications/apple", async (request, reply) => {
    if (!billingEnabled || !options.billing?.verifyAppleNotification) throw new ApiError(503, "Apple notification verification is not configured.");
    const parsed = appleNotificationSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the signed Apple notification payload.");
    let notification: VerifiedAppleNotification | null;
    try { notification = await options.billing.verifyAppleNotification(parsed.data.signedPayload); }
    catch { throw new ApiError(400, "The Apple notification signature could not be verified."); }
    if (!notification || !planForProduct(notification.productId)) throw new ApiError(400, "The Apple notification is invalid or references an unknown product.");
    const byOriginal = await store.entitlementByOriginalTransactionId("apple", notification.originalTransactionId);
    const byTransaction = await store.entitlementByTransactionId(notification.transactionId);
    if (byTransaction && byTransaction.userId !== byOriginal?.userId) throw new ApiError(409, "The Apple transaction is linked to another account.");
    const existing = byOriginal ?? byTransaction;
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    if (existing.providerEventDate && notification.providerEventDate && notification.providerEventDate <= existing.providerEventDate) return reply.send({ received: true, matched: true, idempotent: true });
    const timestamp = now();
    const entitlement: Entitlement = { id: existing.transactionId === notification.transactionId ? existing.id : randomUUID(), userId: existing.userId, provider: "apple", productId: notification.productId, transactionId: notification.transactionId, originalTransactionId: notification.originalTransactionId, purchaseToken: existing.purchaseToken, status: notification.status, environment: notification.environment, expiresAt: notification.expiresAt, providerEventDate: notification.providerEventDate, createdAt: existing.createdAt, updatedAt: timestamp };
    await store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app.post("/v1/billing/notifications/google", async (request, reply) => {
    if (!billingEnabled || !options.billing?.verifyPurchase) throw new ApiError(503, "Google notification verification is not configured.");
    const oidcAuthenticated = options.billing.verifyGoogleNotificationRequest ? await options.billing.verifyGoogleNotificationRequest(request.headers.authorization) : false;
    const sharedSecretAuthenticated = Boolean(googleNotificationSecret && request.headers["x-google-pubsub-secret"] === googleNotificationSecret);
    if (!oidcAuthenticated && !sharedSecretAuthenticated) throw new ApiError(401, "Google notification authentication failed.");
    const envelope = googlePubSubSchema.safeParse(request.body);
    if (!envelope.success) throw new ApiError(400, "Provide a valid Google Pub/Sub notification envelope.");
    let decoded: unknown;
    try { decoded = JSON.parse(Buffer.from(envelope.data.message.data, "base64url").toString("utf8")); }
    catch { throw new ApiError(400, "The Google notification payload is not valid JSON."); }
    const notification = googleSubscriptionNotificationSchema.safeParse(decoded);
    if (!notification.success || !notification.data.subscriptionNotification) return reply.code(202).send({ received: true, matched: false });
    const event = notification.data.subscriptionNotification;
    let verified: VerifiedStorePurchase | null;
    try { verified = await options.billing.verifyPurchase({ provider: "google", productId: event.subscriptionId, transactionId: event.purchaseToken, purchaseToken: event.purchaseToken }); }
    catch { throw new ApiError(503, "The Google verification service is temporarily unavailable."); }
    if (!verified || verified.productId !== event.subscriptionId) return reply.code(202).send({ received: true, matched: false });
    const existing = await store.entitlementByPurchaseToken("google", event.purchaseToken);
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    const providerEventDate = new Date(Number(notification.data.eventTimeMillis));
    if (!Number.isFinite(providerEventDate.getTime())) throw new ApiError(400, "The Google notification timestamp is invalid.");
    if (existing.providerEventDate && providerEventDate <= existing.providerEventDate) return reply.send({ received: true, matched: true, idempotent: true });
    const timestamp = now();
    const entitlement: Entitlement = { ...existing, productId: verified.productId, status: verified.status, environment: verified.environment, expiresAt: verified.expiresAt, providerEventDate, updatedAt: timestamp };
    await store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app.get("/v1/scenarios/library", async () => { const catalog = await availableScenarios(); return { scenarios: catalog, count: catalog.length }; });
  app.post("/v1/manager/scenarios", async (request, reply) => {
    const manager = await requireManager(request);
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a complete scenario with a valid module, goal, level and prompts.");
    const catalog = await availableScenarios();
    if (catalog.some(scenario => scenario.id === parsed.data.id)) throw new ApiError(409, "A scenario with this id already exists.");
    const scenario = { ...parsed.data, reviewStatus: "draft" as const, ownerId: manager.userId, reviewedBy: null, reviewedAt: null };
    await store.createCustomScenario(scenario);
    return reply.code(201).send({ scenario, message: "Scenario added to the library as a draft for review." });
  });
  app.post("/v1/manager/scenarios/:id/review", async (request, reply) => {
    const manager = await requireManager(request);
    const id = (request.params as { id?: string }).id;
    const parsed = reviewScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a scenario and a valid review status.");
    const scenario = await store.reviewCustomScenario(id, parsed.data.status, manager.userId, now());
    if (!scenario) throw new ApiError(404, "Scenario not found.");
    return reply.send({ scenario, message: parsed.data.status === "published" ? "Scenario published for learner practice." : `Scenario marked ${parsed.data.status}.` });
  });
  app.get("/v1/manager/scenarios/:id/revisions", async (request, reply) => {
    await requireManager(request);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "Choose a scenario.");
    const revisions = await store.scenarioRevisions(id);
    if (revisions.length === 0) throw new ApiError(404, "Scenario not found.");
    return reply.send({ revisions });
  });
  app.post("/v1/manager/scenarios/:id/rollback", async (request, reply) => {
    const manager = await requireManager(request);
    const id = (request.params as { id?: string }).id;
    const parsed = rollbackScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a valid scenario revision.");
    const scenario = await store.rollbackCustomScenario(id, parsed.data.revisionId, manager.userId, now());
    if (!scenario) throw new ApiError(404, "Scenario or revision not found.");
    return reply.send({ scenario, message: "Scenario rolled back as a draft. Review and publish it before learner practice." });
  });
  app.post("/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and a password of 12–128 characters.");
    const user = await store.createAccount(parsed.data.email, await hashPassword(parsed.data.password));
    return reply.code(201).send(await issueSession(user));
  });
  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.");
    const user = await store.accountByEmail(parsed.data.email);
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new ApiError(401, "Email or password is incorrect.");
    return issueSession(user);
  });
  app.post("/v1/auth/oauth", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const parsed = oauthSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose Google or Microsoft and try again.");
    const identity = await verifiedOAuthIdentity(parsed.data.provider, parsed.data.accessToken);
    const linked = await store.oauthIdentity(parsed.data.provider, identity.subject);
    const linkedUser = linked ? await store.accountById(linked.userId) : null;
    if (linked && !linkedUser) throw new ApiError(401, "The provider identity is no longer linked to an account.");
    const existing = linkedUser ?? await store.accountByEmail(identity.email);
    const user = existing ?? await store.createAccount(identity.email, await hashPassword(randomBytes(32).toString("hex")));
    if (!linked) {
      const timestamp = now();
      const oauthIdentity: OAuthIdentity = { id: randomUUID(), provider: parsed.data.provider, subject: identity.subject, userId: user.id, createdAt: timestamp, updatedAt: timestamp };
      await store.saveOAuthIdentity(oauthIdentity);
    }
    return issueSession(user);
  });
  app.post("/v1/auth/logout", async (request, reply) => {
    const { tokenHash } = await authenticate(request);
    await store.deleteSession(tokenHash);
    return reply.code(204).send();
  });
  app.post("/v1/auth/logout-all", async (request, reply) => {
    const { user } = await authenticate(request);
    await store.deleteSessions(user.id);
    return reply.code(204).send();
  });
  app.delete("/v1/me", async (request, reply) => {
    const { user } = await authenticate(request);
    await store.deleteAccount(user.id);
    return reply.code(204).send();
  });
  app.get("/v1/me", async request => {
    const { user } = await authenticate(request);
    return { user: { id: user.id, email: user.email }, profile: await store.profile(user.id) };
  });
  app.put("/v1/me/profile", async request => {
    const { user } = await authenticate(request);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues.map(issue => issue.path.join(".") + ": " + issue.message).join("; "));
    await store.saveProfile(user.id, parsed.data);
    return { profile: parsed.data };
  });
  app.get("/v1/me/scenarios", async request => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const progress = await learnerScenarioProgress(user.id, profile);
    return { scenarios: recommendScenarios(profile, (await availableScenarios()).filter(isPublishedScenario), progress.mastery.level, progress.completedScenarioIds), mastery: progress.mastery, previewOnly: true };
  });
  app.get("/v1/me/conversations", async request => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const catalog = await availableScenarios();
    const items = (await store.conversations(user.id, 10)).map(conversation => ({ conversation: { id: conversation.id, scenarioId: conversation.scenarioId, state: conversation.state, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, scenario: conversation.scenarioSnapshot ?? catalog.find(item => item.id === conversation.scenarioId) })).filter(item => item.scenario);
    return { conversations: items };
  });
  app.get("/v1/me/progress", async request => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await store.conversations(user.id);
    const completed = conversations.filter(conversation => completedStates.has(conversation.state));
    const evidenceRows = await Promise.all(completed.map(async conversation => {
      const turns = await store.conversationTurns(user.id, conversation.id);
      const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
      const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
      return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    }));
    const assessments = evidenceRows.filter((assessment): assessment is NonNullable<typeof assessment> => assessment !== null);
    const weekStart = now().getTime() - 7 * 86400000;
    const weekly = conversations.filter(conversation => conversation.createdAt.getTime() >= weekStart);
    const activeDays = new Set(conversations.map(conversation => dayKey(conversation.createdAt, profile.timezone)));
    let currentStreakDays = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const day = new Date(now().getTime() - offset * 86400000);
      if (!activeDays.has(dayKey(day, profile.timezone))) break;
      currentStreakDays += 1;
    }
    const practiceMinutes = completed.length * profile.practiceMinutes;
    const engagement = getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays });
    const practiceDays = new Set(completed.map(conversation => dayKey(conversation.createdAt, profile.timezone))).size;
    const completedScenarios = new Set(completed.map(conversation => conversation.scenarioId)).size;
    const successfulRetries = assessments.filter(assessment => assessment.passed).length;
    const mastery = getMasteryLevel({ practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length });
    const dailyPractice = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now().getTime() - (6 - index) * 86400000);
      const key = dayKey(date, profile.timezone);
      const daySessions = conversations.filter(conversation => dayKey(conversation.createdAt, profile.timezone) === key);
      const dayCompleted = daySessions.filter(conversation => completedStates.has(conversation.state));
      return { day: key.slice(5), minutes: dayCompleted.length * profile.practiceMinutes, sessions: daySessions.length };
    });
    const levelTrack = masteryLevels.map(item => ({ level: item.level, title: item.title, reached: mastery.level >= item.level }));
    const skillSignal = assessments.length ? Math.round(assessments.reduce((total, assessment) => total + assessment.score, 0) / assessments.length) : null;
    return { totalSessions: conversations.length, completedSessions: completed.length, weeklySessions: weekly.length, practiceMinutes, weeklyPracticeMinutes: weekly.length * profile.practiceMinutes, currentStreakDays, engagement, mastery, practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length, dailyPractice, levelTrack, skillSignal, skillSignalStatus: skillSignal === null ? "awaiting_assessment" as const : "available" as const };
  });
  app.get("/v1/me/export", async request => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await store.conversations(user.id);
    const records = await Promise.all(conversations.map(async conversation => ({ conversation: { id: conversation.id, scenarioId: conversation.scenarioId, scenarioSnapshot: conversation.scenarioSnapshot, state: conversation.state, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, turns: await store.conversationTurns(user.id, conversation.id) })));
    return { exportedAt: now().toISOString(), user: { id: user.id, email: user.email }, profile, conversations: records };
  });
  app.get("/v1/me/voice-usage", async request => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    const timezone = profile?.timezone ?? "Asia/Kolkata";
    const today = dayKey(now(), timezone);
    const usage = await store.usage(user.id, today);
    const allowanceSeconds = await dailyAllowance(user.id);
    return { timezone, dayKey: today, allowanceSeconds, reservedSeconds: usage.reservedSeconds, consumedSeconds: usage.consumedSeconds, remainingSeconds: Math.max(0, allowanceSeconds - usage.reservedSeconds), resetsAt: nextReset(now(), timezone), enforcement: "server_reservations" as const, liveVoiceAvailable: false };
  });
  app.post("/v1/me/conversations", async (request, reply) => {
    const { user } = await authenticate(request);
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const parsed = conversationCreateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid practice scenario.");
    const progress = await learnerScenarioProgress(user.id, profile);
    const scenario = recommendScenarios(profile, (await availableScenarios()).filter(isPublishedScenario), progress.mastery.level, progress.completedScenarioIds).find(item => item.id === parsed.data.scenarioId);
    if (!scenario) throw new ApiError(403, "That scenario is not available for this profile.");
    const timestamp = now();
    const conversation = { id: randomUUID(), userId: user.id, scenarioId: scenario.id, scenarioSnapshot: scenario, state: "CREATED" as const, createdAt: timestamp, updatedAt: timestamp };
    await store.createConversation(conversation);
    return reply.code(201).send({ conversation: { id: conversation.id, scenarioId: scenario.id, state: conversation.state, createdAt: timestamp.toISOString() }, scenario, liveVoiceAvailable: false, message: "Practice session created. Live AI voice is not connected yet." });
  });
  app.get("/v1/me/conversations/:id", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    const profile = await store.profile(user.id);
    const scenario = conversation.scenarioSnapshot ?? (profile ? (await availableScenarios()).find(item => item.id === conversation.scenarioId) : undefined);
    if (!scenario) return reply.code(404).send({ error: "Conversation scenario is no longer available." });
    return { conversation: { ...conversation, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, scenario, turns: await store.conversationTurns(user.id, id), liveVoiceAvailable: false };
  });
  app.post("/v1/me/conversations/:id/turns", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session cannot accept another response.");
    const parsed = userConversationTurnSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a response between 1 and 10,000 characters.");
    const turn = { id: randomUUID(), sessionId: id, role: "user" as const, phase: parsed.data.phase, text: parsed.data.text, createdAt: now() };
    await store.addConversationTurn(turn);
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: parsed.data.phase === "independent_retry" ? "Independent retry saved. Complete the practice to record your evidence." : "Primary response saved. Now try the independent retry." });
  });
  app.post("/v1/me/conversations/:id/complete", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session is already closed.");
    const turns = await store.conversationTurns(user.id, id);
    if (!turns.some(turn => turn.role === "user" && turn.phase === "primary")) throw new ApiError(409, "Save your primary response before finishing practice.");
    if (!turns.some(turn => turn.role === "user" && turn.phase === "independent_retry")) throw new ApiError(409, "Complete the independent retry before finishing practice.");
    const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
    const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
    const evidence = primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    const completed = await store.updateConversationState(user.id, id, "COMPLETED");
    return { conversation: { id: completed.id, state: completed.state, completedAt: completed.updatedAt.toISOString() }, evidence: evidence ? { score: evidence.score, passed: evidence.passed } : null, message: evidence?.passed ? "Practice completed. Your independent retry met the local evidence checks." : "Practice completed. More evidence is needed before this retry counts as successful." };
  });
  app.get("/v1/voice/readiness", async request => {
    await authenticate(request);
    return realtimeConfigured
      ? { available: true, code: "SERVER_PROVIDER_READY", message: "The coach voice provider is configured. Use an Android or iOS development build for the live conversation." }
      : { available: false, code: "PROVIDER_NOT_CONFIGURED", message: "Live AI voice is not configured on the server. You can still test your microphone locally; no audio is sent to an AI provider." };
  });
  app.get("/v1/voice/capabilities", async request => {
    await authenticate(request);
    const requestedPlatform = request.query && typeof request.query === "object" ? (request.query as { platform?: string }).platform : undefined;
    const requestedCapabilities = request.query && typeof request.query === "object" ? request.query as { nativeModuleAvailable?: string; developmentBuild?: string } : {};
    const platform = requestedPlatform === "android" || requestedPlatform === "ios" ? requestedPlatform : "web";
    return voiceTransportStatus({ platform, nativeModuleAvailable: requestedCapabilities.nativeModuleAvailable === "true", developmentBuild: requestedCapabilities.developmentBuild === "true", providerConfigured: realtimeConfigured });
  });
  app.post("/v1/voice/sessions", async (request, reply) => {
    const { user } = await authenticate(request);
    if (request.headers.origin) throw new ApiError(403, "Live voice requires an Android or iOS development build.");
    if (!realtimeProvider) return reply.code(503).send({ error: "Live voice is disabled pending provider configuration and native transport verification." });
    const parsed = voiceSessionSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid conversation and scenario.");
    const profile = await store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversation = await store.conversation(user.id, parsed.data.conversationId);
    const scenario = (await availableScenarios()).filter(isPublishedScenario).find(item => item.id === parsed.data.scenarioId);
    if (!conversation || conversation.scenarioId !== parsed.data.scenarioId || !scenario) throw new ApiError(404, "Practice conversation not found.");
    const allowanceSeconds = await dailyAllowance(user.id);
    if (allowanceSeconds <= 0) throw new ApiError(402, billingEnabled ? "An active practice plan is required before starting live voice." : "Live voice allowance is not configured.");
    const usage = await store.usage(user.id, dayKey(now(), profile.timezone));
    const remainingSeconds = allowanceSeconds - usage.reservedSeconds;
    const maximumSeconds = Math.min(profile.practiceMinutes * 60, remainingSeconds);
    if (maximumSeconds <= 0) throw new ApiError(409, "Your daily voice allowance is exhausted. Try again after the allowance resets.");
    try {
      const result = await startLiveConversation({ store, provider: realtimeProvider, userId: user.id, conversationId: conversation.id, scenarioId: scenario.id, instructions: `You are a communication coach. Guide the learner through this practice scenario: ${scenario.question} Then ask the learner to try independently: ${scenario.independentQuestion}. Do not score or diagnose the learner during the live exchange.`, dayKey: dayKey(now(), profile.timezone), allowanceSeconds, maximumSeconds, now: () => now() });
      const timestamp = now();
      const session: VoiceSession = { id: randomUUID(), userId: user.id, conversationId: conversation.id, reservationId: result.reservationId, providerSessionId: result.connection.providerSessionId, providerCallId: null, providerTerminatedAt: null, status: "active", startedAt: timestamp, expiresAt: result.connection.expiresAt, endedAt: null };
      await store.createVoiceSession(session);
      return reply.code(201).send({ sessionId: session.id, conversation: { id: conversation.id, state: result.state }, reservationId: result.reservationId, clientSecret: result.connection.clientSecret, expiresAt: result.connection.expiresAt.toISOString(), providerSessionCreated: true, liveVoiceAvailable: false, message: "Provider session created. Native WebRTC transport remains gated until device verification." });
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw new ApiError(503, "The live voice provider is temporarily unavailable.");
      throw error;
    }
  });
  app.post("/v1/voice/sessions/:id/bind", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    const parsed = voiceProviderCallSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid provider call identifier.");
    const session = await store.bindVoiceProviderCall(user.id, id, parsed.data.providerCallId);
    return reply.send({ sessionId: session.id, providerCallId: session.providerCallId, message: "Provider call bound for server-side termination." });
  });
  app.post("/v1/voice/sessions/:id/transcript", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    const parsed = voiceTranscriptSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid voice transcript.");
    const session = await store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "The voice session is already closed.");
    const turn = { id: randomUUID(), sessionId: session.conversationId, role: parsed.data.role, phase: parsed.data.phase, text: parsed.data.text, createdAt: now() };
    await store.addConversationTurn(turn);
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: "Voice transcript saved." });
  });
  app.post("/v1/voice/sessions/:id/stop", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A voice session id is required.");
    const parsed = voiceStopSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid consumed duration.");
    const session = await store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "Voice session is already closed.");
    let providerTermination: "completed" | "not_bound" | "failed" = "not_bound";
    if (realtimeProvider && session.providerCallId) {
      try { await realtimeProvider.terminate(session.providerCallId); await store.markVoiceProviderTerminated(session.id, now()); providerTermination = "completed"; }
      catch { providerTermination = "failed"; }
    }
    await store.endVoiceSession(user.id, id, now(), "ended");
    await store.settleUsage(session.reservationId, parsed.data.consumedSeconds);
    const conversation = await store.conversation(user.id, session.conversationId);
    if (conversation?.state === "ACTIVE") await store.updateConversationState(user.id, session.conversationId, "INTERRUPTED");
    return { sessionId: id, status: "ended", consumedSeconds: parsed.data.consumedSeconds, conversationState: "INTERRUPTED", providerTermination };
  });
  return app;
}
