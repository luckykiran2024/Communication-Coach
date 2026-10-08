// src/runtime.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";
import { z as z2 } from "zod";

// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createHash, randomBytes as randomBytes2, randomUUID as randomUUID2 } from "node:crypto";
import { z } from "zod";
import { assessCommunicationEvidence, conversationCreateSchema, credentialsSchema, getEngagementLevel, getMasteryLevel, isPublishedScenario, masteryLevels, oauthSchema, profileSchema, recommendScenarios, modules, plansSchema, scenarioSchema, scenarios, userConversationTurnSchema, voiceTransportStatus } from "@coach/core";

// config/plans.json
var plans_default = [
  {
    id: "essential",
    title: "Essential",
    targetPriceInr: 199,
    dailySeconds: 1200,
    modules: [
      "daily"
    ]
  },
  {
    id: "professional",
    title: "Professional",
    targetPriceInr: 299,
    dailySeconds: 1200,
    modules: [
      "daily",
      "management"
    ]
  },
  {
    id: "executive",
    title: "Executive",
    targetPriceInr: 699,
    dailySeconds: 1200,
    modules: [
      "daily",
      "management",
      "leadership"
    ]
  },
  {
    id: "extended",
    title: "Extended Practice",
    targetPriceInr: 799,
    dailySeconds: 2400,
    modules: [
      "daily",
      "management",
      "leadership"
    ]
  }
];

// src/store.ts
var ConflictError = class extends Error {
};

// src/password.ts
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
var derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64);
  return salt + ":" + hash.toString("hex");
}
async function verifyPassword(password, encoded) {
  const [salt, expected] = encoded.split(":");
  const actual = await derive(password, salt, 64);
  const stored = Buffer.from(expected, "hex");
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}

// src/conversation-service.ts
import { randomUUID } from "node:crypto";
import { transition } from "@coach/core";
var ProviderUnavailableError = class extends Error {
};
async function startLiveConversation(input) {
  const now = input.now ?? (() => /* @__PURE__ */ new Date());
  const conversation = await input.store.conversation(input.userId, input.conversationId);
  if (!conversation || conversation.scenarioId !== input.scenarioId) throw new Error("Conversation not found");
  if (conversation.state !== "CREATED") throw new Error("Conversation is not ready to start");
  const reservationId = randomUUID();
  await input.store.reserveUsage({ id: reservationId, userId: input.userId, dayKey: input.dayKey, seconds: input.maximumSeconds, expiresAt: new Date(now().getTime() + input.maximumSeconds * 1e3) }, input.allowanceSeconds);
  let state = transition(conversation.state, "AUTHORIZED");
  await input.store.updateConversationState(input.userId, input.conversationId, state);
  try {
    state = transition(state, "CONNECTING");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    const connection = await input.provider.connect({ userId: input.userId, scenarioId: input.scenarioId, maximumSeconds: input.maximumSeconds, instructions: input.instructions, signal: AbortSignal.timeout(input.maximumSeconds * 1e3) });
    state = transition(state, "ACTIVE");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    return { reservationId, state, connection };
  } catch (error) {
    await input.store.settleUsage(reservationId, 0);
    await input.store.updateConversationState(input.userId, input.conversationId, "FAILED");
    throw new ProviderUnavailableError(error instanceof Error ? error.message : "Voice provider unavailable");
  }
}

// src/realtime-provider.ts
var RealtimeProviderError = class extends Error {
};
async function createRealtimeClientSecret(input) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": input.safetyIdentifier
    },
    signal: input.signal,
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: Math.max(10, Math.min(7200, Math.round(input.expiresAfterSeconds))) },
      session: { type: "realtime", model: input.model, instructions: input.instructions, audio: { input: { transcription: { model: "gpt-4o-mini-transcribe", language: "en" } }, output: { voice: input.voice } } }
    })
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.value !== "string" || typeof data.expires_at !== "number" || typeof data.session?.id !== "string") {
    throw new RealtimeProviderError("Realtime provider did not create a valid client secret.");
  }
  return { value: data.value, expiresAt: new Date(data.expires_at * 1e3).toISOString(), sessionId: data.session.id };
}

// src/realtime-voice-provider.ts
var RealtimeVoiceProvider = class {
  constructor(input) {
    this.input = input;
  }
  input;
  name = "openai-realtime";
  async connect(connection) {
    if (connection.signal.aborted) throw new Error("Voice connection was cancelled.");
    const secret = await createRealtimeClientSecret({
      apiKey: this.input.apiKey,
      safetyIdentifier: connection.userId,
      model: this.input.model,
      voice: this.input.voice,
      instructions: connection.instructions ?? `Coach the learner through scenario ${connection.scenarioId}. Keep the conversation concise, supportive and focused on the practice prompt.`,
      expiresAfterSeconds: connection.maximumSeconds,
      signal: connection.signal,
      fetchImpl: this.input.fetchImpl
    });
    return { providerSessionId: secret.sessionId, expiresAt: new Date(secret.expiresAt), clientSecret: secret.value };
  }
  async terminate(providerCallId) {
    const response = await (this.input.fetchImpl ?? fetch)(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(providerCallId)}/hangup`, { method: "POST", headers: { Authorization: `Bearer ${this.input.apiKey}`, "OpenAI-Safety-Identifier": providerCallId } });
    if (!response.ok) throw new Error("Realtime provider did not terminate the call.");
  }
};

// src/app.ts
var ApiError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
  statusCode;
};
var digest = (value) => createHash("sha256").update(value).digest("hex");
function dayKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function nextReset(date, timezone) {
  const current = dayKey(date, timezone);
  for (let minute = 1; minute <= 36 * 60; minute++) {
    const candidate = new Date(date.getTime() + minute * 6e4);
    if (dayKey(candidate, timezone) !== current) return candidate.toISOString();
  }
  return new Date(date.getTime() + 24 * 60 * 6e4).toISOString();
}
function billingProductMap(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
async function buildApp(store2, options = {}) {
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const app2 = Fastify({ logger: options.logger ? { redact: ["req.headers.authorization", "req.headers.cookie"], serializers: { req: (request) => ({ method: request.method, url: request.url }) } } : false, bodyLimit: 16384, trustProxy: false });
  await app2.register(helmet);
  await app2.register(cors, { origin: options.origins ?? ["http://localhost:3000", "http://localhost:8081"] });
  await app2.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  const plans = plansSchema.parse(plans_default);
  const standardDailyAllowanceSeconds = plans.find((plan) => plan.id === "executive")?.dailySeconds ?? 20 * 60;
  const dummyHash = await hashPassword(randomBytes2(32).toString("hex"));
  const availableScenarios = async () => [...scenarios, ...await store2.customScenarios()];
  const configuredManagerKey = process.env.MANAGER_SCENARIO_KEY ?? (process.env.NODE_ENV === "production" ? "" : "development-manager-key");
  const configuredManagerEmails = new Set((options.managerEmails ?? (process.env.MANAGER_EMAILS ?? "").split(",")).map((email) => email.trim().toLowerCase()).filter(Boolean));
  const billingEnabled = options.billing?.enabled ?? process.env.BILLING_ENABLED === "true";
  const billingWebhookSecret = options.billing?.webhookSecret ?? process.env.BILLING_WEBHOOK_SECRET ?? "";
  const googleNotificationSecret = options.billing?.googleNotificationSecret ?? process.env.GOOGLE_PUBSUB_WEBHOOK_SECRET ?? billingWebhookSecret;
  const configuredBillingProductMap = options.billing?.productMap ?? billingProductMap(process.env.BILLING_PRODUCT_MAP);
  const realtimeEnabled = options.voice?.enabled ?? process.env.OPENAI_REALTIME_ENABLED === "true";
  const realtimeApiKey = options.voice?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const realtimeConfigured = realtimeEnabled && realtimeApiKey.length > 0;
  const realtimeProvider = realtimeConfigured ? new RealtimeVoiceProvider({ apiKey: realtimeApiKey, model: options.voice?.model ?? process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1", voice: options.voice?.voice ?? process.env.OPENAI_REALTIME_VOICE ?? "marin", fetchImpl: options.voice?.fetchImpl }) : null;
  async function reapVoiceSessions() {
    await store2.expireVoiceSessions(now());
    if (!realtimeProvider) return;
    const pending = await store2.pendingVoiceProviderCalls();
    await Promise.all(pending.map(async (session) => {
      if (!session.providerCallId) return;
      try {
        await realtimeProvider.terminate(session.providerCallId);
        await store2.markVoiceProviderTerminated(session.id, now());
      } catch {
        return;
      }
    }));
  }
  const expiryTimer = setInterval(() => {
    void reapVoiceSessions().catch(() => void 0);
  }, 3e4);
  expiryTimer.unref();
  app2.addHook("onClose", async () => {
    clearInterval(expiryTimer);
  });
  function planForProduct(productId) {
    const configuredPlanId = configuredBillingProductMap[productId];
    const plan = plans.find((item) => item.id === configuredPlanId);
    if (plan) return plan;
    if (process.env.NODE_ENV === "production") return void 0;
    return plans.find((item) => productId.endsWith(`.${item.id}.monthly`) || productId.endsWith(`.${item.id}`));
  }
  async function dailyAllowance(userId) {
    if (!billingEnabled) return standardDailyAllowanceSeconds;
    const entitlement = await store2.entitlement(userId);
    if (!entitlement || entitlement.status !== "active" || entitlement.expiresAt && entitlement.expiresAt <= now()) return 0;
    return planForProduct(entitlement.productId)?.dailySeconds ?? 0;
  }
  const billingWebhookSchema = z.object({
    purchaseIntentId: z.string().uuid(),
    productId: z.string().min(1).max(200),
    transactionId: z.string().min(1).max(300),
    originalTransactionId: z.string().min(1).max(300).optional(),
    purchaseToken: z.string().min(1).max(5e4).optional(),
    status: z.enum(["active", "expired", "revoked"]),
    environment: z.enum(["sandbox", "production"]),
    expiresAt: z.string().datetime().nullable().optional()
  }).strict();
  const billingPurchaseSchema = z.object({ purchaseIntentId: z.string().uuid(), provider: z.enum(["apple", "google"]), productId: z.string().min(1).max(200), transactionId: z.string().min(1).max(300), purchaseToken: z.string().min(1).max(5e4) }).strict();
  const appleNotificationSchema = z.object({ signedPayload: z.string().min(1).max(1e5) }).strict();
  const googlePubSubSchema = z.object({ message: z.object({ data: z.string().min(1).max(1e5), messageId: z.string().min(1).max(200).optional() }).strict(), subscription: z.string().min(1).max(500).optional() }).strict();
  const googleSubscriptionNotificationSchema = z.object({ packageName: z.string().min(1).max(300), eventTimeMillis: z.string().regex(/^\d+$/), subscriptionNotification: z.object({ purchaseToken: z.string().min(1).max(5e4), subscriptionId: z.string().min(1).max(200), notificationType: z.number().int().min(1).max(20) }).strict().optional() }).strict();
  const purchaseIntentSchema = z.object({ provider: z.enum(["apple", "google"]), productId: z.string().min(1).max(200) }).strict();
  const voiceSessionSchema = z.object({ conversationId: z.string().uuid(), scenarioId: z.string().min(1).max(100) }).strict();
  const voiceStopSchema = z.object({ consumedSeconds: z.number().int().min(0).max(1200).default(0) }).strict().default({});
  const voiceProviderCallSchema = z.object({ providerCallId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/) }).strict();
  const voiceTranscriptSchema = z.object({ role: z.enum(["user", "assistant"]), phase: z.enum(["primary", "independent_retry"]).default("primary"), text: z.string().trim().min(1).max(1e4) }).strict();
  const reviewScenarioSchema = z.object({ status: z.enum(["draft", "published", "deprecated"]) }).strict();
  const rollbackScenarioSchema = z.object({ revisionId: z.string().uuid() }).strict();
  async function requireManager(request) {
    if (process.env.NODE_ENV !== "production" && configuredManagerKey && request.headers["x-manager-key"] === configuredManagerKey) return { userId: null };
    const { user } = await authenticate(request);
    if (user.role !== "manager" && !configuredManagerEmails.has(user.email)) throw new ApiError(403, "Manager access is required.");
    return { userId: user.id };
  }
  const completedStates = /* @__PURE__ */ new Set(["COMPLETED", "ASSESSING", "FEEDBACK_READY"]);
  async function learnerScenarioProgress(userId, profile) {
    if (!profile) return { mastery: getMasteryLevel({ practiceDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 }), completedScenarioIds: [] };
    const conversations = await store2.conversations(userId);
    const completed = conversations.filter((conversation) => completedStates.has(conversation.state));
    const evidenceRows = await Promise.all(completed.map(async (conversation) => {
      const turns = await store2.conversationTurns(userId, conversation.id);
      const primary = turns.find((turn) => turn.role === "user" && turn.phase === "primary");
      const retry = [...turns].reverse().find((turn) => turn.role === "user" && turn.phase === "independent_retry");
      return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    }));
    const assessments = evidenceRows.filter((assessment) => assessment !== null);
    const practiceDays = new Set(completed.map((conversation) => dayKey(conversation.createdAt, profile.timezone))).size;
    const completedScenarioIds = [...new Set(completed.map((conversation) => conversation.scenarioId))];
    return { mastery: getMasteryLevel({ practiceDays, completedScenarios: completedScenarioIds.length, successfulRetries: assessments.filter((assessment) => assessment.passed).length, evidenceAssessments: assessments.length }), completedScenarioIds };
  }
  async function authenticate(request) {
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw new ApiError(401, "Sign in to continue.");
    const tokenHash = digest(token);
    const session = await store2.sessionByHash(tokenHash);
    if (!session || session.expiresAt <= now()) throw new ApiError(401, "Your session has expired. Please sign in.");
    const user = await store2.accountById(session.userId);
    if (!user) throw new ApiError(401, "Sign in to continue.");
    return { user, tokenHash };
  }
  async function issueSession(user) {
    const token = randomBytes2(32).toString("hex");
    const expiresAt = new Date(now().getTime() + 7 * 864e5);
    await store2.createSession({ tokenHash: digest(token), userId: user.id, expiresAt });
    return { token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email } };
  }
  async function verifiedOAuthIdentity(provider, accessToken) {
    if (provider === "google" && !options.oauth?.googleClientIds?.length) throw new ApiError(503, "Google sign-in is not configured for this deployment.");
    const response = provider === "google" ? await (options.oauth?.fetchImpl ?? fetch)(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`) : await (options.oauth?.fetchImpl ?? fetch)("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new ApiError(401, "The provider sign-in token is invalid or expired.");
    const data = await response.json();
    const email = (data.email ?? data.mail ?? data.userPrincipalName ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new ApiError(401, "The provider did not return an email address.");
    const subject = (provider === "google" ? data.sub : data.id)?.trim() ?? "";
    if (!subject) throw new ApiError(401, "The provider did not return a stable account identifier.");
    if (provider === "google" && data.email_verified !== true && data.email_verified !== "true") throw new ApiError(401, "The Google email is not verified.");
    if (provider === "google") {
      const allowedClientIds = options.oauth?.googleClientIds ?? [];
      const audiences = data.aud ? Array.isArray(data.aud) ? data.aud : [data.aud] : [];
      if (allowedClientIds.length > 0 && !audiences.some((audience) => allowedClientIds.includes(audience))) throw new ApiError(401, "The Google sign-in token was issued for an unrecognized application.");
    }
    return { email, subject };
  }
  app2.setErrorHandler((error, request, reply) => {
    if (error instanceof ConflictError) return reply.code(409).send({ error: error.message || "Unable to create account. Try signing in." });
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: error.message });
    const failure = error instanceof Error ? error : new Error("Unknown error");
    const status = "statusCode" in failure && typeof failure.statusCode === "number" && failure.statusCode >= 400 && failure.statusCode < 500 ? failure.statusCode : 500;
    if (status === 500) request.log.error({ errorType: failure.name }, "Request failed");
    return reply.code(status).send({ error: status === 500 ? "Service unavailable. Please try again." : failure.message });
  });
  app2.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app2.get("/health", async () => ({ status: "ok", version: "0.1.0" }));
  app2.get("/ready", async (_request, reply) => {
    try {
      await store2.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
  app2.get("/v1/catalog", async () => ({ modules, plans, priceNotice: "Proposed monthly INR prices. Store pricing and purchases are not configured.", liveVoiceAvailable: false }));
  app2.get("/v1/me/entitlement", async (request) => {
    const { user } = await authenticate(request);
    return { entitlement: await store2.entitlement(user.id) };
  });
  app2.post("/v1/billing/intents", async (request, reply) => {
    const { user } = await authenticate(request);
    if (!billingEnabled || !billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const parsed = purchaseIntentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid Apple or Google product.");
    const timestamp = now();
    const intent = { id: randomUUID2(), userId: user.id, provider: parsed.data.provider, productId: parsed.data.productId, nonce: randomBytes2(24).toString("base64url"), status: "pending", createdAt: timestamp, expiresAt: new Date(timestamp.getTime() + 15 * 6e4) };
    await store2.createPurchaseIntent(intent);
    return reply.code(201).send({ intent: { id: intent.id, provider: intent.provider, productId: intent.productId, nonce: intent.nonce, status: intent.status, expiresAt: intent.expiresAt.toISOString() }, message: "Purchase intent created. Include the nonce in the store purchase and send only verified store events to the webhook." });
  });
  app2.post("/v1/billing/webhooks/:provider", async (request, reply) => {
    if (!billingEnabled || !billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const provider = request.params.provider;
    if (provider !== "apple" && provider !== "google") throw new ApiError(400, "Choose Apple or Google as the billing provider.");
    if (request.headers["x-billing-webhook-secret"] !== billingWebhookSecret) throw new ApiError(401, "Billing webhook authentication failed.");
    const parsed = billingWebhookSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid entitlement event.");
    const intent = await store2.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.status === "cancelled" || intent.status === "pending" && intent.expiresAt <= now()) throw new ApiError(409, "The purchase intent is missing or expired.");
    if (intent.provider !== provider || intent.productId !== parsed.data.productId) throw new ApiError(409, "The store event does not match the purchase intent.");
    const user = await store2.accountById(intent.userId);
    if (!user) throw new ApiError(404, "The entitlement account was not found.");
    const existing = await store2.entitlementByTransactionId(parsed.data.transactionId);
    if (existing && (existing.userId !== intent.userId || existing.provider !== provider || existing.productId !== parsed.data.productId)) throw new ApiError(409, "The transaction is already linked to another entitlement.");
    const timestamp = now();
    const entitlement = {
      id: existing?.id ?? randomUUID2(),
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
      updatedAt: timestamp
    };
    const idempotent = Boolean(existing && existing.status === entitlement.status && existing.environment === entitlement.environment && existing.expiresAt?.getTime() === entitlement.expiresAt?.getTime());
    await store2.saveEntitlement(entitlement);
    await store2.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, received: true, idempotent });
  });
  app2.post("/v1/billing/purchases/verify", async (request, reply) => {
    const { user } = await authenticate(request);
    if (!billingEnabled || !billingWebhookSecret || !options.billing?.verifyPurchase) throw new ApiError(503, "Store purchase verification is not configured.");
    const parsed = billingPurchaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the store purchase details for verification.");
    const intent = await store2.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.userId !== user.id || intent.status === "cancelled" || intent.status === "pending" && intent.expiresAt <= now()) throw new ApiError(409, "The purchase intent is missing or expired.");
    if (intent.provider !== parsed.data.provider || intent.productId !== parsed.data.productId) throw new ApiError(409, "The purchase does not match the selected package.");
    let verified;
    try {
      verified = await options.billing.verifyPurchase({ provider: parsed.data.provider, productId: parsed.data.productId, transactionId: parsed.data.transactionId, purchaseToken: parsed.data.purchaseToken });
    } catch {
      throw new ApiError(503, "The store verification service is temporarily unavailable.");
    }
    if (!verified || verified.productId !== intent.productId || verified.transactionId !== parsed.data.transactionId) throw new ApiError(402, "The store purchase could not be verified.");
    const existing = await store2.entitlementByTransactionId(verified.transactionId);
    if (existing && existing.userId !== user.id) throw new ApiError(409, "The transaction is already linked to another account.");
    const timestamp = now();
    const entitlement = { id: existing?.id ?? randomUUID2(), userId: user.id, provider: parsed.data.provider, productId: verified.productId, transactionId: verified.transactionId, originalTransactionId: verified.originalTransactionId, purchaseToken: verified.purchaseToken, status: verified.status, environment: verified.environment, expiresAt: verified.expiresAt, providerEventDate: verified.providerEventDate, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
    await store2.saveEntitlement(entitlement);
    await store2.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, verified: true });
  });
  app2.post("/v1/billing/notifications/apple", async (request, reply) => {
    if (!billingEnabled || !options.billing?.verifyAppleNotification) throw new ApiError(503, "Apple notification verification is not configured.");
    const parsed = appleNotificationSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the signed Apple notification payload.");
    let notification;
    try {
      notification = await options.billing.verifyAppleNotification(parsed.data.signedPayload);
    } catch {
      throw new ApiError(400, "The Apple notification signature could not be verified.");
    }
    if (!notification || !planForProduct(notification.productId)) throw new ApiError(400, "The Apple notification is invalid or references an unknown product.");
    const byOriginal = await store2.entitlementByOriginalTransactionId("apple", notification.originalTransactionId);
    const byTransaction = await store2.entitlementByTransactionId(notification.transactionId);
    if (byTransaction && byTransaction.userId !== byOriginal?.userId) throw new ApiError(409, "The Apple transaction is linked to another account.");
    const existing = byOriginal ?? byTransaction;
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    if (existing.providerEventDate && notification.providerEventDate && notification.providerEventDate <= existing.providerEventDate) return reply.send({ received: true, matched: true, idempotent: true });
    const timestamp = now();
    const entitlement = { id: existing.transactionId === notification.transactionId ? existing.id : randomUUID2(), userId: existing.userId, provider: "apple", productId: notification.productId, transactionId: notification.transactionId, originalTransactionId: notification.originalTransactionId, purchaseToken: existing.purchaseToken, status: notification.status, environment: notification.environment, expiresAt: notification.expiresAt, providerEventDate: notification.providerEventDate, createdAt: existing.createdAt, updatedAt: timestamp };
    await store2.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app2.post("/v1/billing/notifications/google", async (request, reply) => {
    if (!billingEnabled || !options.billing?.verifyPurchase) throw new ApiError(503, "Google notification verification is not configured.");
    const oidcAuthenticated = options.billing.verifyGoogleNotificationRequest ? await options.billing.verifyGoogleNotificationRequest(request.headers.authorization) : false;
    const sharedSecretAuthenticated = Boolean(googleNotificationSecret && request.headers["x-google-pubsub-secret"] === googleNotificationSecret);
    if (!oidcAuthenticated && !sharedSecretAuthenticated) throw new ApiError(401, "Google notification authentication failed.");
    const envelope = googlePubSubSchema.safeParse(request.body);
    if (!envelope.success) throw new ApiError(400, "Provide a valid Google Pub/Sub notification envelope.");
    let decoded;
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
      verified = await options.billing.verifyPurchase({ provider: "google", productId: event.subscriptionId, transactionId: event.purchaseToken, purchaseToken: event.purchaseToken });
    } catch {
      throw new ApiError(503, "The Google verification service is temporarily unavailable.");
    }
    if (!verified || verified.productId !== event.subscriptionId) return reply.code(202).send({ received: true, matched: false });
    const existing = await store2.entitlementByPurchaseToken("google", event.purchaseToken);
    if (!existing) return reply.code(202).send({ received: true, matched: false });
    const providerEventDate = new Date(Number(notification.data.eventTimeMillis));
    if (!Number.isFinite(providerEventDate.getTime())) throw new ApiError(400, "The Google notification timestamp is invalid.");
    if (existing.providerEventDate && providerEventDate <= existing.providerEventDate) return reply.send({ received: true, matched: true, idempotent: true });
    const timestamp = now();
    const entitlement = { ...existing, productId: verified.productId, status: verified.status, environment: verified.environment, expiresAt: verified.expiresAt, providerEventDate, updatedAt: timestamp };
    await store2.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app2.get("/v1/scenarios/library", async () => {
    const catalog = await availableScenarios();
    return { scenarios: catalog, count: catalog.length };
  });
  app2.post("/v1/manager/scenarios", async (request, reply) => {
    const manager = await requireManager(request);
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a complete scenario with a valid module, goal, level and prompts.");
    const catalog = await availableScenarios();
    if (catalog.some((scenario2) => scenario2.id === parsed.data.id)) throw new ApiError(409, "A scenario with this id already exists.");
    const scenario = { ...parsed.data, reviewStatus: "draft", ownerId: manager.userId, reviewedBy: null, reviewedAt: null };
    await store2.createCustomScenario(scenario);
    return reply.code(201).send({ scenario, message: "Scenario added to the library as a draft for review." });
  });
  app2.post("/v1/manager/scenarios/:id/review", async (request, reply) => {
    const manager = await requireManager(request);
    const id = request.params.id;
    const parsed = reviewScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a scenario and a valid review status.");
    const scenario = await store2.reviewCustomScenario(id, parsed.data.status, manager.userId, now());
    if (!scenario) throw new ApiError(404, "Scenario not found.");
    return reply.send({ scenario, message: parsed.data.status === "published" ? "Scenario published for learner practice." : `Scenario marked ${parsed.data.status}.` });
  });
  app2.get("/v1/manager/scenarios/:id/revisions", async (request, reply) => {
    await requireManager(request);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "Choose a scenario.");
    const revisions = await store2.scenarioRevisions(id);
    if (revisions.length === 0) throw new ApiError(404, "Scenario not found.");
    return reply.send({ revisions });
  });
  app2.post("/v1/manager/scenarios/:id/rollback", async (request, reply) => {
    const manager = await requireManager(request);
    const id = request.params.id;
    const parsed = rollbackScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a valid scenario revision.");
    const scenario = await store2.rollbackCustomScenario(id, parsed.data.revisionId, manager.userId, now());
    if (!scenario) throw new ApiError(404, "Scenario or revision not found.");
    return reply.send({ scenario, message: "Scenario rolled back as a draft. Review and publish it before learner practice." });
  });
  app2.post("/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and a password of 12\u2013128 characters.");
    const user = await store2.createAccount(parsed.data.email, await hashPassword(parsed.data.password));
    return reply.code(201).send(await issueSession(user));
  });
  app2.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.");
    const user = await store2.accountByEmail(parsed.data.email);
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new ApiError(401, "Email or password is incorrect.");
    return issueSession(user);
  });
  app2.post("/v1/auth/oauth", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = oauthSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose Google or Microsoft and try again.");
    const identity = await verifiedOAuthIdentity(parsed.data.provider, parsed.data.accessToken);
    const linked = await store2.oauthIdentity(parsed.data.provider, identity.subject);
    const linkedUser = linked ? await store2.accountById(linked.userId) : null;
    if (linked && !linkedUser) throw new ApiError(401, "The provider identity is no longer linked to an account.");
    const existing = linkedUser ?? await store2.accountByEmail(identity.email);
    const user = existing ?? await store2.createAccount(identity.email, await hashPassword(randomBytes2(32).toString("hex")));
    if (!linked) {
      const timestamp = now();
      const oauthIdentity = { id: randomUUID2(), provider: parsed.data.provider, subject: identity.subject, userId: user.id, createdAt: timestamp, updatedAt: timestamp };
      await store2.saveOAuthIdentity(oauthIdentity);
    }
    return issueSession(user);
  });
  app2.post("/v1/auth/logout", async (request, reply) => {
    const { tokenHash } = await authenticate(request);
    await store2.deleteSession(tokenHash);
    return reply.code(204).send();
  });
  app2.post("/v1/auth/logout-all", async (request, reply) => {
    const { user } = await authenticate(request);
    await store2.deleteSessions(user.id);
    return reply.code(204).send();
  });
  app2.delete("/v1/me", async (request, reply) => {
    const { user } = await authenticate(request);
    await store2.deleteAccount(user.id);
    return reply.code(204).send();
  });
  app2.get("/v1/me", async (request) => {
    const { user } = await authenticate(request);
    return { user: { id: user.id, email: user.email }, profile: await store2.profile(user.id) };
  });
  app2.put("/v1/me/profile", async (request) => {
    const { user } = await authenticate(request);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "));
    await store2.saveProfile(user.id, parsed.data);
    return { profile: parsed.data };
  });
  app2.get("/v1/me/scenarios", async (request) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const progress = await learnerScenarioProgress(user.id, profile);
    return { scenarios: recommendScenarios(profile, (await availableScenarios()).filter(isPublishedScenario), progress.mastery.level, progress.completedScenarioIds), mastery: progress.mastery, previewOnly: true };
  });
  app2.get("/v1/me/conversations", async (request) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const catalog = await availableScenarios();
    const items = (await store2.conversations(user.id, 10)).map((conversation) => ({ conversation: { id: conversation.id, scenarioId: conversation.scenarioId, state: conversation.state, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, scenario: conversation.scenarioSnapshot ?? catalog.find((item) => item.id === conversation.scenarioId) })).filter((item) => item.scenario);
    return { conversations: items };
  });
  app2.get("/v1/me/progress", async (request) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await store2.conversations(user.id);
    const completed = conversations.filter((conversation) => completedStates.has(conversation.state));
    const evidenceRows = await Promise.all(completed.map(async (conversation) => {
      const turns = await store2.conversationTurns(user.id, conversation.id);
      const primary = turns.find((turn) => turn.role === "user" && turn.phase === "primary");
      const retry = [...turns].reverse().find((turn) => turn.role === "user" && turn.phase === "independent_retry");
      return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    }));
    const assessments = evidenceRows.filter((assessment) => assessment !== null);
    const weekStart = now().getTime() - 7 * 864e5;
    const weekly = conversations.filter((conversation) => conversation.createdAt.getTime() >= weekStart);
    const activeDays = new Set(conversations.map((conversation) => dayKey(conversation.createdAt, profile.timezone)));
    let currentStreakDays = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const day = new Date(now().getTime() - offset * 864e5);
      if (!activeDays.has(dayKey(day, profile.timezone))) break;
      currentStreakDays += 1;
    }
    const practiceMinutes = completed.length * profile.practiceMinutes;
    const engagement = getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays });
    const practiceDays = new Set(completed.map((conversation) => dayKey(conversation.createdAt, profile.timezone))).size;
    const completedScenarios = new Set(completed.map((conversation) => conversation.scenarioId)).size;
    const successfulRetries = assessments.filter((assessment) => assessment.passed).length;
    const mastery = getMasteryLevel({ practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length });
    const dailyPractice = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now().getTime() - (6 - index) * 864e5);
      const key = dayKey(date, profile.timezone);
      const daySessions = conversations.filter((conversation) => dayKey(conversation.createdAt, profile.timezone) === key);
      const dayCompleted = daySessions.filter((conversation) => completedStates.has(conversation.state));
      return { day: key.slice(5), minutes: dayCompleted.length * profile.practiceMinutes, sessions: daySessions.length };
    });
    const levelTrack = masteryLevels.map((item) => ({ level: item.level, title: item.title, reached: mastery.level >= item.level }));
    const skillSignal = assessments.length ? Math.round(assessments.reduce((total, assessment) => total + assessment.score, 0) / assessments.length) : null;
    return { totalSessions: conversations.length, completedSessions: completed.length, weeklySessions: weekly.length, practiceMinutes, weeklyPracticeMinutes: weekly.length * profile.practiceMinutes, currentStreakDays, engagement, mastery, practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length, dailyPractice, levelTrack, skillSignal, skillSignalStatus: skillSignal === null ? "awaiting_assessment" : "available" };
  });
  app2.get("/v1/me/export", async (request) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await store2.conversations(user.id);
    const records = await Promise.all(conversations.map(async (conversation) => ({ conversation: { id: conversation.id, scenarioId: conversation.scenarioId, scenarioSnapshot: conversation.scenarioSnapshot, state: conversation.state, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, turns: await store2.conversationTurns(user.id, conversation.id) })));
    return { exportedAt: now().toISOString(), user: { id: user.id, email: user.email }, profile, conversations: records };
  });
  app2.get("/v1/me/voice-usage", async (request) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    const timezone = profile?.timezone ?? "Asia/Kolkata";
    const today = dayKey(now(), timezone);
    const usage = await store2.usage(user.id, today);
    const allowanceSeconds = await dailyAllowance(user.id);
    return { timezone, dayKey: today, allowanceSeconds, reservedSeconds: usage.reservedSeconds, consumedSeconds: usage.consumedSeconds, remainingSeconds: Math.max(0, allowanceSeconds - usage.reservedSeconds), resetsAt: nextReset(now(), timezone), enforcement: "server_reservations", liveVoiceAvailable: false };
  });
  app2.post("/v1/me/conversations", async (request, reply) => {
    const { user } = await authenticate(request);
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const parsed = conversationCreateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid practice scenario.");
    const progress = await learnerScenarioProgress(user.id, profile);
    const scenario = recommendScenarios(profile, (await availableScenarios()).filter(isPublishedScenario), progress.mastery.level, progress.completedScenarioIds).find((item) => item.id === parsed.data.scenarioId);
    if (!scenario) throw new ApiError(403, "That scenario is not available for this profile.");
    const timestamp = now();
    const conversation = { id: randomUUID2(), userId: user.id, scenarioId: scenario.id, scenarioSnapshot: scenario, state: "CREATED", createdAt: timestamp, updatedAt: timestamp };
    await store2.createConversation(conversation);
    return reply.code(201).send({ conversation: { id: conversation.id, scenarioId: scenario.id, state: conversation.state, createdAt: timestamp.toISOString() }, scenario, liveVoiceAvailable: false, message: "Practice session created. Live AI voice is not connected yet." });
  });
  app2.get("/v1/me/conversations/:id", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store2.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    const profile = await store2.profile(user.id);
    const scenario = conversation.scenarioSnapshot ?? (profile ? (await availableScenarios()).find((item) => item.id === conversation.scenarioId) : void 0);
    if (!scenario) return reply.code(404).send({ error: "Conversation scenario is no longer available." });
    return { conversation: { ...conversation, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() }, scenario, turns: await store2.conversationTurns(user.id, id), liveVoiceAvailable: false };
  });
  app2.post("/v1/me/conversations/:id/turns", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store2.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session cannot accept another response.");
    const parsed = userConversationTurnSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a response between 1 and 10,000 characters.");
    const turn = { id: randomUUID2(), sessionId: id, role: "user", phase: parsed.data.phase, text: parsed.data.text, createdAt: now() };
    await store2.addConversationTurn(turn);
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: parsed.data.phase === "independent_retry" ? "Independent retry saved. Complete the practice to record your evidence." : "Primary response saved. Now try the independent retry." });
  });
  app2.post("/v1/me/conversations/:id/complete", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await store2.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session is already closed.");
    const turns = await store2.conversationTurns(user.id, id);
    if (!turns.some((turn) => turn.role === "user" && turn.phase === "primary")) throw new ApiError(409, "Save your primary response before finishing practice.");
    if (!turns.some((turn) => turn.role === "user" && turn.phase === "independent_retry")) throw new ApiError(409, "Complete the independent retry before finishing practice.");
    const primary = turns.find((turn) => turn.role === "user" && turn.phase === "primary");
    const retry = [...turns].reverse().find((turn) => turn.role === "user" && turn.phase === "independent_retry");
    const evidence = primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    const completed = await store2.updateConversationState(user.id, id, "COMPLETED");
    return { conversation: { id: completed.id, state: completed.state, completedAt: completed.updatedAt.toISOString() }, evidence: evidence ? { score: evidence.score, passed: evidence.passed } : null, message: evidence?.passed ? "Practice completed. Your independent retry met the local evidence checks." : "Practice completed. More evidence is needed before this retry counts as successful." };
  });
  app2.get("/v1/voice/readiness", async (request) => {
    await authenticate(request);
    return realtimeConfigured ? { available: true, code: "SERVER_PROVIDER_READY", message: "The coach voice provider is configured. Use an Android or iOS development build for the live conversation." } : { available: false, code: "PROVIDER_NOT_CONFIGURED", message: "Live AI voice is not configured on the server. You can still test your microphone locally; no audio is sent to an AI provider." };
  });
  app2.get("/v1/voice/capabilities", async (request) => {
    await authenticate(request);
    const requestedPlatform = request.query && typeof request.query === "object" ? request.query.platform : void 0;
    const requestedCapabilities = request.query && typeof request.query === "object" ? request.query : {};
    const platform = requestedPlatform === "android" || requestedPlatform === "ios" ? requestedPlatform : "web";
    return voiceTransportStatus({ platform, nativeModuleAvailable: requestedCapabilities.nativeModuleAvailable === "true", developmentBuild: requestedCapabilities.developmentBuild === "true", providerConfigured: realtimeConfigured });
  });
  app2.post("/v1/voice/sessions", async (request, reply) => {
    const { user } = await authenticate(request);
    if (request.headers.origin) throw new ApiError(403, "Live voice requires an Android or iOS development build.");
    if (!realtimeProvider) return reply.code(503).send({ error: "Live voice is disabled pending provider configuration and native transport verification." });
    const parsed = voiceSessionSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid conversation and scenario.");
    const profile = await store2.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversation = await store2.conversation(user.id, parsed.data.conversationId);
    const scenario = (await availableScenarios()).filter(isPublishedScenario).find((item) => item.id === parsed.data.scenarioId);
    if (!conversation || conversation.scenarioId !== parsed.data.scenarioId || !scenario) throw new ApiError(404, "Practice conversation not found.");
    const allowanceSeconds = await dailyAllowance(user.id);
    if (allowanceSeconds <= 0) throw new ApiError(402, billingEnabled ? "An active practice plan is required before starting live voice." : "Live voice allowance is not configured.");
    const usage = await store2.usage(user.id, dayKey(now(), profile.timezone));
    const remainingSeconds = allowanceSeconds - usage.reservedSeconds;
    const maximumSeconds = Math.min(profile.practiceMinutes * 60, remainingSeconds);
    if (maximumSeconds <= 0) throw new ApiError(409, "Your daily voice allowance is exhausted. Try again after the allowance resets.");
    try {
      const result = await startLiveConversation({ store: store2, provider: realtimeProvider, userId: user.id, conversationId: conversation.id, scenarioId: scenario.id, instructions: `You are a communication coach. Guide the learner through this practice scenario: ${scenario.question} Then ask the learner to try independently: ${scenario.independentQuestion}. Do not score or diagnose the learner during the live exchange.`, dayKey: dayKey(now(), profile.timezone), allowanceSeconds, maximumSeconds, now: () => now() });
      const timestamp = now();
      const session = { id: randomUUID2(), userId: user.id, conversationId: conversation.id, reservationId: result.reservationId, providerSessionId: result.connection.providerSessionId, providerCallId: null, providerTerminatedAt: null, status: "active", startedAt: timestamp, expiresAt: result.connection.expiresAt, endedAt: null };
      await store2.createVoiceSession(session);
      return reply.code(201).send({ sessionId: session.id, conversation: { id: conversation.id, state: result.state }, reservationId: result.reservationId, clientSecret: result.connection.clientSecret, expiresAt: result.connection.expiresAt.toISOString(), providerSessionCreated: true, liveVoiceAvailable: false, message: "Provider session created. Native WebRTC transport remains gated until device verification." });
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw new ApiError(503, "The live voice provider is temporarily unavailable.");
      throw error;
    }
  });
  app2.post("/v1/voice/sessions/:id/bind", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    const parsed = voiceProviderCallSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid provider call identifier.");
    const session = await store2.bindVoiceProviderCall(user.id, id, parsed.data.providerCallId);
    return reply.send({ sessionId: session.id, providerCallId: session.providerCallId, message: "Provider call bound for server-side termination." });
  });
  app2.post("/v1/voice/sessions/:id/transcript", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    const parsed = voiceTranscriptSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid voice transcript.");
    const session = await store2.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "The voice session is already closed.");
    const turn = { id: randomUUID2(), sessionId: session.conversationId, role: parsed.data.role, phase: parsed.data.phase, text: parsed.data.text, createdAt: now() };
    await store2.addConversationTurn(turn);
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: "Voice transcript saved." });
  });
  app2.post("/v1/voice/sessions/:id/stop", async (request, reply) => {
    const { user } = await authenticate(request);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A voice session id is required.");
    const parsed = voiceStopSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid consumed duration.");
    const session = await store2.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "Voice session is already closed.");
    let providerTermination = "not_bound";
    if (realtimeProvider && session.providerCallId) {
      try {
        await realtimeProvider.terminate(session.providerCallId);
        await store2.markVoiceProviderTerminated(session.id, now());
        providerTermination = "completed";
      } catch {
        providerTermination = "failed";
      }
    }
    await store2.endVoiceSession(user.id, id, now(), "ended");
    await store2.settleUsage(session.reservationId, parsed.data.consumedSeconds);
    const conversation = await store2.conversation(user.id, session.conversationId);
    if (conversation?.state === "ACTIVE") await store2.updateConversationState(user.id, session.conversationId, "INTERRUPTED");
    return { sessionId: id, status: "ended", consumedSeconds: parsed.data.consumedSeconds, conversationState: "INTERRUPTED", providerTermination };
  });
  return app2;
}

// src/prisma-store.ts
import { Prisma } from "@prisma/client";
import { profileSchema as profileSchema2, scenarioSchema as scenarioSchema2, states } from "@coach/core";
var accountFromRow = (row) => ({ id: row.id, email: row.email, passwordHash: row.passwordHash, role: row.role === "manager" ? "manager" : "learner" });
var accountFromNullableRow = (row) => row ? accountFromRow(row) : null;
function prismaStore(db) {
  return {
    async ready() {
      await db.$queryRaw`SELECT 1`;
    },
    async createAccount(email, passwordHash) {
      try {
        return accountFromRow(await db.user.create({ data: { email, passwordHash } }));
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError();
        throw error;
      }
    },
    async accountByEmail(email) {
      return accountFromNullableRow(await db.user.findUnique({ where: { email } }));
    },
    async accountById(id) {
      return accountFromNullableRow(await db.user.findUnique({ where: { id } }));
    },
    async oauthIdentity(provider, subject) {
      const row = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider, subject } } });
      return row ? { ...row, provider: row.provider } : null;
    },
    async saveOAuthIdentity(identity) {
      try {
        await db.oAuthIdentity.create({ data: identity });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("This provider identity is already linked to another account.");
        throw error;
      }
    },
    async createSession(session) {
      await db.authSession.create({ data: session });
    },
    sessionByHash: (tokenHash) => db.authSession.findUnique({ where: { tokenHash } }),
    async deleteSession(tokenHash) {
      await db.authSession.deleteMany({ where: { tokenHash } });
    },
    async deleteSessions(userId) {
      await db.authSession.deleteMany({ where: { userId } });
    },
    async deleteAccount(userId) {
      await db.user.delete({ where: { id: userId } });
    },
    async profile(userId) {
      const stored = await db.userProfile.findUnique({ where: { userId } });
      return stored ? profileSchema2.parse(stored.data) : null;
    },
    async saveProfile(userId, profile) {
      await db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        const existing = await transaction.userProfile.findUnique({ where: { userId } });
        if (existing && existing.timezone !== profile.timezone) throw new ConflictError("Timezone changes require support");
        const data = { data: profile, timezone: profile.timezone };
        await transaction.userProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      });
    },
    async usage(userId, dayKey2) {
      const rows = await db.usageReservation.aggregate({
        where: { userId, dayKey: dayKey2 },
        _sum: { reservedSeconds: true, consumedSeconds: true }
      });
      return { reservedSeconds: rows._sum.reservedSeconds ?? 0, consumedSeconds: rows._sum.consumedSeconds ?? 0 };
    },
    async reserveUsage(reservation, allowanceSeconds) {
      await db.$transaction(async (transaction) => {
        const rows = await transaction.usageReservation.aggregate({
          where: { userId: reservation.userId, dayKey: reservation.dayKey },
          _sum: { reservedSeconds: true, consumedSeconds: true }
        });
        const reserved = rows._sum.reservedSeconds ?? 0;
        const consumed = rows._sum.consumedSeconds ?? 0;
        if (reserved + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
        await transaction.usageReservation.create({ data: { ...reservation, reservedSeconds: reservation.seconds } });
      });
    },
    async settleUsage(reservationId, consumedSeconds) {
      if (!Number.isInteger(consumedSeconds) || consumedSeconds < 0) throw new Error("Invalid usage settlement");
      await db.$transaction(async (transaction) => {
        const reservation = await transaction.usageReservation.findUnique({ where: { id: reservationId } });
        if (!reservation) throw new Error("Usage reservation not found");
        const settled = Math.min(consumedSeconds, reservation.reservedSeconds);
        await transaction.usageReservation.update({ where: { id: reservationId }, data: { reservedSeconds: settled, consumedSeconds: settled } });
      });
    },
    async createConversation(conversation) {
      await db.conversation.create({ data: { id: conversation.id, userId: conversation.userId, scenarioId: conversation.scenarioId, scenarioData: conversation.scenarioSnapshot, state: conversation.state, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt } });
    },
    async conversation(userId, id) {
      const row = await db.conversation.findFirst({ where: { id, userId } });
      if (!row || !states.includes(row.state)) return null;
      return { ...row, scenarioSnapshot: row.scenarioData ? scenarioSchema2.parse(row.scenarioData) : void 0, state: row.state };
    },
    async conversations(userId, limit) {
      const rows = await db.conversation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...limit === void 0 ? {} : { take: Math.min(Math.max(limit, 1), 20) } });
      return rows.filter((row) => states.includes(row.state)).map((row) => ({ ...row, scenarioSnapshot: row.scenarioData ? scenarioSchema2.parse(row.scenarioData) : void 0, state: row.state }));
    },
    async updateConversationState(userId, id, state) {
      const row = await db.conversation.updateMany({ where: { id, userId }, data: { state } });
      if (row.count !== 1) throw new Error("Conversation not found");
      const updated = await db.conversation.findUniqueOrThrow({ where: { id } });
      return { ...updated, scenarioSnapshot: updated.scenarioData ? scenarioSchema2.parse(updated.scenarioData) : void 0, state: updated.state };
    },
    async addConversationTurn(turn) {
      await db.conversationTurn.create({ data: turn });
    },
    async conversationTurns(userId, sessionId) {
      const owner = await db.conversation.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
      if (!owner) return [];
      const turns = await db.conversationTurn.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
      return turns.map((turn) => ({ ...turn, role: turn.role, phase: turn.phase }));
    },
    async customScenarios() {
      const rows = await db.customScenario.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((row) => scenarioSchema2.parse(row.data));
    },
    async createCustomScenario(scenario) {
      try {
        await db.$transaction(async (transaction) => {
          await transaction.customScenario.create({ data: { id: scenario.id, data: scenario } });
          await transaction.customScenarioRevision.create({ data: { scenarioId: scenario.id, version: 1, data: scenario, changedBy: scenario.ownerId ?? void 0 } });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A scenario with this id already exists.");
        throw error;
      }
    },
    async reviewCustomScenario(id, status, reviewerId, reviewedAt) {
      return db.$transaction(async (transaction) => {
        const existing = await transaction.customScenario.findUnique({ where: { id } });
        if (!existing) return null;
        const scenario = scenarioSchema2.parse(existing.data);
        const reviewed = { ...scenario, reviewStatus: status, reviewedBy: reviewerId, reviewedAt: reviewedAt.toISOString() };
        const version = await transaction.customScenarioRevision.count({ where: { scenarioId: id } }) + 1;
        await transaction.customScenario.update({ where: { id }, data: { data: reviewed } });
        await transaction.customScenarioRevision.create({ data: { scenarioId: id, version, data: reviewed, changedBy: reviewerId ?? void 0, createdAt: reviewedAt } });
        return reviewed;
      });
    },
    async scenarioRevisions(id) {
      const rows = await db.customScenarioRevision.findMany({ where: { scenarioId: id }, orderBy: { version: "asc" } });
      return rows.map((row) => ({ id: row.id, scenarioId: row.scenarioId, version: row.version, scenario: scenarioSchema2.parse(row.data), changedBy: row.changedBy, createdAt: row.createdAt }));
    },
    async rollbackCustomScenario(id, revisionId, reviewerId, reviewedAt) {
      return db.$transaction(async (transaction) => {
        const [currentRow, revision] = await Promise.all([transaction.customScenario.findUnique({ where: { id } }), transaction.customScenarioRevision.findFirst({ where: { id: revisionId, scenarioId: id } })]);
        if (!currentRow || !revision) return null;
        const current = scenarioSchema2.parse(currentRow.data);
        const target = scenarioSchema2.parse(revision.data);
        const rolledBack = { ...target, id, version: current.version + 1, ownerId: current.ownerId ?? null, reviewStatus: "draft", reviewedBy: null, reviewedAt: null };
        const version = await transaction.customScenarioRevision.count({ where: { scenarioId: id } }) + 1;
        await transaction.customScenario.update({ where: { id }, data: { data: rolledBack } });
        await transaction.customScenarioRevision.create({ data: { scenarioId: id, version, data: rolledBack, changedBy: reviewerId ?? void 0, createdAt: reviewedAt } });
        return rolledBack;
      });
    },
    async entitlement(userId) {
      const row = await db.entitlement.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider, status: row.status, environment: row.environment } : null;
    },
    async entitlementByTransactionId(transactionId) {
      const row = await db.entitlement.findUnique({ where: { transactionId } });
      return row ? { ...row, provider: row.provider, status: row.status, environment: row.environment } : null;
    },
    async entitlementByOriginalTransactionId(provider, originalTransactionId) {
      const row = await db.entitlement.findFirst({ where: { provider, originalTransactionId }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider, status: row.status, environment: row.environment } : null;
    },
    async entitlementByPurchaseToken(provider, purchaseToken) {
      const row = await db.entitlement.findFirst({ where: { provider, purchaseToken }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider, status: row.status, environment: row.environment } : null;
    },
    async saveEntitlement(entitlement) {
      await db.entitlement.upsert({ where: { transactionId: entitlement.transactionId }, create: entitlement, update: { userId: entitlement.userId, provider: entitlement.provider, productId: entitlement.productId, originalTransactionId: entitlement.originalTransactionId, purchaseToken: entitlement.purchaseToken, status: entitlement.status, environment: entitlement.environment, expiresAt: entitlement.expiresAt, providerEventDate: entitlement.providerEventDate } });
    },
    async createPurchaseIntent(intent) {
      await db.purchaseIntent.create({ data: intent });
    },
    async purchaseIntent(id) {
      const row = await db.purchaseIntent.findUnique({ where: { id } });
      return row ? { ...row, provider: row.provider, status: row.status } : null;
    },
    async completePurchaseIntent(id) {
      await db.purchaseIntent.updateMany({ where: { id, status: "pending" }, data: { status: "completed" } });
    },
    async createVoiceSession(session) {
      await db.voiceSession.create({ data: session });
    },
    async voiceSession(userId, id) {
      const row = await db.voiceSession.findFirst({ where: { id, userId } });
      return row ? { ...row, status: row.status } : null;
    },
    async bindVoiceProviderCall(userId, id, providerCallId) {
      const updated = await db.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { providerCallId } });
      if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
      const row = await db.voiceSession.findUniqueOrThrow({ where: { id } });
      return { ...row, status: row.status };
    },
    async markVoiceProviderTerminated(id, terminatedAt) {
      await db.voiceSession.updateMany({ where: { id, providerTerminatedAt: null }, data: { providerTerminatedAt: terminatedAt } });
    },
    async pendingVoiceProviderCalls() {
      const rows = await db.voiceSession.findMany({ where: { status: { not: "active" }, providerCallId: { not: null }, providerTerminatedAt: null } });
      return rows.map((row) => ({ ...row, status: row.status }));
    },
    async endVoiceSession(userId, id, endedAt, status) {
      const updated = await db.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { status, endedAt } });
      if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
      const row = await db.voiceSession.findUniqueOrThrow({ where: { id } });
      return { ...row, status: row.status };
    },
    async expireVoiceSessions(now) {
      const rows = await db.voiceSession.findMany({ where: { status: "active", expiresAt: { lte: now } }, select: { id: true, conversationId: true, reservationId: true } });
      for (const row of rows) await db.$transaction(async (transaction) => {
        const updated = await transaction.voiceSession.updateMany({ where: { id: row.id, status: "active" }, data: { status: "expired", endedAt: now } });
        if (updated.count !== 1) return;
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (reservation) await transaction.usageReservation.update({ where: { id: row.reservationId }, data: { reservedSeconds: reservation.consumedSeconds } });
        await transaction.conversation.updateMany({ where: { id: row.conversationId, state: "ACTIVE" }, data: { state: "EXPIRED" } });
      });
      return rows.length;
    }
  };
}

// src/memory-store.ts
import { randomUUID as randomUUID3 } from "node:crypto";
var MemoryStore = class {
  accounts = /* @__PURE__ */ new Map();
  oauthIdentities = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  profiles = /* @__PURE__ */ new Map();
  reservations = /* @__PURE__ */ new Map();
  conversationRows = /* @__PURE__ */ new Map();
  turns = /* @__PURE__ */ new Map();
  scenarioRows = /* @__PURE__ */ new Map();
  scenarioRevisionRows = /* @__PURE__ */ new Map();
  entitlements = /* @__PURE__ */ new Map();
  purchaseIntents = /* @__PURE__ */ new Map();
  voiceSessions = /* @__PURE__ */ new Map();
  async ready() {
  }
  async createAccount(email, passwordHash) {
    if ([...this.accounts.values()].some((account2) => account2.email === email)) throw new ConflictError();
    const account = { id: randomUUID3(), email, passwordHash, role: "learner" };
    this.accounts.set(account.id, account);
    return account;
  }
  async accountByEmail(email) {
    return [...this.accounts.values()].find((account) => account.email === email) ?? null;
  }
  async accountById(id) {
    return this.accounts.get(id) ?? null;
  }
  async oauthIdentity(provider, subject) {
    return this.oauthIdentities.get(`${provider}:${subject}`) ?? null;
  }
  async saveOAuthIdentity(identity) {
    const key = `${identity.provider}:${identity.subject}`;
    const existing = this.oauthIdentities.get(key);
    if (existing && existing.userId !== identity.userId) throw new ConflictError("This provider identity is already linked to another account.");
    this.oauthIdentities.set(key, identity);
  }
  async createSession(session) {
    this.sessions.set(session.tokenHash, session);
  }
  async sessionByHash(hash) {
    return this.sessions.get(hash) ?? null;
  }
  async deleteSession(hash) {
    this.sessions.delete(hash);
  }
  async deleteSessions(userId) {
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
  }
  async deleteAccount(userId) {
    this.accounts.delete(userId);
    this.profiles.delete(userId);
    for (const [key, identity] of this.oauthIdentities) if (identity.userId === userId) this.oauthIdentities.delete(key);
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
    for (const [id, reservation] of this.reservations) if (reservation.userId === userId) this.reservations.delete(id);
    for (const [id, conversation] of this.conversationRows) if (conversation.userId === userId) {
      this.conversationRows.delete(id);
      this.turns.delete(id);
    }
    for (const [id, entitlement] of this.entitlements) if (entitlement.userId === userId) this.entitlements.delete(id);
    for (const [id, intent] of this.purchaseIntents) if (intent.userId === userId) this.purchaseIntents.delete(id);
    for (const [id, session] of this.voiceSessions) if (session.userId === userId) this.voiceSessions.delete(id);
  }
  async profile(userId) {
    return this.profiles.get(userId) ?? null;
  }
  async saveProfile(userId, profile) {
    const old = this.profiles.get(userId);
    if (old && old.timezone !== profile.timezone) throw new ConflictError("Timezone changes require support");
    this.profiles.set(userId, profile);
  }
  async usage(userId, dayKey2) {
    return [...this.reservations.values()].filter((row) => row.userId === userId && row.dayKey === dayKey2).reduce((total, row) => ({ reservedSeconds: total.reservedSeconds + row.seconds, consumedSeconds: total.consumedSeconds + row.consumedSeconds }), { reservedSeconds: 0, consumedSeconds: 0 });
  }
  async reserveUsage(reservation, allowanceSeconds) {
    const current = await this.usage(reservation.userId, reservation.dayKey);
    if (current.reservedSeconds + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
    this.reservations.set(reservation.id, { ...reservation, consumedSeconds: 0 });
  }
  async settleUsage(reservationId, consumedSeconds) {
    const row = this.reservations.get(reservationId);
    if (!row) throw new Error("Usage reservation not found");
    row.consumedSeconds = Math.min(consumedSeconds, row.seconds);
    row.seconds = row.consumedSeconds;
  }
  async createConversation(conversation) {
    this.conversationRows.set(conversation.id, conversation);
  }
  async conversation(userId, id) {
    const row = this.conversationRows.get(id);
    return row?.userId === userId ? row : null;
  }
  async conversations(userId, limit) {
    const rows = [...this.conversationRows.values()].filter((row) => row.userId === userId).sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
    return limit === void 0 ? rows : rows.slice(0, limit);
  }
  async updateConversationState(userId, id, state) {
    const row = await this.conversation(userId, id);
    if (!row) throw new Error("Conversation not found");
    row.state = state;
    row.updatedAt = /* @__PURE__ */ new Date();
    return row;
  }
  async addConversationTurn(turn) {
    this.turns.set(turn.sessionId, [...this.turns.get(turn.sessionId) ?? [], turn]);
  }
  async conversationTurns(userId, sessionId) {
    return this.conversationRows.get(sessionId)?.userId === userId ? this.turns.get(sessionId) ?? [] : [];
  }
  async customScenarios() {
    return [...this.scenarioRows.values()];
  }
  async createCustomScenario(scenario) {
    if (this.scenarioRows.has(scenario.id)) throw new ConflictError("A scenario with this id already exists.");
    this.scenarioRows.set(scenario.id, scenario);
    this.scenarioRevisionRows.set(scenario.id, [{ id: randomUUID3(), scenarioId: scenario.id, version: 1, scenario, changedBy: scenario.ownerId ?? null, createdAt: /* @__PURE__ */ new Date() }]);
  }
  async reviewCustomScenario(id, status, reviewerId, reviewedAt) {
    const scenario = this.scenarioRows.get(id);
    if (!scenario) return null;
    const reviewed = { ...scenario, reviewStatus: status, reviewedBy: reviewerId, reviewedAt: reviewedAt.toISOString() };
    this.scenarioRows.set(id, reviewed);
    const revisions = this.scenarioRevisionRows.get(id) ?? [];
    revisions.push({ id: randomUUID3(), scenarioId: id, version: revisions.length + 1, scenario: reviewed, changedBy: reviewerId, createdAt: reviewedAt });
    this.scenarioRevisionRows.set(id, revisions);
    return reviewed;
  }
  async scenarioRevisions(id) {
    return [...this.scenarioRevisionRows.get(id) ?? []].sort((first, second) => first.version - second.version);
  }
  async rollbackCustomScenario(id, revisionId, reviewerId, reviewedAt) {
    const current = this.scenarioRows.get(id);
    const revision = (this.scenarioRevisionRows.get(id) ?? []).find((item) => item.id === revisionId);
    if (!current || !revision) return null;
    const rolledBack = { ...revision.scenario, id, version: current.version + 1, ownerId: current.ownerId ?? null, reviewStatus: "draft", reviewedBy: null, reviewedAt: null };
    this.scenarioRows.set(id, rolledBack);
    const revisions = this.scenarioRevisionRows.get(id) ?? [];
    revisions.push({ id: randomUUID3(), scenarioId: id, version: revisions.length + 1, scenario: rolledBack, changedBy: reviewerId, createdAt: reviewedAt });
    this.scenarioRevisionRows.set(id, revisions);
    return rolledBack;
  }
  async entitlement(userId) {
    return [...this.entitlements.values()].filter((item) => item.userId === userId).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null;
  }
  async entitlementByTransactionId(transactionId) {
    return this.entitlements.get(transactionId) ?? null;
  }
  async entitlementByOriginalTransactionId(provider, originalTransactionId) {
    return [...this.entitlements.values()].filter((item) => item.provider === provider && item.originalTransactionId === originalTransactionId).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null;
  }
  async entitlementByPurchaseToken(provider, purchaseToken) {
    return [...this.entitlements.values()].filter((item) => item.provider === provider && item.purchaseToken === purchaseToken).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null;
  }
  async saveEntitlement(entitlement) {
    this.entitlements.set(entitlement.transactionId, entitlement);
  }
  async createPurchaseIntent(intent) {
    this.purchaseIntents.set(intent.id, intent);
  }
  async purchaseIntent(id) {
    return this.purchaseIntents.get(id) ?? null;
  }
  async completePurchaseIntent(id) {
    const intent = this.purchaseIntents.get(id);
    if (intent) intent.status = "completed";
  }
  async createVoiceSession(session) {
    this.voiceSessions.set(session.id, session);
  }
  async voiceSession(userId, id) {
    const session = this.voiceSessions.get(id);
    return session?.userId === userId ? session : null;
  }
  async bindVoiceProviderCall(userId, id, providerCallId) {
    const session = await this.voiceSession(userId, id);
    if (!session) throw new Error("Voice session not found");
    if (session.status !== "active") throw new ConflictError("Voice session is already closed.");
    session.providerCallId = providerCallId;
    return session;
  }
  async markVoiceProviderTerminated(id, terminatedAt) {
    const session = this.voiceSessions.get(id);
    if (session) session.providerTerminatedAt = terminatedAt;
  }
  async pendingVoiceProviderCalls() {
    return [...this.voiceSessions.values()].filter((session) => session.status !== "active" && Boolean(session.providerCallId) && !session.providerTerminatedAt);
  }
  async endVoiceSession(userId, id, endedAt, status) {
    const session = await this.voiceSession(userId, id);
    if (!session) throw new Error("Voice session not found");
    if (session.status !== "active") throw new ConflictError("Voice session is already closed.");
    session.status = status;
    session.endedAt = endedAt;
    return session;
  }
  async expireVoiceSessions(now) {
    let expired = 0;
    for (const session of this.voiceSessions.values()) {
      if (session.status !== "active" || session.expiresAt > now) continue;
      session.status = "expired";
      session.endedAt = now;
      const reservation = this.reservations.get(session.reservationId);
      if (reservation) reservation.seconds = reservation.consumedSeconds;
      const conversation = this.conversationRows.get(session.conversationId);
      if (conversation?.state === "ACTIVE") {
        conversation.state = "EXPIRED";
        conversation.updatedAt = now;
      }
      expired += 1;
    }
    return expired;
  }
};

// src/config.ts
function productionConfigurationErrors(config) {
  if (config.nodeEnv !== "production") return [];
  const errors = [];
  const documentationPlaceholder = /(^|[.@])example\.(com|org|net)(?=[:/]|$)/i;
  if (config.devMemoryStore) errors.push("DEV_MEMORY_STORE must be false in production.");
  if (!config.databaseUrl || config.databaseUrl.includes("replace-with-") || documentationPlaceholder.test(config.databaseUrl) || !/^postgres(?:ql)?:\/\//.test(config.databaseUrl)) errors.push("DATABASE_URL must point to the production PostgreSQL database.");
  if (config.corsOrigins.length === 0 || config.corsOrigins.some((origin) => !origin.startsWith("https://") || origin.includes("localhost") || origin.includes("127.0.0.1"))) errors.push("CORS_ORIGINS must contain only HTTPS production origins.");
  if (config.managerEmails.length === 0) errors.push("MANAGER_EMAILS must contain at least one manager account.");
  if (config.managerEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /(^|\.)example\.(com|org|net)$/i.test(email.split("@")[1] ?? ""))) errors.push("MANAGER_EMAILS must contain valid manager email addresses.");
  if (config.googleClientIds?.some((id) => !id.trim() || id.startsWith("replace-with-") || ["android-client-id", "ios-client-id", "web-client-id"].includes(id))) errors.push("GOOGLE_OAUTH_CLIENT_IDS must contain valid production Google client IDs when Google sign-in is enabled.");
  if (config.realtimeEnabled && !config.realtimeApiKey) errors.push("OPENAI_API_KEY is required when OPENAI_REALTIME_ENABLED=true.");
  if (config.billingEnabled) {
    if (!config.billingWebhookSecret || config.billingWebhookSecret.startsWith("replace-with-")) errors.push("BILLING_WEBHOOK_SECRET must be configured when BILLING_ENABLED=true.");
    if (!config.googleNotificationAudience || config.googleNotificationAudience.startsWith("replace-with-") || documentationPlaceholder.test(config.googleNotificationAudience)) errors.push("GOOGLE_PUBSUB_AUDIENCE must be configured for verified Google Pub/Sub pushes.");
    if (!config.billingProductMap) errors.push("BILLING_PRODUCT_MAP must be configured when BILLING_ENABLED=true.");
    if (!config.storeVerifierConfigured) errors.push("Apple and Google store verifier credentials must be configured when BILLING_ENABLED=true.");
  }
  return errors;
}

// src/store-verifier.ts
import { readFileSync } from "node:fs";
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from "@apple/app-store-server-library";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
function appleEnvironment(environment) {
  return environment === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}
function normalizedPrivateKey(value) {
  return value.replace(/\\n/g, "\n");
}
function entitlementStatus(expiresAt, revoked, now) {
  if (revoked) return "revoked";
  if (expiresAt && expiresAt <= now) return "expired";
  return "active";
}
function dateFromMilliseconds(value) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}
function appleConfigFromEnv(env2) {
  const appleRootPaths = (env2.APPLE_ROOT_CERT_PATHS ?? "").split(",").map((path) => path.trim()).filter(Boolean);
  const appleConfigured = Boolean(env2.APPLE_PRIVATE_KEY && env2.APPLE_KEY_ID && env2.APPLE_ISSUER_ID && env2.APPLE_BUNDLE_ID && appleRootPaths.length > 0);
  return appleConfigured ? { privateKey: env2.APPLE_PRIVATE_KEY, keyId: env2.APPLE_KEY_ID, issuerId: env2.APPLE_ISSUER_ID, bundleId: env2.APPLE_BUNDLE_ID, rootCertificates: appleRootPaths.map((path) => readFileSync(path)), appAppleId: env2.APPLE_APPLE_ID ? Number(env2.APPLE_APPLE_ID) : void 0, environment: env2.APPLE_ENVIRONMENT === "sandbox" ? "sandbox" : "production" } : void 0;
}
function createAppleNotificationVerifier(config, now = () => /* @__PURE__ */ new Date()) {
  const verifier = new SignedDataVerifier(config.rootCertificates, true, appleEnvironment(config.environment), config.bundleId, config.appAppleId);
  return async (signedPayload) => {
    const payload = await verifier.verifyAndDecodeNotification(signedPayload);
    const data = payload.data;
    if (!payload.notificationUUID || !data?.signedTransactionInfo) return null;
    const transaction = await verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    if (!transaction.transactionId || !transaction.originalTransactionId || !transaction.productId || transaction.bundleId !== config.bundleId) return null;
    const expiresAt = dateFromMilliseconds(transaction.expiresDate);
    const revoked = transaction.revocationDate !== void 0 || payload.notificationType === "REFUND" || payload.notificationType === "REVOKE";
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
      providerEventDate: dateFromMilliseconds(payload.signedDate ?? transaction.signedDate)
    };
  };
}
function createStorePurchaseVerifier(config) {
  const now = config.now ?? (() => /* @__PURE__ */ new Date());
  const appleClient = config.apple ? new AppStoreServerAPIClient(normalizedPrivateKey(config.apple.privateKey), config.apple.keyId, config.apple.issuerId, config.apple.bundleId, appleEnvironment(config.apple.environment)) : null;
  const appleVerifier = config.apple ? new SignedDataVerifier(config.apple.rootCertificates, true, appleEnvironment(config.apple.environment), config.apple.bundleId, config.apple.appAppleId) : null;
  const googleAuth = config.google ? new GoogleAuth({ credentials: { client_email: config.google.serviceAccountEmail, private_key: normalizedPrivateKey(config.google.privateKey) }, scopes: ["https://www.googleapis.com/auth/androidpublisher"] }) : null;
  return async (input) => {
    if (input.provider === "apple") {
      if (!appleClient || !appleVerifier) return null;
      const response2 = await appleClient.getTransactionInfo(input.transactionId);
      if (!response2.signedTransactionInfo) return null;
      const transaction = await appleVerifier.verifyAndDecodeTransaction(response2.signedTransactionInfo);
      if (transaction.transactionId !== input.transactionId || transaction.productId !== input.productId || transaction.bundleId !== config.apple?.bundleId) return null;
      const expiresAt2 = dateFromMilliseconds(transaction.expiresDate);
      return { productId: transaction.productId, transactionId: transaction.transactionId, originalTransactionId: transaction.originalTransactionId ?? null, purchaseToken: input.purchaseToken, status: entitlementStatus(expiresAt2, transaction.revocationDate !== void 0, now()), environment: transaction.environment === Environment.SANDBOX ? "sandbox" : "production", expiresAt: expiresAt2, providerEventDate: dateFromMilliseconds(transaction.signedDate) };
    }
    if (!googleAuth || !config.google) return null;
    const client = await googleAuth.getClient();
    const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.google.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`;
    const response = await fetch(endpoint, { headers: await client.getRequestHeaders(endpoint) });
    if (!response.ok) return null;
    const purchase = await response.json();
    const lineItem = purchase.lineItems?.find((item) => item.productId === input.productId);
    if (!lineItem?.productId) return null;
    const expiresAt = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const state = purchase.subscriptionState ?? "";
    const activeState = state === "SUBSCRIPTION_STATE_ACTIVE" || state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" || state === "SUBSCRIPTION_STATE_CANCELED";
    const status = activeState ? entitlementStatus(expiresAt, false, now()) : "revoked";
    return { productId: lineItem.productId, transactionId: input.transactionId, originalTransactionId: input.purchaseToken, purchaseToken: input.purchaseToken, status, environment: purchase.testPurchase ? "sandbox" : "production", expiresAt, providerEventDate: null };
  };
}
function createStorePurchaseVerifierFromEnv(env2) {
  const apple = appleConfigFromEnv(env2);
  const googleConfigured = env2.GOOGLE_PLAY_PACKAGE_NAME && env2.GOOGLE_SERVICE_ACCOUNT_EMAIL && env2.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!apple && !googleConfigured) return void 0;
  return createStorePurchaseVerifier({
    apple,
    google: googleConfigured ? { packageName: env2.GOOGLE_PLAY_PACKAGE_NAME, serviceAccountEmail: env2.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: env2.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY } : void 0
  });
}
function createAppleNotificationVerifierFromEnv(env2) {
  const apple = appleConfigFromEnv(env2);
  return apple ? createAppleNotificationVerifier(apple) : void 0;
}
function createGooglePubSubAuthenticator(audience) {
  const client = new OAuth2Client();
  return async (authorization) => {
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
function createGooglePubSubAuthenticatorFromEnv(env2) {
  return env2.GOOGLE_PUBSUB_AUDIENCE ? createGooglePubSubAuthenticator(env2.GOOGLE_PUBSUB_AUDIENCE) : void 0;
}

// src/runtime.ts
process.env.DATABASE_URL ??= process.env.Communicatio_Caoch_DATABASE_URL;
var env = z2.object({ DATABASE_URL: z2.string().url().optional(), DEV_MEMORY_STORE: z2.coerce.boolean().default(false), NODE_ENV: z2.string().default("development"), CORS_ORIGINS: z2.string().default("http://localhost:3000,http://localhost:8081"), MANAGER_EMAILS: z2.string().default(""), GOOGLE_OAUTH_CLIENT_IDS: z2.string().default(""), OPENAI_REALTIME_ENABLED: z2.coerce.boolean().default(false), OPENAI_API_KEY: z2.string().optional(), BILLING_ENABLED: z2.coerce.boolean().default(false), BILLING_WEBHOOK_SECRET: z2.string().optional(), GOOGLE_PUBSUB_WEBHOOK_SECRET: z2.string().optional(), GOOGLE_PUBSUB_AUDIENCE: z2.string().url().optional(), BILLING_PRODUCT_MAP: z2.string().optional(), APPLE_PRIVATE_KEY: z2.string().optional(), APPLE_KEY_ID: z2.string().optional(), APPLE_ISSUER_ID: z2.string().optional(), APPLE_BUNDLE_ID: z2.string().optional(), APPLE_ROOT_CERT_PATHS: z2.string().optional(), GOOGLE_PLAY_PACKAGE_NAME: z2.string().optional(), GOOGLE_SERVICE_ACCOUNT_EMAIL: z2.string().optional(), GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z2.string().optional() }).parse(process.env);
if (!env.DEV_MEMORY_STORE && !env.DATABASE_URL) throw new Error("DATABASE_URL is required unless DEV_MEMORY_STORE=true");
var appleAppIdConfigured = process.env.APPLE_ENVIRONMENT === "sandbox" || Boolean(process.env.APPLE_APPLE_ID);
var storeVerifierConfigured = Boolean(env.APPLE_PRIVATE_KEY && env.APPLE_KEY_ID && env.APPLE_ISSUER_ID && env.APPLE_BUNDLE_ID && env.APPLE_ROOT_CERT_PATHS && appleAppIdConfigured && env.GOOGLE_PLAY_PACKAGE_NAME && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
var googleClientIds = env.GOOGLE_OAUTH_CLIENT_IDS.split(",").map((clientId) => clientId.trim()).filter(Boolean);
var productionErrors = productionConfigurationErrors({ nodeEnv: env.NODE_ENV, databaseUrl: env.DATABASE_URL, devMemoryStore: env.DEV_MEMORY_STORE, corsOrigins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean), managerEmails: env.MANAGER_EMAILS.split(",").map((email) => email.trim()).filter(Boolean), googleClientIds, realtimeEnabled: env.OPENAI_REALTIME_ENABLED, realtimeApiKey: env.OPENAI_API_KEY, billingEnabled: env.BILLING_ENABLED, billingWebhookSecret: env.BILLING_WEBHOOK_SECRET, googleNotificationAudience: env.GOOGLE_PUBSUB_AUDIENCE, billingProductMap: env.BILLING_PRODUCT_MAP, storeVerifierConfigured });
if (productionErrors.length > 0) throw new Error(`Production configuration is invalid:
- ${productionErrors.join("\n- ")}`);
var storePurchaseVerifier = createStorePurchaseVerifierFromEnv(process.env);
var appleNotificationVerifier = createAppleNotificationVerifierFromEnv(process.env);
var googlePubSubAuthenticator = createGooglePubSubAuthenticatorFromEnv(process.env);
var database = env.DEV_MEMORY_STORE ? null : new PrismaClient2();
var store = env.DEV_MEMORY_STORE ? new MemoryStore() : prismaStore(database);
var app = await buildApp(store, { logger: true, origins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()), oauth: { googleClientIds }, billing: { enabled: env.BILLING_ENABLED, webhookSecret: env.BILLING_WEBHOOK_SECRET, googleNotificationSecret: env.GOOGLE_PUBSUB_WEBHOOK_SECRET, verifyGoogleNotificationRequest: googlePubSubAuthenticator, verifyPurchase: storePurchaseVerifier, verifyAppleNotification: appleNotificationVerifier } });

// src/vercel-handler.ts
async function handler(request, response) {
  await app.ready();
  const requestUrl = new URL(request.url ?? "/", "http://vercel.local");
  const originalPath = requestUrl.searchParams.get("__route");
  if (originalPath !== null) {
    requestUrl.searchParams.delete("__route");
    request.url = `/${originalPath}${requestUrl.search}`;
  } else {
    request.url = requestUrl.pathname.replace(/^\/api(?=\/|$)/, "") + requestUrl.search;
  }
  app.server.emit("request", request, response);
}
export {
  app,
  database,
  handler as default
};

