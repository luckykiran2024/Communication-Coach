// src/runtime.ts
import { PrismaClient as PrismaClient2 } from "@prisma/client";

// src/runtime-env.ts
import { z as z2 } from "zod";

// src/billing-configuration.ts
import { z } from "zod";
var billingProvidersSchema = z.enum(["google", "apple", "google,apple", "apple,google"]).default("google,apple").transform((value) => value.split(","));
function storeCredentialsConfigured(env2, providers) {
  const apple = Boolean(env2.APPLE_PRIVATE_KEY && env2.APPLE_KEY_ID && env2.APPLE_ISSUER_ID && env2.APPLE_BUNDLE_ID && env2.APPLE_ROOT_CERT_PATHS && (env2.APPLE_ENVIRONMENT === "sandbox" || env2.APPLE_APPLE_ID));
  const google = Boolean(env2.GOOGLE_PLAY_PACKAGE_NAME && env2.GOOGLE_SERVICE_ACCOUNT_EMAIL && env2.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  return providers.length > 0 && providers.every((provider) => provider === "apple" ? apple : google);
}

// src/runtime-env.ts
var environmentBoolean = z2.enum(["true", "false"]).default("false").transform((value) => value === "true");
var runtimeEnvironmentSchema = z2.object({
  DATABASE_URL: z2.string().url().optional(),
  DEV_MEMORY_STORE: environmentBoolean,
  NODE_ENV: z2.string().default("development"),
  RUNTIME: z2.enum(["server", "serverless"]).default("serverless"),
  VERCEL: z2.string().optional(),
  CRON_SECRET: z2.string().optional(),
  CORS_ORIGINS: z2.string().default("http://localhost:3000,http://localhost:8081"),
  MANAGER_EMAILS: z2.string().default(""),
  GOOGLE_OAUTH_CLIENT_IDS: z2.string().default(""),
  MICROSOFT_OAUTH_CLIENT_IDS: z2.string().default(""),
  SUPABASE_OAUTH_ENABLED: environmentBoolean,
  ASSESSMENT_ENABLED: environmentBoolean,
  ASSESSMENT_DAILY_LIMIT: z2.coerce.number().int().min(1).max(100).default(10),
  ASSESSMENT_MODEL: z2.string().trim().min(1).default("gpt-5-mini"),
  ASSESSMENT_INPUT_MICROS_PER_MILLION: z2.string().regex(/^\d+$/).transform(Number).pipe(z2.number().int().nonnegative()).optional(),
  ASSESSMENT_OUTPUT_MICROS_PER_MILLION: z2.string().regex(/^\d+$/).transform(Number).pipe(z2.number().int().nonnegative()).optional(),
  SUPABASE_URL: z2.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z2.string().optional(),
  OPENAI_REALTIME_ENABLED: environmentBoolean,
  OPENAI_API_KEY: z2.string().optional(),
  BILLING_ENABLED: environmentBoolean,
  BILLING_PROVIDERS: billingProvidersSchema,
  BILLING_WEBHOOK_SECRET: z2.string().optional(),
  GOOGLE_PUBSUB_WEBHOOK_SECRET: z2.string().optional(),
  GOOGLE_PUBSUB_AUDIENCE: z2.string().url().optional(),
  BILLING_PRODUCT_MAP: z2.string().optional(),
  APPLE_PRIVATE_KEY: z2.string().optional(),
  APPLE_KEY_ID: z2.string().optional(),
  APPLE_ISSUER_ID: z2.string().optional(),
  APPLE_BUNDLE_ID: z2.string().optional(),
  APPLE_ROOT_CERT_PATHS: z2.string().optional(),
  GOOGLE_PLAY_PACKAGE_NAME: z2.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z2.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z2.string().optional()
});

// src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

// src/store.ts
var ConflictError = class extends Error {
};

// src/lib/errors.ts
var ApiError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
  statusCode;
};

// src/lib/create-route-dependencies.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import { plansSchema, scenarios } from "@coach/core";

// config/plans.json
var plans_default = [
  {
    id: "free",
    title: "Free",
    targetPriceInr: 0,
    voiceSessionsPerMonth: 2,
    maxSessionSeconds: 420,
    modules: [
      "daily"
    ]
  },
  {
    id: "essential",
    title: "Essential",
    targetPriceInr: 299,
    voiceSessionsPerMonth: 15,
    maxSessionSeconds: 420,
    modules: [
      "daily"
    ]
  },
  {
    id: "professional",
    title: "Professional",
    targetPriceInr: 399,
    voiceSessionsPerMonth: 20,
    maxSessionSeconds: 420,
    modules: [
      "daily",
      "management"
    ]
  },
  {
    id: "executive",
    title: "Executive",
    targetPriceInr: 699,
    voiceSessionsPerMonth: 40,
    maxSessionSeconds: 420,
    modules: [
      "daily",
      "management",
      "leadership"
    ]
  },
  {
    id: "extended",
    title: "Extended",
    targetPriceInr: 799,
    voiceSessionsPerMonth: 60,
    maxSessionSeconds: 420,
    modules: [
      "daily",
      "management",
      "leadership"
    ]
  }
];

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
    const response = await (this.input.fetchImpl ?? fetch)(
      `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(providerCallId)}/hangup`,
      {
        method: "POST",
        signal: AbortSignal.timeout(1e4),
        redirect: "error",
        headers: { Authorization: `Bearer ${this.input.apiKey}`, "OpenAI-Safety-Identifier": providerCallId }
      }
    );
    if (!response.ok) throw new Error("Realtime provider did not terminate the call.");
  }
};

// src/lib/progress.ts
import { assessCommunicationEvidence, getMasteryLevel } from "@coach/core";

// src/lib/time.ts
function dayKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
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
function elapsedSeconds(startedAt, endedAt, maximumSeconds) {
  return Math.min(maximumSeconds, Math.max(0, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 1e3)));
}
function monthKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}
function nextMonthReset(date, timezone) {
  const currentMonth = monthKey(date, timezone);
  let low = date.getTime();
  let high = low + 32 * 24 * 60 * 6e4;
  while (monthKey(new Date(high), timezone) === currentMonth) high += 24 * 60 * 6e4;
  while (high - low > 6e4) {
    const midpoint = Math.floor((low + high) / 12e4) * 6e4;
    if (monthKey(new Date(midpoint), timezone) === currentMonth) low = midpoint;
    else high = midpoint;
  }
  return new Date(high).toISOString();
}

// src/lib/progress.ts
var completedStates = /* @__PURE__ */ new Set(["COMPLETED", "ASSESSING", "FEEDBACK_READY"]);
function learnerEvidence(turns) {
  const primary = turns.find((turn) => turn.role === "user" && turn.phase === "primary");
  const retry = [...turns].reverse().find((turn) => turn.role === "user" && turn.phase === "independent_retry");
  return primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
}
async function learnerScenarioProgress(store2, userId, profile, assessmentEnabled = false) {
  if (!profile) {
    return {
      mastery: getMasteryLevel({ practiceDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 }),
      completedScenarioIds: []
    };
  }
  const records = await store2.learningRecords(userId);
  const completedRecords = records.filter((record) => completedStates.has(record.conversation.state));
  const completed = completedRecords.map((record) => record.conversation);
  const evidenceRows = completedRecords.map((record) => recordEvidence(record, assessmentEnabled));
  const assessments = evidenceRows.filter((assessment) => assessment !== null);
  const practiceDays = new Set(learnerActivityDates(completedRecords).map((date) => dayKey(date, profile.timezone))).size;
  const completedScenarioIds = [...new Set(completed.map((conversation) => conversation.scenarioId))];
  return {
    mastery: getMasteryLevel({
      practiceDays,
      completedScenarios: completedScenarioIds.length,
      successfulRetries: assessments.filter((assessment) => assessment.passed).length,
      evidenceAssessments: assessments.length
    }),
    completedScenarioIds
  };
}
function learnerActivityDates(records, now) {
  return records.flatMap((record) => record.turns.filter((turn) => turn.role === "user" && turn.text.trim().length > 0 && (!now || turn.createdAt <= now)).map((turn) => turn.createdAt));
}
function recordEvidence(record, assessmentEnabled) {
  if (!assessmentEnabled) return learnerEvidence(record.turns);
  return record.assessment && record.conversation.state === "FEEDBACK_READY" ? { passed: record.assessment.transferResult === "demonstrated", score: null } : null;
}

// src/email-sender.ts
var ConsoleEmailSender = class {
  constructor(log = console.info) {
    this.log = log;
  }
  log;
  async send(message) {
    if (process.env.NODE_ENV === "production") throw new Error("Console email is disabled in production");
    this.log(`[development email] ${message.purpose}: ${message.link}`);
  }
};
var ResendEmailSender = class {
  constructor(apiKey, from, fetchImpl = fetch) {
    this.apiKey = apiKey;
    this.from = from;
    this.fetchImpl = fetchImpl;
  }
  apiKey;
  from;
  fetchImpl;
  async send(message) {
    const verification = message.purpose === "verify_email";
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: verification ? "Verify your Communication Coach email" : "Reset your Communication Coach password",
        text: [
          verification ? "Confirm your email in Communication Coach." : "Choose a new password in Communication Coach.",
          message.link,
          `Or paste this code into the app: ${message.token}`,
          "This single-use link expires in 30 minutes. Ignore this email if you did not request it."
        ].join("\n\n")
      }),
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) throw new Error("Account email delivery failed");
  }
};
function createEmailSender(env2 = process.env) {
  if (env2.EMAIL_PROVIDER === "resend" && env2.RESEND_API_KEY && env2.EMAIL_FROM) {
    if (env2.RESEND_API_KEY.startsWith("replace-with-") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env2.EMAIL_FROM)) return null;
    return new ResendEmailSender(env2.RESEND_API_KEY, env2.EMAIL_FROM);
  }
  if (env2.NODE_ENV !== "production" && (!env2.EMAIL_PROVIDER || env2.EMAIL_PROVIDER === "console")) {
    return new ConsoleEmailSender();
  }
  return null;
}

// src/assessment-provider.ts
import {
  assessmentInstructions,
  assessmentJsonSchema,
  assessmentRubrics,
  coachingAreaLabels
} from "@coach/core";
function providerSchema(value) {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).filter(([key]) => key !== "$schema").map(([key, child]) => key === "const" ? ["enum", [child]] : [key, providerSchema(child)]);
  return Object.fromEntries(entries);
}
var OpenAIAssessmentProvider = class {
  constructor(options) {
    this.options = options;
  }
  options;
  async assess(input) {
    const rubric = assessmentRubrics[input.scenario.module];
    const response = await (this.options.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST",
      redirect: "error",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        ...input.requestId ? { "X-Client-Request-Id": input.requestId } : {}
      },
      body: JSON.stringify({
        model: input.model,
        store: false,
        max_output_tokens: 4e3,
        instructions: assessmentInstructions,
        input: JSON.stringify({
          scenario: input.scenario,
          rubric,
          coachingAreas: coachingAreaLabels,
          modelVersion: input.model,
          rubricVersion: rubric.version,
          turns: input.turns.filter((turn) => turn.role === "user").map(({ id, phase, text: text2 }) => ({ id, phase, text: text2 }))
        }),
        text: { format: {
          type: "json_schema",
          name: "communication_feedback",
          strict: true,
          schema: providerSchema(assessmentJsonSchema)
        } }
      })
    });
    if (!response.ok) throw new Error("Assessment provider unavailable");
    const data = await response.json();
    const inputTokens = data.usage?.input_tokens;
    const outputTokens = data.usage?.output_tokens;
    if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens) || inputTokens < 0 || outputTokens < 0) throw new Error("Assessment usage missing");
    const text = data.status === "completed" ? data.output?.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("") : "";
    const { inputMicrosPerMillion, outputMicrosPerMillion } = this.options;
    const costMicros = inputMicrosPerMillion === void 0 || outputMicrosPerMillion === void 0 ? null : Math.ceil((inputTokens * inputMicrosPerMillion + outputTokens * outputMicrosPerMillion) / 1e6);
    return {
      value: text,
      inputTokens,
      outputTokens,
      costMicros,
      providerRequestId: response.headers.get("x-request-id"),
      providerResponseId: data.id ?? null
    };
  }
};

// src/lib/create-route-dependencies.ts
function billingProductMap(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
async function createRouteDependencies(store2, options) {
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const assessmentEnabled = options.assessment?.enabled ?? process.env.ASSESSMENT_ENABLED === "true";
  const assessmentKey = options.assessment?.apiKey ?? process.env.OPENAI_API_KEY;
  const assessmentModel = options.assessment?.model ?? process.env.ASSESSMENT_MODEL ?? "gpt-5-mini";
  const assessmentProvider = !assessmentEnabled ? null : options.assessment?.provider ?? (assessmentKey ? new OpenAIAssessmentProvider({
    apiKey: assessmentKey,
    inputMicrosPerMillion: options.assessment?.inputMicrosPerMillion,
    outputMicrosPerMillion: options.assessment?.outputMicrosPerMillion
  }) : null);
  const plans = plansSchema.parse(plans_default);
  const freePlan = plans.find((plan) => plan.id === "free");
  const dummyHash = await hashPassword(randomBytes2(32).toString("hex"));
  const availableScenarios = async () => [...scenarios, ...await store2.customScenarios()];
  const configuredManagerKey = process.env.MANAGER_SCENARIO_KEY ?? (process.env.NODE_ENV === "production" ? "" : "development-manager-key");
  const configuredManagerEmails = new Set(
    (options.managerEmails ?? (process.env.MANAGER_EMAILS ?? "").split(",")).map((email) => email.trim().toLowerCase()).filter(Boolean)
  );
  const billingEnabled = options.billing?.enabled ?? process.env.BILLING_ENABLED === "true";
  const billingWebhookSecret = options.billing?.webhookSecret ?? process.env.BILLING_WEBHOOK_SECRET ?? "";
  const googleNotificationSecret = options.billing?.googleNotificationSecret ?? process.env.GOOGLE_PUBSUB_WEBHOOK_SECRET ?? billingWebhookSecret;
  const configuredBillingProductMap = options.billing?.productMap ?? billingProductMap(process.env.BILLING_PRODUCT_MAP);
  const realtimeEnabled = options.voice?.enabled ?? process.env.OPENAI_REALTIME_ENABLED === "true";
  const realtimeApiKey = options.voice?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const realtimeConfigured = realtimeEnabled && realtimeApiKey.length > 0;
  const realtimeModel = options.voice?.model ?? process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1-mini";
  const realtimeProvider = realtimeConfigured ? new RealtimeVoiceProvider({
    apiKey: realtimeApiKey,
    model: realtimeModel,
    voice: options.voice?.voice ?? process.env.OPENAI_REALTIME_VOICE ?? "marin",
    fetchImpl: options.voice?.fetchImpl
  }) : null;
  function planForProduct(productId) {
    const configuredPlanId = configuredBillingProductMap[productId];
    const plan = plans.find((item) => item.id === configuredPlanId);
    if (plan) return plan;
    if (process.env.NODE_ENV === "production") return void 0;
    return plans.find((item) => productId.endsWith(`.${item.id}.monthly`) || productId.endsWith(`.${item.id}`));
  }
  async function activePlan(userId) {
    if (!billingEnabled) {
      const isolatedTest = process.env.COACH_TEST_BACKEND === "true" && process.env.VERCEL_PROJECT_ID === "prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf" && !assessmentEnabled && !realtimeEnabled;
      if ((process.env.NODE_ENV === "production" || process.env.VERCEL === "1") && !isolatedTest) return freePlan;
      const devPlanId = options.devPlanId ?? process.env.DEV_PLAN_ID ?? "executive";
      return plans.find((plan) => plan.id === devPlanId) ?? freePlan;
    }
    const entitlement = await store2.entitlement(userId);
    if (!entitlement || entitlement.status !== "active" || entitlement.expiresAt && entitlement.expiresAt <= now()) return freePlan;
    return planForProduct(entitlement.productId) ?? freePlan;
  }
  async function reapVoiceSessions() {
    await store2.expireAssessmentRuns(now());
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
  return {
    store: store2,
    now,
    plans,
    dummyHash,
    emailSender: options.email ? options.email.sender : createEmailSender(),
    emailLinkBaseUrl: options.email?.linkBaseUrl ?? process.env.ACCOUNT_EMAIL_LINK_BASE_URL ?? "communicationcoach://",
    availableScenarios,
    configuredManagerKey,
    configuredManagerEmails,
    oauth: options.oauth,
    billing: options.billing,
    billingEnabled,
    billingProviders: options.billing?.providers ?? billingProvidersSchema.parse(process.env.BILLING_PROVIDERS),
    billingWebhookSecret,
    googleNotificationSecret,
    billingProductMap: configuredBillingProductMap,
    realtimeProvider,
    realtimeConfigured,
    realtimeModel,
    assessmentEnabled,
    assessmentProvider,
    assessmentModel,
    assessmentTimeoutMs: Math.min(3e4, Math.max(1, options.assessment?.timeoutMs ?? 3e4)),
    assessmentDailyLimit: options.assessment?.dailyLimit ?? Number(process.env.ASSESSMENT_DAILY_LIMIT ?? 10),
    reapVoiceSessions,
    activePlan,
    planForProduct,
    learnerScenarioProgress: (userId, profile) => learnerScenarioProgress(store2, userId, profile, assessmentEnabled)
  };
}

// src/routes/health.ts
import { modules } from "@coach/core";
function register(app2, deps) {
  app2.get("/health", async () => ({ status: "ok", version: "0.1.0" }));
  app2.get("/ready", async (_request, reply) => {
    try {
      await deps.store.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
  app2.get("/v1/catalog", async () => ({
    modules,
    plans: deps.plans,
    priceNotice: "Proposed monthly INR prices. Store pricing and purchases are not configured.",
    liveVoiceAvailable: false
  }));
}

// src/routes/billing.ts
import { randomBytes as randomBytes4, randomUUID } from "node:crypto";
import { z as z3 } from "zod";

// src/lib/auth-context.ts
import { createHash as createHash2, randomBytes as randomBytes3 } from "node:crypto";

// src/lib/safe-equal.ts
import { createHash, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
function safeEqual(actual, expected) {
  if (typeof actual !== "string" || !expected || !actual) return false;
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual2(actualDigest, expectedDigest);
}

// src/lib/oauth.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
var microsoftKeys = createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));
var uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function microsoftIdentity(token, options, now) {
  if (!options?.microsoftClientIds?.length) {
    throw new ApiError(503, "Microsoft sign-in is not configured for this deployment.");
  }
  try {
    const { payload } = await jwtVerify(token, options.microsoftJwks ?? microsoftKeys, {
      audience: options.microsoftClientIds,
      algorithms: ["RS256"],
      currentDate: now,
      requiredClaims: ["exp", "iat", "iss", "aud", "oid", "tid", "sub"]
    });
    const { tid, oid, email } = payload;
    if (typeof tid !== "string" || typeof oid !== "string" || !uuidPattern.test(tid) || !uuidPattern.test(oid)) {
      throw new Error("Missing stable Microsoft identity");
    }
    if (payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new Error("Invalid Microsoft issuer");
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email required");
    return { email: email.trim().toLowerCase(), subject: `${tid}:${oid}`, emailVerified: false };
  } catch {
    throw new ApiError(401, "The Microsoft ID token is invalid or expired.");
  }
}

// src/lib/auth-context.ts
var digest = (value) => createHash2("sha256").update(value).digest("hex");
async function authenticate(request, deps) {
  const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw new ApiError(401, "Sign in to continue.");
  const tokenHash = digest(token);
  const session = await deps.store.sessionByHash(tokenHash);
  if (!session || session.expiresAt <= deps.now()) throw new ApiError(401, "Your session has expired. Please sign in.");
  const user = await deps.store.accountById(session.userId);
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return { user, tokenHash };
}
async function issueSession(user, deps) {
  const token = randomBytes3(32).toString("hex");
  const expiresAt = new Date(deps.now().getTime() + 7 * 864e5);
  await deps.store.createSession({ tokenHash: digest(token), userId: user.id, expiresAt }, user.passwordHash);
  return { token, expiresAt: expiresAt.toISOString(), user: publicAccount(user) };
}
function publicAccount(user) {
  return { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null };
}
async function requireManager(request, deps) {
  if (process.env.NODE_ENV !== "production" && safeEqual(request.headers["x-manager-key"], deps.configuredManagerKey)) {
    return { userId: null };
  }
  const { user } = await authenticate(request, deps);
  const verifiedManagerEmail = Boolean(user.emailVerifiedAt) && deps.configuredManagerEmails.has(user.email);
  if (user.role !== "manager" && !verifiedManagerEmail) throw new ApiError(403, "Manager access is required.");
  return { userId: user.id };
}
async function verifiedOAuthIdentity(provider, accessToken, deps) {
  if (provider === "microsoft") return microsoftIdentity(accessToken, deps.oauth, deps.now());
  if (!deps.oauth?.googleClientIds?.length) throw new ApiError(503, "Google sign-in is not configured for this deployment.");
  const response = await (deps.oauth?.fetchImpl ?? fetch)(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(1e4) }
  );
  if (!response.ok) throw new ApiError(401, "The provider sign-in token is invalid or expired.");
  const data = await response.json();
  const email = (data.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(401, "The provider did not return a valid email address.");
  }
  const subject = data.sub?.trim() ?? "";
  if (!subject) throw new ApiError(401, "The provider did not return a stable account identifier.");
  if (data.email_verified !== true && data.email_verified !== "true") throw new ApiError(401, "The Google email is not verified.");
  const audiences = data.aud ? Array.isArray(data.aud) ? data.aud : [data.aud] : [];
  if (!audiences.some((audience) => deps.oauth.googleClientIds.includes(audience))) {
    throw new ApiError(401, "The Google sign-in token was issued for an unrecognized application.");
  }
  return { email, subject, emailVerified: true };
}

// src/routes/billing.ts
var billingWebhookSchema = z3.object({
  purchaseIntentId: z3.string().uuid(),
  productId: z3.string().min(1).max(200),
  transactionId: z3.string().min(1).max(300),
  originalTransactionId: z3.string().min(1).max(300).optional(),
  purchaseToken: z3.string().min(1).max(5e4).optional(),
  status: z3.enum(["active", "expired", "revoked"]),
  environment: z3.enum(["sandbox", "production"]),
  expiresAt: z3.string().datetime().nullable().optional()
}).strict();
var billingPurchaseSchema = z3.object({
  purchaseIntentId: z3.string().uuid(),
  provider: z3.enum(["apple", "google"]),
  productId: z3.string().min(1).max(200),
  transactionId: z3.string().min(1).max(300),
  purchaseToken: z3.string().min(1).max(5e4)
}).strict();
var appleNotificationSchema = z3.object({ signedPayload: z3.string().min(1).max(1e5) }).strict();
var googlePubSubSchema = z3.object({
  message: z3.object({ data: z3.string().min(1).max(1e5), messageId: z3.string().min(1).max(200).optional() }).strict(),
  subscription: z3.string().min(1).max(500).optional()
}).strict();
var googleSubscriptionNotificationSchema = z3.object({
  packageName: z3.string().min(1).max(300),
  eventTimeMillis: z3.string().regex(/^\d+$/),
  subscriptionNotification: z3.object({
    purchaseToken: z3.string().min(1).max(5e4),
    subscriptionId: z3.string().min(1).max(200),
    notificationType: z3.number().int().min(1).max(20)
  }).strict().optional()
}).strict();
var purchaseIntentSchema = z3.object({ provider: z3.enum(["apple", "google"]), productId: z3.string().min(1).max(200) }).strict();
function register2(app2, deps) {
  app2.get("/v1/me/entitlement", async (request) => {
    const { user } = await authenticate(request, deps);
    return { entitlement: await deps.store.entitlement(user.id) };
  });
  app2.post("/v1/billing/intents", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (!deps.billingEnabled || !deps.billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const parsed = purchaseIntentSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid Apple or Google product.");
    if (!deps.billingProviders.includes(parsed.data.provider)) throw new ApiError(503, "This store is not enabled yet.");
    const plan = deps.planForProduct(parsed.data.productId);
    if (!plan || plan.id === "free") throw new ApiError(400, "Choose a configured paid subscription product.");
    const timestamp = deps.now();
    const intent = {
      id: randomUUID(),
      userId: user.id,
      provider: parsed.data.provider,
      productId: parsed.data.productId,
      nonce: randomBytes4(24).toString("base64url"),
      status: "pending",
      createdAt: timestamp,
      expiresAt: new Date(timestamp.getTime() + 15 * 6e4)
    };
    await deps.store.createPurchaseIntent(intent);
    return reply.code(201).send({
      intent: {
        id: intent.id,
        provider: intent.provider,
        productId: intent.productId,
        nonce: intent.nonce,
        accountToken: user.id,
        status: intent.status,
        expiresAt: intent.expiresAt.toISOString()
      },
      message: "Use accountToken as the Apple appAccountToken or Google obfuscatedAccountId. The server verifies store ownership."
    });
  });
  app2.post("/v1/billing/webhooks/:provider", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billingWebhookSecret) throw new ApiError(503, "Billing provider is not configured.");
    const provider = request.params.provider;
    if (provider !== "apple" && provider !== "google") throw new ApiError(400, "Choose Apple or Google as the billing provider.");
    if (!deps.billingProviders.includes(provider)) throw new ApiError(503, "This store is not enabled yet.");
    if (!safeEqual(request.headers["x-billing-webhook-secret"], deps.billingWebhookSecret)) {
      throw new ApiError(401, "Billing webhook authentication failed.");
    }
    const parsed = billingWebhookSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid entitlement event.");
    const intent = await deps.store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.status === "cancelled" || intent.status === "pending" && intent.expiresAt <= deps.now()) {
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
    const entitlement = {
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
      updatedAt: timestamp
    };
    const idempotent = Boolean(existing && existing.status === entitlement.status && existing.environment === entitlement.environment && existing.expiresAt?.getTime() === entitlement.expiresAt?.getTime());
    await deps.store.saveEntitlement(entitlement);
    await deps.store.completePurchaseIntent(intent.id);
    return reply.code(existing ? 200 : 201).send({ entitlement, received: true, idempotent });
  });
  app2.post("/v1/billing/purchases/verify", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (!deps.billingEnabled || !deps.billingWebhookSecret || !deps.billing?.verifyPurchase) {
      throw new ApiError(503, "Store purchase verification is not configured.");
    }
    const parsed = billingPurchaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide the store purchase details for verification.");
    if (!deps.billingProviders.includes(parsed.data.provider)) throw new ApiError(503, "This store is not enabled yet.");
    const intent = await deps.store.purchaseIntent(parsed.data.purchaseIntentId);
    if (!intent || intent.userId !== user.id || intent.status === "cancelled" || intent.status === "pending" && intent.expiresAt <= deps.now()) {
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
        purchaseToken: parsed.data.purchaseToken
      });
    } catch {
      throw new ApiError(503, "The store verification service is temporarily unavailable.");
    }
    if (!verified || verified.productId !== intent.productId || parsed.data.provider === "apple" && verified.transactionId !== parsed.data.transactionId || !deps.planForProduct(verified.productId) || !verified.expiresAt || !Number.isFinite(verified.expiresAt.getTime())) {
      throw new ApiError(402, "The store purchase could not be verified.");
    }
    const existing = await deps.store.entitlementByTransactionId(verified.transactionId);
    const byOriginal = verified.originalTransactionId ? await deps.store.entitlementByOriginalTransactionId(parsed.data.provider, verified.originalTransactionId) : null;
    const byToken = await deps.store.entitlementByPurchaseToken(parsed.data.provider, verified.purchaseToken);
    const bindings = [existing, byOriginal, byToken].filter((item) => item !== null);
    if (bindings.some((item) => item.userId !== user.id || item.provider !== parsed.data.provider)) {
      throw new ApiError(409, "The store purchase is already linked to another account.");
    }
    if (verified.accountToken && verified.accountToken !== user.id || !verified.accountToken && !bindings.length) {
      throw new ApiError(402, "This purchase does not prove ownership of the signed-in app account.");
    }
    const timestamp = deps.now();
    const entitlement = {
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
      updatedAt: timestamp
    };
    await deps.store.saveEntitlement(entitlement);
    await deps.store.completePurchaseIntent(intent.id);
    const accessGranted = entitlement.status === "active" && entitlement.expiresAt > timestamp;
    return reply.code(existing ? 200 : 201).send({ entitlement, verified: true, accessGranted });
  });
  app2.post("/v1/billing/notifications/apple", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billingProviders.includes("apple") || !deps.billing?.verifyAppleNotification) {
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
    const entitlement = {
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
      updatedAt: timestamp
    };
    await deps.store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
  app2.post("/v1/billing/notifications/google", async (request, reply) => {
    if (!deps.billingEnabled || !deps.billingProviders.includes("google") || !deps.billing?.verifyPurchase) {
      throw new ApiError(503, "Google notification verification is not configured.");
    }
    const oidcAuthenticated = deps.billing.verifyGoogleNotificationRequest ? await deps.billing.verifyGoogleNotificationRequest(request.headers.authorization) : false;
    const sharedSecretAuthenticated = Boolean(
      safeEqual(request.headers["x-google-pubsub-secret"], deps.googleNotificationSecret)
    );
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
      verified = await deps.billing.verifyPurchase({
        provider: "google",
        productId: event.subscriptionId,
        transactionId: event.purchaseToken,
        purchaseToken: event.purchaseToken
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
    const entitlement = {
      ...existing,
      productId: verified.productId,
      status: verified.status,
      environment: verified.environment,
      expiresAt: verified.expiresAt,
      providerEventDate,
      updatedAt: timestamp
    };
    await deps.store.saveEntitlement(entitlement);
    return reply.send({ received: true, matched: true, idempotent: false, entitlement });
  });
}

// src/routes/scenarios.ts
import { isPublishedScenario, recommendScenarios } from "@coach/core";
function register3(app2, deps) {
  app2.get("/v1/scenarios/library", async () => {
    const catalog = (await deps.availableScenarios()).filter(isPublishedScenario);
    return { scenarios: catalog, count: catalog.length };
  });
  app2.get("/v1/me/scenarios", async (request) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const progress = await deps.learnerScenarioProgress(user.id, profile);
    const includedModules = (await deps.activePlan(user.id)).modules;
    const eligibleScenarios = (await deps.availableScenarios()).filter((scenario) => isPublishedScenario(scenario) && includedModules.includes(scenario.module));
    return {
      scenarios: recommendScenarios(profile, eligibleScenarios, progress.mastery.level, progress.completedScenarioIds),
      mastery: progress.mastery,
      previewOnly: true
    };
  });
}

// src/routes/manager.ts
import { z as z4 } from "zod";
import { scenarioSchema } from "@coach/core";
var reviewScenarioSchema = z4.object({ status: z4.enum(["draft", "published", "deprecated"]) }).strict();
var rollbackScenarioSchema = z4.object({ revisionId: z4.string().uuid() }).strict();
function register4(app2, deps) {
  app2.get("/v1/manager/scenarios", async (request) => {
    await requireManager(request, deps);
    const catalog = await deps.availableScenarios();
    return { scenarios: catalog, count: catalog.length };
  });
  app2.post("/v1/manager/scenarios", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a complete scenario with a valid module, goal, level and prompts.");
    const catalog = await deps.availableScenarios();
    if (catalog.some((scenario2) => scenario2.id === parsed.data.id)) throw new ApiError(409, "A scenario with this id already exists.");
    const scenario = { ...parsed.data, reviewStatus: "draft", ownerId: manager.userId, reviewedBy: null, reviewedAt: null };
    await deps.store.createCustomScenario(scenario);
    return reply.code(201).send({ scenario, message: "Scenario added to the library as a draft for review." });
  });
  app2.post("/v1/manager/scenarios/:id/review", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const id = request.params.id;
    const parsed = reviewScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a scenario and a valid review status.");
    const scenario = await deps.store.reviewCustomScenario(id, parsed.data.status, manager.userId, deps.now());
    if (!scenario) throw new ApiError(404, "Scenario not found.");
    return reply.send({ scenario, message: parsed.data.status === "published" ? "Scenario published for learner practice." : `Scenario marked ${parsed.data.status}.` });
  });
  app2.get("/v1/manager/scenarios/:id/revisions", async (request, reply) => {
    await requireManager(request, deps);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "Choose a scenario.");
    const revisions = await deps.store.scenarioRevisions(id);
    if (revisions.length === 0) throw new ApiError(404, "Scenario not found.");
    return reply.send({ revisions });
  });
  app2.post("/v1/manager/scenarios/:id/rollback", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const id = request.params.id;
    const parsed = rollbackScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a valid scenario revision.");
    const scenario = await deps.store.rollbackCustomScenario(id, parsed.data.revisionId, manager.userId, deps.now());
    if (!scenario) throw new ApiError(404, "Scenario or revision not found.");
    return reply.send({ scenario, message: "Scenario rolled back as a draft. Review and publish it before learner practice." });
  });
}

// src/routes/auth.ts
import { randomBytes as randomBytes5, randomUUID as randomUUID2 } from "node:crypto";
import { credentialsSchema, legalVersion, oauthSchema } from "@coach/core";
import { z as z5 } from "zod";

// src/lib/supabase-oauth.ts
function supabaseOAuthConfigured(options) {
  if (!options?.enabled || !options.url || !options.publishableKey?.startsWith("sb_publishable_")) return false;
  try {
    const url = new URL(options.url);
    return url.protocol === "https:" && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname) && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === "/";
  } catch {
    return false;
  }
}
async function supabaseGoogleIdentity(token, options) {
  if (!supabaseOAuthConfigured(options)) throw new ApiError(503, "Supabase Google sign-in is not configured.");
  let response;
  try {
    response = await (options.fetchImpl ?? fetch)(new URL("/auth/v1/user", options.url), {
      headers: { apikey: options.publishableKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1e4),
      redirect: "error"
    });
  } catch {
    throw new ApiError(503, "Google sign-in is temporarily unavailable. Please try again.");
  }
  if (response.status >= 500 || response.status === 429) {
    throw new ApiError(503, "Google sign-in is temporarily unavailable. Please try again.");
  }
  if (!response.ok) throw new ApiError(401, "The Supabase sign-in session is invalid or expired.");
  const data = await response.json().catch(() => null);
  const identity = Array.isArray(data?.identities) ? data.identities.find((item) => item?.provider === "google" && item.user_id === data.id) : void 0;
  const email = typeof identity?.identity_data?.email === "string" ? identity.identity_data.email.trim().toLowerCase() : "";
  const subject = typeof identity?.identity_data?.sub === "string" ? identity.identity_data.sub.trim() : "";
  if (data?.role !== "authenticated" || !data.id || !subject || subject.length > 255 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || identity?.identity_data?.email_verified !== true) {
    throw new ApiError(401, "Sign in with a verified Google account to continue.");
  }
  return { email, subject, emailVerified: true };
}

// src/routes/auth.ts
var legalFields = { legalAccepted: z5.boolean().optional(), legalVersion: z5.string().max(30).optional() };
var registerSchema = credentialsSchema.extend(legalFields);
var socialSchema = z5.discriminatedUnion("provider", [
  oauthSchema.options[0].extend(legalFields),
  oauthSchema.options[1].extend(legalFields)
]);
var supabaseSchema = z5.object({
  accessToken: z5.string().trim().min(20).max(1e4),
  password: z5.string().min(12).max(128).optional(),
  ...legalFields
}).strict();
function acceptedLegalTerms(input, now) {
  if (input.legalAccepted !== true || input.legalVersion !== legalVersion) {
    throw new ApiError(428, "Accept the current Terms of Service and acknowledge the Privacy Policy to create an account.");
  }
  return { version: legalVersion, acceptedAt: now };
}
function register5(app2, deps) {
  app2.post("/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and a password of 12\u2013128 characters.");
    const acceptance = acceptedLegalTerms(parsed.data, deps.now());
    const user = await deps.store.createAccount(parsed.data.email, await hashPassword(parsed.data.password), acceptance);
    return reply.code(201).send(await issueSession(user, deps));
  });
  app2.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.");
    const user = await deps.store.accountByEmail(parsed.data.email);
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? deps.dummyHash);
    if (!user || !valid) throw new ApiError(401, "Email or password is incorrect.");
    return issueSession(user, deps);
  });
  app2.post("/v1/auth/oauth", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = socialSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose Google or Microsoft and try again.");
    const credential = parsed.data.provider === "google" ? parsed.data.accessToken : parsed.data.idToken;
    const identity = await verifiedOAuthIdentity(parsed.data.provider, credential, deps);
    return signInWithIdentity(parsed.data.provider, identity, deps, void 0, parsed.data);
  });
  app2.post("/v1/auth/supabase", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = supabaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter valid Google sign-in credentials.");
    const identity = await supabaseGoogleIdentity(parsed.data.accessToken, deps.oauth?.supabase);
    return signInWithIdentity("google", identity, deps, parsed.data.password, parsed.data);
  });
  app2.post("/v1/auth/logout", async (request, reply) => {
    const { tokenHash } = await authenticate(request, deps);
    await deps.store.deleteSession(tokenHash);
    return reply.code(204).send();
  });
  app2.post("/v1/auth/logout-all", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    await deps.store.deleteSessions(user.id);
    return reply.code(204).send();
  });
}
async function signInWithIdentity(provider, identity, deps, password, legal) {
  const linked = await deps.store.oauthIdentity(provider, identity.subject);
  const linkedUser = linked ? await deps.store.accountById(linked.userId) : null;
  if (linked && !linkedUser) throw new ApiError(401, "The provider identity is no longer linked to an account.");
  const existing = linkedUser ?? await deps.store.accountByEmail(identity.email);
  if (!linked && existing && !existing.emailVerifiedAt) {
    if (!password) throw new ApiError(409, "Verify this email with your password first, or reset your password.");
    if (!await verifyPassword(password, existing.passwordHash)) throw new ApiError(401, "Email or password is incorrect.");
  }
  if (!linked && existing && !identity.emailVerified) {
    throw new ApiError(409, "Microsoft cannot safely link accounts by email. Sign in using your existing account method.");
  }
  const acceptance = existing ? void 0 : acceptedLegalTerms(legal ?? {}, deps.now());
  const user = existing ?? await deps.store.createAccount(
    identity.email,
    await hashPassword(randomBytes5(32).toString("hex")),
    acceptance
  );
  if (identity.emailVerified && (!existing || !linked && password && !existing.emailVerifiedAt)) {
    user.emailVerifiedAt = (await deps.store.markEmailVerified(user.id, deps.now())).emailVerifiedAt;
  }
  if (!linked) {
    const timestamp = deps.now();
    const oauthIdentity = {
      id: randomUUID2(),
      provider,
      subject: identity.subject,
      userId: user.id,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await deps.store.saveOAuthIdentity(oauthIdentity);
  }
  return issueSession(user, deps);
}

// src/routes/account-security.ts
import { createHash as createHash3, randomBytes as randomBytes6 } from "node:crypto";
import { z as z6 } from "zod";
import { credentialsSchema as credentialsSchema2 } from "@coach/core";
var tokenSchema = z6.string().regex(/^[a-f0-9]{64}$/);
var confirmSchema = z6.object({ token: tokenSchema, password: credentialsSchema2.shape.password }).strict();
var requestSchema = z6.object({ email: credentialsSchema2.shape.email }).strict();
var genericResetResponse = { message: "If this account exists, password reset instructions have been sent." };
var digest2 = (token) => createHash3("sha256").update(token).digest("hex");
var invalidLink = () => new ApiError(400, "This link is invalid, expired or already used. Request a new one.");
async function sendLink(userId, to, purpose, deps) {
  if (!deps.emailSender) throw new ApiError(503, "Account email delivery is not configured.");
  const token = randomBytes6(32).toString("hex");
  const createdAt = deps.now();
  const issued = await deps.store.issueEmailToken({
    tokenHash: digest2(token),
    userId,
    purpose,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 30 * 6e4),
    usedAt: null
  }, 3);
  if (!issued) return false;
  const path = purpose === "verify_email" ? "verify-email" : "password-reset";
  const separator = deps.emailLinkBaseUrl.endsWith("/") ? "" : "/";
  const link = `${deps.emailLinkBaseUrl}${separator}${path}?token=${token}`;
  await deps.emailSender.send({ to, purpose, link, token });
  return true;
}
function register6(app2, deps) {
  app2.post("/v1/auth/verify-email/request", async (request) => {
    const { user } = await authenticate(request, deps);
    if (user.emailVerifiedAt) return { message: "Your email is already verified." };
    try {
      if (!await sendLink(user.id, user.email, "verify_email", deps)) {
        throw new ApiError(429, "You can request three verification emails per hour. Please try later.");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "Unable to send the verification email. Please try later.");
    }
    return { message: "Verification instructions sent. The link expires in 30 minutes." };
  });
  app2.post("/v1/auth/verify-email/confirm", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const { user } = await authenticate(request, deps);
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) throw invalidLink();
    if (!await verifyPassword(parsed.data.password, user.passwordHash)) throw new ApiError(401, "Password is incorrect.");
    const verified = await deps.store.consumeEmailToken(digest2(parsed.data.token), "verify_email", deps.now(), user.id);
    if (!verified) throw invalidLink();
    return { message: "Your email is verified." };
  });
  app2.post("/v1/auth/password-reset/request", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email address.");
    if (!deps.emailSender) throw new ApiError(503, "Account email delivery is not configured.");
    const user = await deps.store.accountByEmail(parsed.data.email);
    if (user) {
      try {
        await sendLink(user.id, user.email, "password_reset", deps);
      } catch {
        request.log.warn("Password reset delivery failed; no account details or tokens logged");
      }
    }
    return genericResetResponse;
  });
  app2.post("/v1/auth/password-reset/confirm", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) throw invalidLink();
    const passwordHash = await hashPassword(parsed.data.password);
    const reset = await deps.store.consumeEmailToken(digest2(parsed.data.token), "password_reset", deps.now(), void 0, passwordHash);
    if (!reset) throw invalidLink();
    return { message: "Password changed. All devices have been signed out. Sign in with your new password." };
  });
}

// src/routes/profile.ts
import { profileSchema } from "@coach/core";
function register7(app2, deps) {
  app2.delete("/v1/me", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    await deps.store.deleteAccount(user.id);
    return reply.code(204).send();
  });
  app2.get("/v1/me", async (request) => {
    const { user } = await authenticate(request, deps);
    return { user: publicAccount(user), profile: await deps.store.profile(user.id) };
  });
  app2.put("/v1/me/profile", async (request) => {
    const { user } = await authenticate(request, deps);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; "));
    }
    await deps.store.saveProfile(user.id, parsed.data);
    return { profile: parsed.data };
  });
}

// src/routes/conversations.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import {
  assessCommunicationEvidence as assessCommunicationEvidence2,
  conversationCreateSchema,
  isPublishedScenario as isPublishedScenario2,
  recommendScenarios as recommendScenarios2,
  userConversationTurnSchema
} from "@coach/core";

// src/assessment-service.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { assessmentRubrics as assessmentRubrics2, coachedAssessmentSchema, validateAssessment } from "@coach/core";
async function assessConversation(input) {
  const run = await input.store.claimAssessmentRun(input.userId, input.conversationId, input.now(), input.dailyLimit ?? 10);
  const controller = new AbortController();
  const deadline = new Promise((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("Assessment timed out")), { once: true });
  });
  void deadline.catch(() => void 0);
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 3e4);
  try {
    for (const attempt of [1, 2]) {
      const usage = {
        id: randomUUID3(),
        conversationId: input.conversationId,
        runId: run.id,
        attempt,
        modelVersion: input.model,
        inputTokens: null,
        outputTokens: null,
        costMicros: null,
        createdAt: input.now()
      };
      await input.store.recordAssessmentUsage(input.userId, usage);
      if (controller.signal.aborted) throw new Error("Assessment timed out");
      const pending = input.provider.assess({
        scenario: input.scenario,
        turns: input.turns,
        model: input.model,
        signal: controller.signal,
        requestId: usage.id
      }).then(async (result2) => {
        await input.store.settleAssessmentUsage(input.userId, {
          ...usage,
          inputTokens: result2.inputTokens,
          outputTokens: result2.outputTokens,
          costMicros: result2.costMicros,
          providerRequestId: result2.providerRequestId,
          providerResponseId: result2.providerResponseId
        });
        return result2;
      });
      const result = await Promise.race([pending, deadline]);
      let feedback;
      try {
        feedback = coachedAssessmentSchema.parse(typeof result.value === "string" ? JSON.parse(result.value) : result.value);
        const { transferResult: _transferResult, ...evidence } = feedback;
        validateAssessment(evidence, input.turns);
        if (feedback.rubricVersion !== assessmentRubrics2[input.scenario.module].version || feedback.modelVersion !== input.model) {
          throw new Error("Assessment version mismatch");
        }
      } catch {
        if (attempt === 1 && !controller.signal.aborted) continue;
        throw new Error("Assessment evidence invalid");
      }
      const assessment = {
        ...feedback,
        id: randomUUID3(),
        conversationId: input.conversationId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: result.costMicros,
        createdAt: input.now()
      };
      if (controller.signal.aborted || !await input.store.finishAssessmentRun(input.userId, run.id, assessment, input.now())) {
        throw new Error("Assessment lease expired");
      }
      return assessment;
    }
    throw new Error("Assessment failed");
  } catch {
    await input.store.finishAssessmentRun(input.userId, run.id, null, input.now());
    throw new ApiError(503, "Feedback could not be verified. Your responses are saved. You can try feedback again.");
  } finally {
    clearTimeout(timer);
  }
}

// src/routes/conversations.ts
function register8(app2, deps) {
  app2.get("/v1/me/conversations", async (request) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const catalog = await deps.availableScenarios();
    const items = (await deps.store.conversations(user.id, 10)).map((conversation) => ({
      conversation: {
        id: conversation.id,
        scenarioId: conversation.scenarioId,
        state: conversation.state,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      },
      scenario: conversation.scenarioSnapshot ?? catalog.find((item) => item.id === conversation.scenarioId)
    })).filter((item) => item.scenario);
    return { conversations: items };
  });
  app2.get("/v1/me/export", async (request) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const learningRecords = await deps.store.learningRecords(user.id);
    const records = learningRecords.map(({ conversation, turns, assessment }) => ({
      conversation: {
        id: conversation.id,
        scenarioId: conversation.scenarioId,
        scenarioSnapshot: conversation.scenarioSnapshot,
        state: conversation.state,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      },
      turns,
      assessment
    }));
    return { exportedAt: deps.now().toISOString(), user: { id: user.id, email: user.email }, profile, conversations: records };
  });
  app2.post("/v1/me/conversations", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const parsed = conversationCreateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid practice scenario.");
    const progress = await deps.learnerScenarioProgress(user.id, profile);
    const includedModules = (await deps.activePlan(user.id)).modules;
    const eligibleScenarios = (await deps.availableScenarios()).filter((item) => isPublishedScenario2(item) && includedModules.includes(item.module));
    const scenario = recommendScenarios2(profile, eligibleScenarios, progress.mastery.level, progress.completedScenarioIds).find((item) => item.id === parsed.data.scenarioId);
    if (!scenario) throw new ApiError(403, "That scenario is not available for this profile.");
    const timestamp = deps.now();
    const conversation = {
      id: randomUUID4(),
      userId: user.id,
      scenarioId: scenario.id,
      scenarioSnapshot: scenario,
      state: "CREATED",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await deps.store.createConversation(conversation);
    return reply.code(201).send({
      conversation: { id: conversation.id, scenarioId: scenario.id, state: conversation.state, createdAt: timestamp.toISOString() },
      scenario,
      liveVoiceAvailable: false,
      message: "Practice session created. Live AI voice is not connected yet."
    });
  });
  app2.get("/v1/me/conversations/:id", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    let conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (["ASSESSING", "FAILED"].includes(conversation.state)) {
      await deps.store.expireAssessmentRuns(deps.now());
      conversation = await deps.store.conversation(user.id, id);
    }
    const profile = await deps.store.profile(user.id);
    const scenario = conversation.scenarioSnapshot ?? (profile ? (await deps.availableScenarios()).find((item) => item.id === conversation.scenarioId) : void 0);
    if (!scenario) return reply.code(404).send({ error: "Conversation scenario is no longer available." });
    return {
      conversation: { ...conversation, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() },
      scenario,
      turns: await deps.store.conversationTurns(user.id, id),
      liveVoiceAvailable: deps.realtimeConfigured,
      assessmentEnabled: deps.assessmentEnabled,
      feedbackRetryAvailable: deps.assessmentEnabled && conversation.state === "FAILED"
    };
  });
  app2.post("/v1/me/conversations/:id/turns", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(conversation.state)) {
      throw new ApiError(409, "This practice session cannot accept another response.");
    }
    const parsed = userConversationTurnSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a response between 1 and 10,000 characters.");
    const turn = await deps.store.appendConversationTurn(user.id, {
      id: randomUUID4(),
      sessionId: id,
      role: "user",
      text: parsed.data.text,
      createdAt: deps.now()
    });
    return reply.code(201).send({
      turn: { ...turn, createdAt: turn.createdAt.toISOString() },
      message: turn.phase === "independent_retry" ? "Independent retry saved. Complete the practice to record your evidence." : "Primary response saved. Now try the independent retry."
    });
  });
  app2.post("/v1/me/conversations/:id/advance", async (request) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    if (!await deps.store.conversation(user.id, id)) throw new ApiError(404, "Conversation not found.");
    if (!await deps.store.advanceConversation(user.id, id)) {
      throw new ApiError(409, "Save a primary response and stop live voice before advancing once to the new situation.");
    }
    return { conversation: await deps.store.conversation(user.id, id), message: "Ready for the independent new situation." };
  });
  app2.post("/v1/me/conversations/:id/complete", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session is already closed.");
    const turns = await deps.store.conversationTurns(user.id, id);
    if (!turns.some((turn) => turn.role === "user" && turn.phase === "primary")) {
      throw new ApiError(409, "Save your primary response before finishing practice.");
    }
    if (!turns.some((turn) => turn.role === "user" && turn.phase === "independent_retry")) {
      throw new ApiError(409, "Complete the independent retry before finishing practice.");
    }
    if (deps.assessmentEnabled && !deps.assessmentProvider) throw new ApiError(503, "AI feedback is not configured.");
    const assessmentScenario = deps.assessmentEnabled ? conversation.scenarioSnapshot ?? (await deps.availableScenarios()).find((item) => item.id === conversation.scenarioId) : void 0;
    if (deps.assessmentEnabled && !assessmentScenario) throw new ApiError(404, "Practice scenario not found.");
    if (deps.assessmentEnabled && deps.assessmentProvider && assessmentScenario) {
      const feedback = await assessConversation({
        store: deps.store,
        userId: user.id,
        conversationId: id,
        scenario: assessmentScenario,
        turns,
        provider: deps.assessmentProvider,
        model: deps.assessmentModel,
        now: deps.now,
        timeoutMs: deps.assessmentTimeoutMs,
        dailyLimit: deps.assessmentDailyLimit
      });
      return { conversation: { id, state: "FEEDBACK_READY" }, feedback, evidenceSource: "ai_assessment" };
    }
    if (!await deps.store.claimConversationCompletion(user.id, id)) throw new ApiError(409, "Practice is already closed.");
    const primary = turns.find((turn) => turn.role === "user" && turn.phase === "primary");
    const retry = [...turns].reverse().find((turn) => turn.role === "user" && turn.phase === "independent_retry");
    const evidence = primary && retry ? assessCommunicationEvidence2({ primary: primary.text, retry: retry.text }) : null;
    const completed = await deps.store.updateConversationState(user.id, id, "COMPLETED");
    return {
      conversation: { id: completed.id, state: completed.state, completedAt: completed.updatedAt.toISOString() },
      evidence: evidence ? { score: evidence.score, passed: evidence.passed } : null,
      evidenceSource: "local_check",
      message: evidence?.passed ? "Practice completed. Your independent retry met the local evidence checks." : "Practice completed. More evidence is needed before this retry counts as successful."
    };
  });
  app2.post("/v1/me/conversations/:id/feedback/retry", async (request) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    let conversation = await deps.store.conversation(user.id, id);
    if (!conversation) throw new ApiError(404, "Conversation not found.");
    if (["ASSESSING", "FAILED"].includes(conversation.state)) {
      await deps.store.expireAssessmentRuns(deps.now());
      conversation = await deps.store.conversation(user.id, id);
    }
    if (conversation.state === "FEEDBACK_READY") {
      const feedback2 = await deps.store.assessment(user.id, id);
      if (!feedback2) throw new ApiError(409, "Verified AI feedback is not ready.");
      return { conversation: { id, state: "FEEDBACK_READY" }, feedback: feedback2, evidenceSource: "ai_assessment" };
    }
    if (conversation.state !== "FAILED") throw new ApiError(409, "Feedback is running or this practice cannot be retried.");
    if (!deps.assessmentEnabled || !deps.assessmentProvider) throw new ApiError(503, "AI feedback is not configured.");
    const scenario = conversation.scenarioSnapshot ?? (await deps.availableScenarios()).find((item) => item.id === conversation.scenarioId);
    if (!scenario) throw new ApiError(404, "Practice scenario not found.");
    const turns = await deps.store.conversationTurns(user.id, id);
    if (!["primary", "independent_retry"].every((phase) => turns.some((turn) => turn.role === "user" && turn.phase === phase))) {
      throw new ApiError(409, "Both learner responses are required for feedback.");
    }
    const feedback = await assessConversation({
      store: deps.store,
      userId: user.id,
      conversationId: id,
      scenario,
      turns,
      provider: deps.assessmentProvider,
      model: deps.assessmentModel,
      now: deps.now,
      timeoutMs: deps.assessmentTimeoutMs,
      dailyLimit: deps.assessmentDailyLimit
    });
    return { conversation: { id, state: "FEEDBACK_READY" }, feedback, evidenceSource: "ai_assessment" };
  });
  app2.get("/v1/me/conversations/:id/feedback", async (request) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) throw new ApiError(404, "Conversation not found.");
    const feedback = await deps.store.assessment(user.id, id);
    if (!feedback || conversation.state !== "FEEDBACK_READY") throw new ApiError(409, "Verified AI feedback is not ready.");
    const profile = await deps.store.profile(user.id);
    const progress = await deps.learnerScenarioProgress(user.id, profile);
    const modules2 = (await deps.activePlan(user.id)).modules;
    const catalog = (await deps.availableScenarios()).filter((item) => isPublishedScenario2(item) && modules2.includes(item.module));
    const next = profile ? recommendScenarios2(profile, catalog, progress.mastery.level, progress.completedScenarioIds).find((item) => item.id !== conversation.scenarioId) : void 0;
    const scenario = conversation.scenarioSnapshot ?? catalog.find((item) => item.id === conversation.scenarioId);
    return {
      feedback,
      evidenceSource: "ai_assessment",
      nextScenarioId: next?.id ?? null,
      scenario: scenario ? { title: scenario.title } : null
    };
  });
}

// src/lib/progress-snapshot.ts
import { getEngagementLevel, getMasteryLevel as getMasteryLevel2, masteryLevels } from "@coach/core";
function progressSnapshot(records, voice, profile, now, assessmentEnabled) {
  const completed = records.filter((record) => completedStates.has(record.conversation.state));
  const assessments = completed.map((record) => recordEvidence(record, assessmentEnabled)).filter((assessment) => assessment !== null);
  const weekStart = now.getTime() - 7 * 864e5;
  const measuredSeconds = (sessions) => sessions.reduce((total, session) => total + (session.consumedSeconds ?? 0), 0);
  const validVoice = voice.filter((session) => session.startedAt <= now);
  const activeVoice = validVoice.filter((session) => (session.consumedSeconds ?? 0) > 0);
  const weeklyVoice = validVoice.filter((session) => session.startedAt.getTime() >= weekStart);
  const voiceConversations = new Set(voice.map((session) => session.conversationId));
  const textRecords = completed.filter((record) => !voiceConversations.has(record.conversation.id) && record.turns.some((turn) => turn.role === "user"));
  const activeDays = /* @__PURE__ */ new Set([
    ...learnerActivityDates(records, now).map((date) => dayKey(date, profile.timezone)),
    ...activeVoice.map((session) => dayKey(session.startedAt, profile.timezone))
  ]);
  let currentStreakDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    if (!activeDays.has(dayKey(new Date(now.getTime() - offset * 864e5), profile.timezone))) break;
    currentStreakDays += 1;
  }
  const practiceMinutes = measuredSeconds(validVoice) / 60;
  const practiceDays = new Set(learnerActivityDates(completed, now).map((date) => dayKey(date, profile.timezone))).size;
  const completedScenarios = new Set(completed.map((record) => record.conversation.scenarioId)).size;
  const successfulRetries = assessments.filter((assessment) => assessment.passed).length;
  const mastery = getMasteryLevel2({ practiceDays, completedScenarios, successfulRetries, evidenceAssessments: assessments.length });
  const dailyPractice = Array.from({ length: 7 }, (_, index) => {
    const key = dayKey(new Date(now.getTime() - (6 - index) * 864e5), profile.timezone);
    const dayVoice = activeVoice.filter((session) => dayKey(session.startedAt, profile.timezone) === key);
    const dayText = textRecords.filter((record) => learnerActivityDates([record], now).some((date) => dayKey(date, profile.timezone) === key));
    return {
      day: key.slice(5),
      minutes: measuredSeconds(dayVoice) / 60,
      sessions: dayVoice.length + dayText.length,
      textSessions: dayText.length
    };
  });
  const skillSignal = !assessmentEnabled && assessments.length ? Math.round(assessments.reduce((total, assessment) => total + (assessment.score ?? 0), 0) / assessments.length) : null;
  return {
    totalSessions: records.length,
    completedSessions: completed.length,
    weeklySessions: (/* @__PURE__ */ new Set([
      ...records.filter((record) => learnerActivityDates([record], now).some((date) => date.getTime() >= weekStart)).map((record) => record.conversation.id),
      ...activeVoice.filter((session) => session.startedAt.getTime() >= weekStart).map((session) => session.conversationId)
    ])).size,
    practiceMinutes,
    measuredVoiceSeconds: measuredSeconds(validVoice),
    measuredVoiceMinutes: practiceMinutes,
    weeklyPracticeMinutes: measuredSeconds(weeklyVoice) / 60,
    textSessions: textRecords.length,
    settledVoiceSessions: voice.length,
    unknownVoiceDurations: voice.filter((session) => session.consumedSeconds === null).length,
    currentStreakDays,
    engagement: getEngagementLevel({ completedSessions: completed.length, practiceMinutes, currentStreakDays }),
    mastery,
    practiceDays,
    completedScenarios,
    successfulRetries,
    evidenceAssessments: assessments.length,
    evidenceSource: assessmentEnabled ? "ai_assessment" : "local_check",
    dailyPractice,
    levelTrack: masteryLevels.map((item) => ({ level: item.level, title: item.title, reached: mastery.level >= item.level })),
    skillSignal,
    skillSignalStatus: skillSignal === null ? "awaiting_assessment" : "available"
  };
}

// src/routes/progress.ts
function register9(app2, deps) {
  app2.get("/v1/me/progress", async (request) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const [records, voice] = await Promise.all([
      deps.store.learningRecords(user.id),
      deps.store.measuredVoiceSessions(user.id)
    ]);
    return progressSnapshot(records, voice, profile, deps.now(), deps.assessmentEnabled);
  });
}

// src/routes/voice.ts
import { randomUUID as randomUUID6 } from "node:crypto";
import { isPublishedScenario as isPublishedScenario3, voiceTransportStatus } from "@coach/core";
import { z as z7 } from "zod";

// src/conversation-service.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import { transition } from "@coach/core";
var ProviderUnavailableError = class extends Error {
};
async function startLiveConversation(input) {
  const now = input.now ?? (() => /* @__PURE__ */ new Date());
  const conversation = await input.store.conversation(input.userId, input.conversationId);
  if (!conversation || conversation.scenarioId !== input.scenarioId) throw new Error("Conversation not found");
  if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new Error("Conversation is not ready to start");
  const reservationId = randomUUID5();
  await input.store.reserveUsage({ id: reservationId, userId: input.userId, dayKey: input.dayKey, seconds: input.maximumSeconds, expiresAt: new Date(now().getTime() + input.maximumSeconds * 1e3) }, input.allowanceSeconds);
  try {
    let state = transition(conversation.state, "AUTHORIZED");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    state = transition(state, "CONNECTING");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    const connection = await input.provider.connect({ userId: input.userId, scenarioId: input.scenarioId, maximumSeconds: input.maximumSeconds, instructions: input.instructions, signal: AbortSignal.timeout(input.maximumSeconds * 1e3) });
    state = transition(state, "ACTIVE");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    return { reservationId, state, connection };
  } catch (error) {
    await input.store.settleUsage(reservationId, 0);
    await input.store.updateConversationState(input.userId, input.conversationId, "FAILED").catch(() => void 0);
    throw new ProviderUnavailableError(error instanceof Error ? error.message : "Voice provider unavailable");
  }
}

// src/routes/voice.ts
var voiceSessionSchema = z7.object({ conversationId: z7.string().uuid(), scenarioId: z7.string().min(1).max(100) }).strict();
var voiceStopSchema = z7.object({ consumedSeconds: z7.number().int().min(0).max(420).default(0) }).strict().default({});
var voiceProviderCallSchema = z7.object({ providerCallId: z7.string().regex(/^[A-Za-z0-9._:-]{1,200}$/) }).strict();
var voiceTranscriptSchema = z7.object({
  role: z7.enum(["user", "assistant"]),
  phase: z7.unknown().optional(),
  text: z7.string().trim().min(1).max(1e4)
}).strict();
function register10(app2, deps) {
  app2.get("/v1/me/voice-usage", async (request) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    const timezone = profile?.timezone ?? "Asia/Kolkata";
    const today = dayKey(deps.now(), timezone);
    const dailyUsage = await deps.store.usage(user.id, today);
    const plan = await deps.activePlan(user.id);
    const currentMonth = monthKey(deps.now(), timezone);
    const monthlyUsage = await deps.store.voiceMonthUsage(user.id, currentMonth);
    const freeTier = plan.id === "free";
    const sessionsUsed = freeTier ? await deps.store.totalVoiceSessions(user.id) : monthlyUsage.sessionsUsed;
    const sessionsRemaining = Math.max(0, plan.voiceSessionsPerMonth - sessionsUsed);
    return {
      planId: plan.id,
      planTitle: plan.title,
      modules: plan.modules,
      timezone,
      dayKey: today,
      monthKey: currentMonth,
      sessionsUsedThisMonth: monthlyUsage.sessionsUsed,
      sessionsRemainingThisMonth: freeTier ? null : sessionsRemaining,
      sessionsAllowed: plan.voiceSessionsPerMonth,
      sessionsRemaining,
      lifetimeFreeLimit: freeTier,
      consumedSecondsThisMonth: monthlyUsage.consumedSeconds,
      maxSessionSeconds: plan.maxSessionSeconds,
      reservedSecondsToday: dailyUsage.reservedSeconds,
      consumedSecondsToday: dailyUsage.consumedSeconds,
      resetsAt: nextReset(deps.now(), timezone),
      monthResetsAt: nextMonthReset(deps.now(), timezone),
      enforcement: "server_reservations",
      liveVoiceAvailable: deps.realtimeConfigured
    };
  });
  app2.get("/v1/voice/readiness", async (request) => {
    await authenticate(request, deps);
    return deps.realtimeConfigured ? { available: true, code: "SERVER_PROVIDER_READY", message: "The coach voice provider is configured. Use an Android or iOS development build for the live conversation." } : { available: false, code: "PROVIDER_NOT_CONFIGURED", message: "Live AI voice is not configured on the server. You can still test your microphone locally; no audio is sent to an AI provider." };
  });
  app2.get("/v1/voice/capabilities", async (request) => {
    await authenticate(request, deps);
    const requestedPlatform = request.query && typeof request.query === "object" ? request.query.platform : void 0;
    const requestedCapabilities = request.query && typeof request.query === "object" ? request.query : {};
    const platform = requestedPlatform === "android" || requestedPlatform === "ios" ? requestedPlatform : "web";
    return voiceTransportStatus({
      platform,
      nativeModuleAvailable: requestedCapabilities.nativeModuleAvailable === "true",
      developmentBuild: requestedCapabilities.developmentBuild === "true",
      providerConfigured: deps.realtimeConfigured
    });
  });
  app2.post("/v1/voice/sessions", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (request.headers.origin) throw new ApiError(403, "Live voice requires an Android or iOS development build.");
    if (await deps.store.activeVoiceSession(user.id)) throw new ApiError(409, "Finish your active voice session before starting another.");
    if (!deps.realtimeProvider) {
      return reply.code(503).send({ error: "Live voice is disabled pending provider configuration and native transport verification." });
    }
    if (!user.emailVerifiedAt) throw new ApiError(403, "Verify your email before starting AI live voice.");
    const parsed = voiceSessionSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid conversation and scenario.");
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversation = await deps.store.conversation(user.id, parsed.data.conversationId);
    const scenario = (await deps.availableScenarios()).filter(isPublishedScenario3).find((item) => item.id === parsed.data.scenarioId);
    if (!conversation || conversation.scenarioId !== parsed.data.scenarioId || !scenario) throw new ApiError(404, "Practice conversation not found.");
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "Practice is not ready for voice.");
    const plan = await deps.activePlan(user.id);
    const currentMonth = monthKey(deps.now(), profile.timezone);
    const lifetimeLimit = plan.id === "free";
    const allowanceSeconds = plan.voiceSessionsPerMonth * plan.maxSessionSeconds;
    const maximumSeconds = Math.min(profile.practiceMinutes * 60, plan.maxSessionSeconds);
    try {
      await deps.store.reserveVoiceSession(user.id, currentMonth, plan.voiceSessionsPerMonth, lifetimeLimit);
    } catch (error) {
      if (error instanceof Error && error.message.includes("allowance is exhausted")) {
        throw new ApiError(409, lifetimeLimit ? "Your two free voice sessions have been used." : "Your monthly voice sessions are used. They reset at the start of next month.");
      }
      throw error;
    }
    let sessionSlotReserved = true;
    try {
      const result = await startLiveConversation({
        store: deps.store,
        provider: deps.realtimeProvider,
        userId: user.id,
        conversationId: conversation.id,
        scenarioId: scenario.id,
        instructions: conversation.currentPhase === "independent_retry" ? `Present this new situation: ${scenario.independentQuestion}. Then listen independently. Never score during the call.` : `Set the scene: ${scenario.context} ${scenario.question}. Let the learner respond. Ask at most 2 probing questions.
             Give no feedback and never score during the call. Do not begin the independent retry.`,
        dayKey: dayKey(deps.now(), profile.timezone),
        allowanceSeconds,
        maximumSeconds,
        now: () => deps.now()
      });
      const timestamp = deps.now();
      const expiresAt = new Date(Math.min(result.connection.expiresAt.getTime(), timestamp.getTime() + maximumSeconds * 1e3));
      const session = {
        id: randomUUID6(),
        userId: user.id,
        conversationId: conversation.id,
        reservationId: result.reservationId,
        monthKey: currentMonth,
        providerSessionId: result.connection.providerSessionId,
        providerCallId: null,
        providerTerminatedAt: null,
        status: "active",
        startedAt: timestamp,
        expiresAt,
        endedAt: null
      };
      try {
        await deps.store.createVoiceSession(session);
        sessionSlotReserved = false;
      } catch (error) {
        await deps.store.settleUsage(result.reservationId, 0);
        await deps.store.releaseVoiceSession(user.id, currentMonth, lifetimeLimit);
        sessionSlotReserved = false;
        await deps.store.updateConversationState(user.id, conversation.id, "FAILED").catch(() => void 0);
        if (error instanceof Error && error.message.includes("already active")) throw new ApiError(409, "Finish your active voice session before starting another.");
        throw error;
      }
      return reply.code(201).send({
        sessionId: session.id,
        conversation: { id: conversation.id, state: result.state },
        reservationId: result.reservationId,
        clientSecret: result.connection.clientSecret,
        model: deps.realtimeModel,
        expiresAt: session.expiresAt.toISOString(),
        providerSessionCreated: true,
        liveVoiceAvailable: false,
        message: "Provider session created. Native WebRTC transport remains gated until device verification."
      });
    } catch (error) {
      if (sessionSlotReserved) await deps.store.releaseVoiceSession(user.id, currentMonth, lifetimeLimit).catch(() => void 0);
      if (error instanceof ProviderUnavailableError) throw new ApiError(503, "The live voice provider is temporarily unavailable.");
      throw error;
    }
  });
  app2.post("/v1/voice/sessions/:id/bind", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    const parsed = voiceProviderCallSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid provider call identifier.");
    const session = await deps.store.bindVoiceProviderCall(user.id, id, parsed.data.providerCallId);
    return reply.send({ sessionId: session.id, providerCallId: session.providerCallId, message: "Provider call bound for server-side termination." });
  });
  app2.post("/v1/voice/sessions/:id/transcript", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    const parsed = voiceTranscriptSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid voice transcript.");
    const session = await deps.store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "The voice session is already closed.");
    const turn = await deps.store.appendConversationTurn(user.id, {
      id: randomUUID6(),
      sessionId: session.conversationId,
      role: parsed.data.role,
      text: parsed.data.text,
      createdAt: deps.now()
    });
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: "Voice transcript saved." });
  });
  app2.post("/v1/voice/sessions/:id/stop", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = request.params.id;
    if (!id) throw new ApiError(400, "A voice session id is required.");
    const parsed = voiceStopSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid consumed duration.");
    const session = await deps.store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "Voice session is already closed.");
    let providerTermination = "not_bound";
    if (deps.realtimeProvider && session.providerCallId) {
      try {
        await deps.realtimeProvider.terminate(session.providerCallId);
        await deps.store.markVoiceProviderTerminated(session.id, deps.now());
        providerTermination = "completed";
      } catch {
        providerTermination = "failed";
      }
    }
    const endedAt = deps.now();
    const reservedSeconds = await deps.store.reservationSeconds(session.reservationId);
    if (reservedSeconds === null) throw new ApiError(409, "Voice usage reservation is no longer available.");
    const consumedSeconds = elapsedSeconds(session.startedAt, endedAt, reservedSeconds);
    if (parsed.data.consumedSeconds > consumedSeconds) {
      request.log.debug({ clientConsumedSecondsHint: parsed.data.consumedSeconds, serverConsumedSeconds: consumedSeconds }, "Voice usage hint exceeds server elapsed time");
    }
    await deps.store.endVoiceSession(user.id, id, endedAt, "ended", consumedSeconds);
    const conversation = await deps.store.conversation(user.id, session.conversationId);
    if (conversation?.state === "ACTIVE") await deps.store.updateConversationState(user.id, session.conversationId, "INTERRUPTED");
    return { sessionId: id, status: "ended", consumedSeconds, conversationState: "INTERRUPTED", providerTermination };
  });
}

// src/lib/shared-rate-limit.ts
import { createHash as createHash4 } from "node:crypto";
function sharedRateLimitStore(store2, now, namespace = "communication-coach") {
  return class SharedRateLimitStore {
    namespace = `${namespace}:global`;
    constructor(_options) {
    }
    incr(key, callback, windowMs = 6e4) {
      const hash = createHash4("sha256").update(`${this.namespace}:${key}`).digest("hex");
      void store2.incrementRateLimit(hash, windowMs, now()).then((result) => callback(null, result), () => {
        callback(new ApiError(503, "Rate-limit storage is unavailable."));
      });
    }
    child(routeOptions) {
      const options = routeOptions;
      const child = new SharedRateLimitStore(routeOptions);
      child.namespace = `${namespace}:${options.method ?? "route"}:${options.prefix ?? ""}:${options.path ?? ""}`;
      return child;
    }
  };
}

// src/app.ts
async function buildApp(store2, options = {}) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1" && store2.rateLimitStorage !== "postgres") {
    throw new Error("Vercel production requires shared PostgreSQL rate limiting.");
  }
  const app2 = Fastify({
    logger: options.logger ? {
      redact: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-cron-secret"],
      serializers: { req: (request) => ({ method: request.method, url: request.url }) }
    } : false,
    bodyLimit: 16384,
    trustProxy: false
  });
  await app2.register(helmet);
  await app2.register(cors, { origin: options.origins ?? ["http://localhost:3000", "http://localhost:8081"] });
  await app2.register(rateLimit, {
    max: options.rateLimitMax ?? 100,
    timeWindow: 6e4,
    skipOnError: false,
    store: sharedRateLimitStore(store2, options.now ?? (() => /* @__PURE__ */ new Date()), options.rateLimitNamespace)
  });
  const deps = await createRouteDependencies(store2, options);
  if ((options.runtime ?? process.env.RUNTIME) === "server") {
    const expiryTimer = setInterval(() => {
      void deps.reapVoiceSessions().catch(() => void 0);
    }, 3e4);
    expiryTimer.unref();
    app2.addHook("onClose", async () => {
      clearInterval(expiryTimer);
    });
  }
  app2.route({
    method: ["GET", "POST"],
    url: "/internal/cron/reap-voice-sessions",
    config: { rateLimit: false },
    handler: async (request) => {
      const secret = options.cronSecret ?? process.env.CRON_SECRET ?? "";
      if (!secret) throw new ApiError(503, "Scheduled cleanup is not configured.");
      const provided = request.headers["x-cron-secret"] ?? request.headers.authorization?.replace(/^Bearer /, "");
      if (!safeEqual(provided, secret)) throw new ApiError(401, "Unauthorized scheduler.");
      await deps.reapVoiceSessions();
      await store2.pruneRateLimits(deps.now());
      return { processed: true, pendingProviderCalls: (await store2.pendingVoiceProviderCalls()).length };
    }
  });
  app2.setErrorHandler((error, request, reply) => {
    if (error instanceof ConflictError) {
      return reply.code(409).send({ error: error.message || "Unable to create account. Try signing in." });
    }
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
  register(app2, deps);
  register2(app2, deps);
  register3(app2, deps);
  register4(app2, deps);
  register5(app2, deps);
  register6(app2, deps);
  register7(app2, deps);
  register8(app2, deps);
  register9(app2, deps);
  register10(app2, deps);
  return app2;
}

// src/prisma-store.ts
import { Prisma as Prisma2 } from "@prisma/client";
import { profileSchema as profileSchema2, scenarioSchema as scenarioSchema2, states } from "@coach/core";

// src/lib/assessment-record.ts
import { feedbackAssessmentSchema } from "@coach/core";
function nonNegativeInteger(value) {
  return value === null || Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}
function checkedAssessment(record) {
  const feedback = feedbackAssessmentSchema.parse({
    rubricVersion: record.rubricVersion,
    modelVersion: record.modelVersion,
    priorities: record.priorities,
    transferResult: record.transferResult,
    audioAssessed: record.audioAssessed,
    coachingReview: record.coachingReview
  });
  if (record.inputTokens === null || record.outputTokens === null || ![record.inputTokens, record.outputTokens, record.costMicros].every(nonNegativeInteger)) {
    throw new Error("Invalid assessment usage counters");
  }
  return structuredClone({ ...record, ...feedback });
}
function checkedAssessmentUsage(record) {
  if (![1, 2].includes(record.attempt) || !record.modelVersion.trim() || [record.providerRequestId, record.providerResponseId].some((value) => value != null && value.length > 256) || ![record.inputTokens, record.outputTokens, record.costMicros].every(nonNegativeInteger)) {
    throw new Error("Invalid assessment attempt usage");
  }
  return structuredClone(record);
}

// src/lib/prisma-assessment-runs.ts
import { Prisma } from "@prisma/client";

// src/lib/assessment-run.ts
import { randomUUID as randomUUID7 } from "node:crypto";
var assessmentLeaseMs = 6e4;
var assessmentRunLimit = 3;
function newAssessmentRun(account, conversation, runs, now, dailyLimit) {
  if (!account || !conversation || conversation.userId !== account.id) throw new ApiError(404, "Conversation not found.");
  if (!account.emailVerifiedAt) throw new ApiError(403, "Verify your email before requesting AI feedback.");
  if (!["CREATED", "INTERRUPTED", "FAILED"].includes(conversation.state)) {
    throw new ConflictError("Feedback is already running or this practice is closed.");
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100) throw new Error("Invalid assessment daily limit");
  const ownedRuns = runs.filter((run) => run.userId === account.id);
  const dayKey2 = now.toISOString().slice(0, 10);
  if (ownedRuns.filter((run) => run.dayKey === dayKey2).length >= dailyLimit) {
    throw new ApiError(429, "Today's AI feedback limit is reached. Your responses are saved. Try again tomorrow (UTC).");
  }
  const previous = ownedRuns.filter((run) => run.conversationId === conversation.id);
  if (previous.some((run) => run.status === "running")) throw new ConflictError("Feedback is already running.");
  if (previous.length >= assessmentRunLimit) {
    throw new ApiError(429, "Feedback retry limit reached for this practice. Your responses are saved.");
  }
  return {
    id: randomUUID7(),
    userId: account.id,
    conversationId: conversation.id,
    dayKey: dayKey2,
    status: "running",
    createdAt: now,
    expiresAt: new Date(now.getTime() + assessmentLeaseMs),
    finishedAt: null
  };
}

// src/lib/prisma-assessment-runs.ts
function prismaAssessmentRuns(db) {
  const methods = {
    async claimAssessmentRun(userId, conversationId, now, dailyLimit) {
      return db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
        await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
        const account = await transaction.user.findUnique({ where: { id: userId } });
        const conversation = await transaction.conversation.findFirst({ where: { id: conversationId, userId } });
        const rows = await transaction.assessmentRun.findMany({ where: {
          userId,
          OR: [{ dayKey: now.toISOString().slice(0, 10) }, { conversationId }]
        } });
        const run = newAssessmentRun(
          account,
          conversation ? { ...conversation, state: conversation.state } : null,
          rows,
          now,
          dailyLimit
        );
        await transaction.assessmentRun.create({ data: run });
        await transaction.conversation.update({ where: { id: conversationId }, data: { state: "ASSESSING", updatedAt: now } });
        return run;
      });
    },
    async finishAssessmentRun(userId, runId, assessment, now) {
      const checked = assessment ? checkedAssessment(assessment) : null;
      return db.$transaction(async (transaction) => {
        const candidate = await transaction.assessmentRun.findFirst({ where: { id: runId, userId } });
        if (!candidate) return false;
        const conversationId = candidate.conversationId;
        await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
        const run = await transaction.assessmentRun.findFirst({ where: { id: runId, userId, status: "running" } });
        const conversation = await transaction.conversation.findFirst({ where: { id: conversationId, userId } });
        if (!run || !conversation) return false;
        if (checked && checked.conversationId !== conversationId) throw new Error("Assessment conversation mismatch");
        const accepted = Boolean(checked && run.expiresAt > now && conversation.state === "ASSESSING");
        if (accepted && checked) {
          const { audioAssessed: _audioAssessed, coachingReview, ...data } = checked;
          await transaction.assessment.create({ data: { ...data, coachingReview: coachingReview ?? Prisma.DbNull } });
        }
        await transaction.assessmentRun.update({ where: { id: runId }, data: {
          status: accepted ? "succeeded" : "failed",
          finishedAt: now
        } });
        await transaction.conversation.updateMany({
          where: { id: conversationId, userId, state: "ASSESSING" },
          data: { state: accepted ? "FEEDBACK_READY" : "FAILED", updatedAt: now }
        });
        return checked ? accepted : true;
      });
    },
    async expireAssessmentRuns(now) {
      const rows = await db.assessmentRun.findMany({
        where: { status: "running", expiresAt: { lte: now } },
        take: 100,
        orderBy: { expiresAt: "asc" }
      });
      let expired = 0;
      for (const row of rows) if (await methods.finishAssessmentRun(row.userId, row.id, null, now)) expired += 1;
      const cutoff = new Date(now.getTime() - assessmentLeaseMs);
      const recovered = await db.conversation.updateMany({ where: {
        state: { in: ["ASSESSING", "FAILED"] },
        assessmentRuns: { none: {} },
        assessment: { isNot: null },
        OR: [{ state: "FAILED" }, { updatedAt: { lte: cutoff } }]
      }, data: { state: "FEEDBACK_READY", updatedAt: now } });
      const legacy = await db.conversation.updateMany({ where: {
        state: "ASSESSING",
        updatedAt: { lte: cutoff },
        assessmentRuns: { none: {} },
        assessment: { is: null }
      }, data: { state: "FAILED", updatedAt: now } });
      return expired + recovered.count + legacy.count;
    },
    async settleAssessmentUsage(userId, usage) {
      const record = checkedAssessmentUsage(usage);
      const existing = await db.assessmentUsage.findFirst({ where: {
        id: record.id,
        conversationId: record.conversationId,
        runId: record.runId ?? null,
        attempt: record.attempt,
        modelVersion: record.modelVersion,
        conversation: { userId }
      } });
      if (!existing) throw new Error("Assessment usage not found");
      if (existing.inputTokens !== null) return;
      await db.assessmentUsage.updateMany({ where: { id: existing.id, inputTokens: null }, data: {
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        costMicros: record.costMicros,
        providerRequestId: record.providerRequestId,
        providerResponseId: record.providerResponseId
      } });
    }
  };
  return methods;
}

// src/prisma-store.ts
var currentPhase = (phase) => phase === "independent_retry" ? "independent_retry" : "primary";
var accountFromRow = (row) => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role === "manager" ? "manager" : "learner",
  emailVerifiedAt: row.emailVerifiedAt,
  legalVersion: row.legalVersion,
  legalAcceptedAt: row.legalAcceptedAt
});
var accountFromNullableRow = (row) => row ? accountFromRow(row) : null;
function prismaStore(db) {
  return {
    ...prismaAssessmentRuns(db),
    rateLimitStorage: "postgres",
    async incrementRateLimit(keyHash, windowMs, now) {
      const resetAt = new Date(now.getTime() + windowMs);
      const rows = await db.$queryRaw`
        INSERT INTO "RateLimitBucket" ("keyHash", "hits", "resetAt") VALUES (${keyHash}, 1, ${resetAt})
        ON CONFLICT ("keyHash") DO UPDATE SET
          "hits" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
            ELSE LEAST("RateLimitBucket"."hits"::bigint + 1, 2147483647)::integer END,
          "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
            ELSE "RateLimitBucket"."resetAt" END
        RETURNING "hits" AS "current", GREATEST(1, EXTRACT(EPOCH FROM ("resetAt" - ${now}::timestamp)) * 1000)::integer AS "ttl"
      `;
      return rows[0];
    },
    async pruneRateLimits(now) {
      await db.rateLimitBucket.deleteMany({ where: { resetAt: { lte: now } } });
    },
    async learningRecords(userId) {
      const rows = await db.conversation.findMany({
        where: { userId },
        relationLoadStrategy: "join",
        orderBy: { createdAt: "desc" },
        include: { turns: { orderBy: { createdAt: "asc" } }, assessment: true }
      });
      return rows.filter((row) => states.includes(row.state)).map((row) => ({
        conversation: {
          id: row.id,
          userId: row.userId,
          scenarioId: row.scenarioId,
          scenarioSnapshot: row.scenarioData ? scenarioSchema2.parse(row.scenarioData) : void 0,
          currentPhase: currentPhase(row.currentPhase),
          state: row.state,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        },
        turns: row.turns.map((turn) => ({
          ...turn,
          role: turn.role,
          phase: currentPhase(turn.phase)
        })),
        assessment: row.assessment ? checkedAssessment({ ...row.assessment, audioAssessed: false }) : null
      }));
    },
    async measuredVoiceSessions(userId) {
      return db.$queryRaw`
        SELECT voice."conversationId", voice."startedAt", usage."consumedSeconds"
        FROM "VoiceSession" voice LEFT JOIN "UsageReservation" usage
          ON usage."id" = voice."reservationId" AND usage."userId" = voice."userId"
        WHERE voice."userId" = ${userId}::uuid AND voice."status" IN ('ended', 'expired')
      `;
    },
    async ready() {
      await db.$queryRaw`SELECT 1`;
    },
    async createAccount(email, passwordHash, legalAcceptance) {
      try {
        return accountFromRow(await db.user.create({ data: {
          email,
          passwordHash,
          legalVersion: legalAcceptance?.version,
          legalAcceptedAt: legalAcceptance?.acceptedAt
        } }));
      } catch (error) {
        if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError();
        throw error;
      }
    },
    async accountByEmail(email) {
      return accountFromNullableRow(await db.user.findUnique({ where: { email } }));
    },
    async accountById(id) {
      return accountFromNullableRow(await db.user.findUnique({ where: { id } }));
    },
    async markEmailVerified(userId, now) {
      await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      return accountFromRow(await db.user.findUniqueOrThrow({ where: { id: userId } }));
    },
    async issueEmailToken(token, hourlyLimit) {
      return db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${token.userId}::uuid FOR UPDATE`;
        const count = await transaction.emailVerificationToken.count({
          where: {
            userId: token.userId,
            purpose: token.purpose,
            createdAt: { gt: new Date(token.createdAt.getTime() - 36e5) }
          }
        });
        if (count >= hourlyLimit) return false;
        await transaction.emailVerificationToken.create({ data: token });
        return true;
      });
    },
    async consumeEmailToken(hash, purpose, now, userId, newPasswordHash) {
      return db.$transaction(async (transaction) => {
        const candidate = await transaction.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
        if (!candidate) return null;
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.userId}::uuid FOR UPDATE`;
        const token = await transaction.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
        if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= now) return null;
        if (userId && token.userId !== userId) return null;
        if (purpose === "password_reset" && !newPasswordHash) return null;
        await transaction.emailVerificationToken.update({ where: { tokenHash: hash }, data: { usedAt: now } });
        const user = await transaction.user.findUniqueOrThrow({ where: { id: token.userId } });
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: user.emailVerifiedAt ?? now, ...newPasswordHash ? { passwordHash: newPasswordHash } : {} }
        });
        if (purpose === "password_reset") {
          await transaction.authSession.deleteMany({ where: { userId: user.id } });
          if (!user.emailVerifiedAt) await transaction.oAuthIdentity.deleteMany({ where: { userId: user.id } });
          await transaction.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
        }
        return accountFromRow(updated);
      });
    },
    async oauthIdentity(provider, subject) {
      const row = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider, subject } } });
      return row ? { ...row, provider: row.provider } : null;
    },
    async saveOAuthIdentity(identity) {
      try {
        await db.oAuthIdentity.create({ data: identity });
      } catch (error) {
        if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("This provider identity is already linked to another account.");
        throw error;
      }
    },
    async createSession(session, expectedPasswordHash) {
      await db.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId}::uuid FOR UPDATE`;
        const user = await transaction.user.findUnique({ where: { id: session.userId } });
        if (!user || expectedPasswordHash && !safeEqual(user.passwordHash, expectedPasswordHash)) {
          throw new ConflictError("Account credentials changed. Please sign in again.");
        }
        await transaction.authSession.create({ data: session });
      });
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
    async reservationSeconds(reservationId) {
      const reservation = await db.usageReservation.findUnique({ where: { id: reservationId }, select: { reservedSeconds: true } });
      return reservation?.reservedSeconds ?? null;
    },
    async reserveUsage(reservation, allowanceSeconds) {
      await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${reservation.userId} || ':' || ${reservation.dayKey})::bigint
          )
        `;
        const rows = await transaction.usageReservation.aggregate({
          where: { userId: reservation.userId, dayKey: reservation.dayKey },
          _sum: { reservedSeconds: true, consumedSeconds: true }
        });
        const reserved = rows._sum.reservedSeconds ?? 0;
        if (reserved + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
        await transaction.usageReservation.create({
          data: {
            id: reservation.id,
            userId: reservation.userId,
            dayKey: reservation.dayKey,
            reservedSeconds: reservation.seconds,
            expiresAt: reservation.expiresAt
          }
        });
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
    async voiceMonthUsage(userId, monthKey2) {
      const usage = await db.voiceMonthUsage.findUnique({ where: { userId_monthKey: { userId, monthKey: monthKey2 } } });
      return usage ? { userId, monthKey: monthKey2, sessionsUsed: usage.sessionsUsed, consumedSeconds: usage.consumedSeconds } : { userId, monthKey: monthKey2, sessionsUsed: 0, consumedSeconds: 0 };
    },
    async totalVoiceSessions(userId) {
      const result = await db.voiceMonthUsage.aggregate({ where: { userId }, _sum: { sessionsUsed: true } });
      return result._sum.sessionsUsed ?? 0;
    },
    async reserveVoiceSession(userId, monthKey2, sessionLimit, lifetimeLimit) {
      const lockScope = lifetimeLimit ? "lifetime" : monthKey2;
      await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${userId} || ':sessions:' || ${lockScope})::bigint)
        `;
        const usage = await transaction.voiceMonthUsage.upsert({
          where: { userId_monthKey: { userId, monthKey: monthKey2 } },
          create: { userId, monthKey: monthKey2 },
          update: {}
        });
        const used = lifetimeLimit ? (await transaction.voiceMonthUsage.aggregate({ where: { userId }, _sum: { sessionsUsed: true } }))._sum.sessionsUsed ?? 0 : usage.sessionsUsed;
        if (used >= sessionLimit) throw new ConflictError("Voice session allowance is exhausted.");
        await transaction.voiceMonthUsage.update({
          where: { userId_monthKey: { userId, monthKey: monthKey2 } },
          data: { sessionsUsed: { increment: 1 } }
        });
      });
    },
    async releaseVoiceSession(userId, monthKey2, lifetimeLimit) {
      const lockScope = lifetimeLimit ? "lifetime" : monthKey2;
      await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${userId} || ':sessions:' || ${lockScope})::bigint)
        `;
        await transaction.voiceMonthUsage.updateMany({
          where: { userId, monthKey: monthKey2, sessionsUsed: { gt: 0 } },
          data: { sessionsUsed: { decrement: 1 } }
        });
      });
    },
    async createConversation(conversation) {
      await db.conversation.create({ data: {
        id: conversation.id,
        userId: conversation.userId,
        scenarioId: conversation.scenarioId,
        scenarioData: conversation.scenarioSnapshot,
        currentPhase: conversation.currentPhase ?? "primary",
        state: conversation.state,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      } });
    },
    async conversation(userId, id) {
      const row = await db.conversation.findFirst({ where: { id, userId } });
      if (!row || !states.includes(row.state)) return null;
      return {
        ...row,
        currentPhase: currentPhase(row.currentPhase),
        scenarioSnapshot: row.scenarioData ? scenarioSchema2.parse(row.scenarioData) : void 0,
        state: row.state
      };
    },
    async conversations(userId, limit) {
      const rows = await db.conversation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...limit === void 0 ? {} : { take: Math.min(Math.max(limit, 1), 20) } });
      return rows.filter((row) => states.includes(row.state)).map((row) => ({
        ...row,
        currentPhase: currentPhase(row.currentPhase),
        scenarioSnapshot: row.scenarioData ? scenarioSchema2.parse(row.scenarioData) : void 0,
        state: row.state
      }));
    },
    async updateConversationState(userId, id, state) {
      const row = await db.conversation.updateMany({ where: { id, userId }, data: { state } });
      if (row.count !== 1) throw new Error("Conversation not found");
      const updated = await db.conversation.findUniqueOrThrow({ where: { id } });
      return {
        ...updated,
        currentPhase: currentPhase(updated.currentPhase),
        scenarioSnapshot: updated.scenarioData ? scenarioSchema2.parse(updated.scenarioData) : void 0,
        state: updated.state
      };
    },
    async claimConversationCompletion(userId, id) {
      const result = await db.conversation.updateMany({
        where: { id, userId, state: { in: ["CREATED", "INTERRUPTED"] } },
        data: { state: "COMPLETED" }
      });
      return result.count === 1;
    },
    async assessment(userId, conversationId) {
      const row = await db.assessment.findFirst({ where: { conversationId, conversation: { userId } } });
      if (!row) return null;
      return checkedAssessment({ ...row, audioAssessed: false });
    },
    async advanceConversation(userId, id) {
      return db.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "Conversation" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE
        `;
        const result = await transaction.conversation.updateMany({
          where: {
            id,
            userId,
            currentPhase: "primary",
            state: { in: ["CREATED", "INTERRUPTED"] },
            turns: { some: { role: "user", phase: "primary" } },
            voiceSessions: { none: { status: "active" } }
          },
          data: { currentPhase: "independent_retry" }
        });
        return result.count === 1;
      });
    },
    async appendConversationTurn(userId, turn) {
      return db.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "Conversation" WHERE "id" = ${turn.sessionId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE
        `;
        const row = await transaction.conversation.findFirst({ where: { id: turn.sessionId, userId } });
        if (!row) throw new Error("Conversation not found");
        if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(row.state)) throw new ConflictError("Practice is closed.");
        const saved = { ...turn, phase: currentPhase(row.currentPhase) };
        await transaction.conversationTurn.create({ data: saved });
        return saved;
      });
    },
    async saveAssessment(userId, assessment) {
      const record = checkedAssessment(assessment);
      try {
        await db.assessment.create({
          data: {
            id: record.id,
            conversation: { connect: { id: record.conversationId, userId } },
            rubricVersion: record.rubricVersion,
            modelVersion: record.modelVersion,
            priorities: record.priorities,
            transferResult: record.transferResult,
            coachingReview: record.coachingReview ?? Prisma2.DbNull,
            inputTokens: record.inputTokens,
            outputTokens: record.outputTokens,
            costMicros: record.costMicros,
            createdAt: record.createdAt
          }
        });
      } catch (error) {
        if (error instanceof Prisma2.PrismaClientKnownRequestError) {
          if (["P2002", "P2014"].includes(error.code)) throw new ConflictError("Assessment already exists.");
          if (error.code === "P2025") throw new Error("Conversation not found");
        }
        throw error;
      }
    },
    async recordAssessmentUsage(userId, usage) {
      const record = checkedAssessmentUsage(usage);
      const { conversationId, runId, ...data } = record;
      try {
        await db.$transaction(async (transaction) => {
          await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId}::uuid FOR UPDATE`;
          if (runId && !await transaction.assessmentRun.findFirst({ where: {
            id: runId,
            userId,
            conversationId,
            status: "running",
            expiresAt: { gt: record.createdAt }
          } })) throw new ConflictError("Assessment run is not active.");
          await transaction.assessmentUsage.create({
            data: {
              ...data,
              conversation: { connect: { id: conversationId, userId } },
              ...runId ? { run: { connect: { id: runId } } } : {}
            }
          });
        });
      } catch (error) {
        if (error instanceof Prisma2.PrismaClientKnownRequestError) {
          if (error.code === "P2002") throw new ConflictError("Assessment attempt usage already exists.");
          if (error.code === "P2025") throw new Error("Conversation not found");
        }
        throw error;
      }
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
        if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A scenario with this id already exists.");
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
      try {
        await db.voiceSession.create({ data: session });
      } catch (error) {
        if (error instanceof Prisma2.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictError("Another voice session is already active.");
        }
        throw error;
      }
    },
    async voiceSession(userId, id) {
      const row = await db.voiceSession.findFirst({ where: { id, userId } });
      return row ? { ...row, status: row.status } : null;
    },
    async activeVoiceSession(userId) {
      const row = await db.voiceSession.findFirst({ where: { userId, status: "active" } });
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
    async endVoiceSession(userId, id, endedAt, status, consumedSeconds) {
      return db.$transaction(async (transaction) => {
        const row = await transaction.voiceSession.findFirst({ where: { id, userId, status: "active" } });
        if (!row) throw new ConflictError("Voice session is already closed.");
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (!reservation) throw new Error("Usage reservation not found");
        const chargedSeconds = Math.min(consumedSeconds, reservation.reservedSeconds);
        const updated = await transaction.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { status, endedAt } });
        if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
        await transaction.usageReservation.update({
          where: { id: row.reservationId },
          data: { reservedSeconds: chargedSeconds, consumedSeconds: chargedSeconds }
        });
        await transaction.voiceMonthUsage.upsert({
          where: { userId_monthKey: { userId, monthKey: row.monthKey } },
          create: { userId, monthKey: row.monthKey, consumedSeconds: chargedSeconds },
          update: { consumedSeconds: { increment: chargedSeconds } }
        });
        return { ...row, status, endedAt };
      });
    },
    async expireVoiceSessions(now) {
      const rows = await db.voiceSession.findMany({
        where: { status: "active", expiresAt: { lte: now } },
        select: { id: true, userId: true, monthKey: true, conversationId: true, reservationId: true, startedAt: true, expiresAt: true }
      });
      let expired = 0;
      for (const row of rows) await db.$transaction(async (transaction) => {
        const updated = await transaction.voiceSession.updateMany({ where: { id: row.id, status: "active" }, data: { status: "expired", endedAt: now } });
        if (updated.count !== 1) return;
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (reservation) {
          const consumedSeconds = elapsedSeconds(row.startedAt, row.expiresAt, reservation.reservedSeconds);
          await transaction.usageReservation.update({
            where: { id: row.reservationId },
            data: { reservedSeconds: consumedSeconds, consumedSeconds }
          });
          await transaction.voiceMonthUsage.upsert({
            where: { userId_monthKey: { userId: row.userId, monthKey: row.monthKey } },
            create: { userId: row.userId, monthKey: row.monthKey, consumedSeconds },
            update: { consumedSeconds: { increment: consumedSeconds } }
          });
        }
        await transaction.conversation.updateMany({
          where: { id: row.conversationId, state: "ACTIVE" },
          data: { state: "INTERRUPTED" }
        });
        expired += 1;
      });
      return expired;
    }
  };
}

// src/memory-store.ts
import { randomUUID as randomUUID8 } from "node:crypto";
var MemoryStore = class {
  rateLimitStorage = "memory";
  rateLimitBuckets = /* @__PURE__ */ new Map();
  async incrementRateLimit(keyHash, windowMs, now) {
    return this.withUsageLock(`rate:${keyHash}`, async () => {
      const existing = this.rateLimitBuckets.get(keyHash);
      const row = existing && existing.resetAt > now.getTime() ? { ...existing, current: Math.min(2147483647, existing.current + 1) } : { current: 1, resetAt: now.getTime() + windowMs };
      this.rateLimitBuckets.set(keyHash, row);
      return { current: row.current, ttl: Math.max(1, row.resetAt - now.getTime()) };
    });
  }
  async pruneRateLimits(now) {
    for (const [key, row] of this.rateLimitBuckets) if (row.resetAt <= now.getTime()) this.rateLimitBuckets.delete(key);
  }
  async learningRecords(userId) {
    return (await this.conversations(userId)).map((conversation) => ({
      conversation: structuredClone(conversation),
      turns: structuredClone(this.turns.get(conversation.id) ?? []),
      assessment: structuredClone(this.assessmentRows.get(conversation.id) ?? null)
    }));
  }
  async measuredVoiceSessions(userId) {
    return [...this.voiceSessions.values()].filter((session) => session.userId === userId && ["ended", "expired"].includes(session.status)).map((session) => ({
      conversationId: session.conversationId,
      startedAt: session.startedAt,
      consumedSeconds: this.reservations.get(session.reservationId)?.consumedSeconds ?? null
    }));
  }
  usageLocks = /* @__PURE__ */ new Map();
  accounts = /* @__PURE__ */ new Map();
  emailTokens = /* @__PURE__ */ new Map();
  oauthIdentities = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  profiles = /* @__PURE__ */ new Map();
  reservations = /* @__PURE__ */ new Map();
  monthlyVoiceUsage = /* @__PURE__ */ new Map();
  conversationRows = /* @__PURE__ */ new Map();
  turns = /* @__PURE__ */ new Map();
  assessmentRows = /* @__PURE__ */ new Map();
  assessmentUsageRows = /* @__PURE__ */ new Map();
  assessmentRunRows = /* @__PURE__ */ new Map();
  scenarioRows = /* @__PURE__ */ new Map();
  scenarioRevisionRows = /* @__PURE__ */ new Map();
  entitlements = /* @__PURE__ */ new Map();
  purchaseIntents = /* @__PURE__ */ new Map();
  voiceSessions = /* @__PURE__ */ new Map();
  async ready() {
  }
  async createAccount(email, passwordHash, legalAcceptance) {
    if ([...this.accounts.values()].some((account2) => account2.email === email)) throw new ConflictError();
    const account = {
      id: randomUUID8(),
      email,
      passwordHash,
      role: "learner",
      emailVerifiedAt: null,
      legalVersion: legalAcceptance?.version ?? null,
      legalAcceptedAt: legalAcceptance?.acceptedAt ?? null
    };
    this.accounts.set(account.id, account);
    return { ...account };
  }
  async markEmailVerified(userId, now) {
    const user = this.accounts.get(userId);
    if (!user) throw new Error("Account not found");
    user.emailVerifiedAt ??= now;
    return user;
  }
  async issueEmailToken(token, hourlyLimit) {
    return this.withUsageLock(`account:${token.userId}`, async () => {
      const since = token.createdAt.getTime() - 36e5;
      const count = [...this.emailTokens.values()].filter(
        (item) => item.userId === token.userId && item.purpose === token.purpose && item.createdAt.getTime() > since
      ).length;
      if (count >= hourlyLimit || !this.accounts.has(token.userId)) return false;
      this.emailTokens.set(token.tokenHash, token);
      return true;
    });
  }
  async consumeEmailToken(hash, purpose, now, userId, newPasswordHash) {
    const candidate = this.emailTokens.get(hash);
    if (!candidate) return null;
    return this.withUsageLock(`account:${candidate.userId}`, async () => {
      const token = this.emailTokens.get(hash);
      if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= now) return null;
      if (userId && token.userId !== userId) return null;
      const user = this.accounts.get(token.userId);
      if (!user || purpose === "password_reset" && !newPasswordHash) return null;
      const wasVerified = Boolean(user.emailVerifiedAt);
      token.usedAt = now;
      user.emailVerifiedAt ??= now;
      if (purpose === "password_reset") {
        user.passwordHash = newPasswordHash;
        await this.deleteSessions(user.id);
        if (!wasVerified) {
          for (const [key, identity] of this.oauthIdentities) {
            if (identity.userId === user.id) this.oauthIdentities.delete(key);
          }
        }
        for (const item of this.emailTokens.values()) if (item.userId === user.id) item.usedAt = now;
      }
      return user;
    });
  }
  async accountByEmail(email) {
    const user = [...this.accounts.values()].find((account) => account.email === email);
    return user ? { ...user } : null;
  }
  async accountById(id) {
    const user = this.accounts.get(id);
    return user ? { ...user } : null;
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
  async createSession(session, expectedPasswordHash) {
    await this.withUsageLock(`account:${session.userId}`, async () => {
      const user = this.accounts.get(session.userId);
      if (!user || expectedPasswordHash && !safeEqual(user.passwordHash, expectedPasswordHash)) {
        throw new ConflictError("Account credentials changed. Please sign in again.");
      }
      this.sessions.set(session.tokenHash, session);
    });
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
    for (const [hash, token] of this.emailTokens) if (token.userId === userId) this.emailTokens.delete(hash);
    this.profiles.delete(userId);
    for (const [id, run] of this.assessmentRunRows) if (run.userId === userId) this.assessmentRunRows.delete(id);
    for (const [key, identity] of this.oauthIdentities) if (identity.userId === userId) this.oauthIdentities.delete(key);
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
    for (const [id, reservation] of this.reservations) if (reservation.userId === userId) this.reservations.delete(id);
    for (const [key] of this.monthlyVoiceUsage) if (key.startsWith(`${userId}:`)) this.monthlyVoiceUsage.delete(key);
    for (const [id, conversation] of this.conversationRows) {
      if (conversation.userId !== userId) continue;
      this.conversationRows.delete(id);
      this.turns.delete(id);
      this.assessmentRows.delete(id);
      for (const [key, usage] of this.assessmentUsageRows) {
        if (usage.conversationId === id) this.assessmentUsageRows.delete(key);
      }
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
  async withUsageLock(key, operation) {
    const previous = this.usageLocks.get(key) ?? Promise.resolve();
    let release = () => {
    };
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.usageLocks.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.usageLocks.get(key) === current) this.usageLocks.delete(key);
    }
  }
  async reservationSeconds(reservationId) {
    return this.reservations.get(reservationId)?.seconds ?? null;
  }
  async reserveUsage(reservation, allowanceSeconds) {
    const key = `${reservation.userId}:${reservation.dayKey}`;
    await this.withUsageLock(key, async () => {
      const usage = await this.usage(reservation.userId, reservation.dayKey);
      if (usage.reservedSeconds + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
      this.reservations.set(reservation.id, { ...reservation, consumedSeconds: 0 });
    });
  }
  async settleUsage(reservationId, consumedSeconds) {
    const row = this.reservations.get(reservationId);
    if (!row) throw new Error("Usage reservation not found");
    row.consumedSeconds = Math.min(consumedSeconds, row.seconds);
    row.seconds = row.consumedSeconds;
  }
  async voiceMonthUsage(userId, monthKey2) {
    const usage = this.monthlyVoiceUsage.get(`${userId}:${monthKey2}`);
    return { userId, monthKey: monthKey2, sessionsUsed: usage?.sessionsUsed ?? 0, consumedSeconds: usage?.consumedSeconds ?? 0 };
  }
  async totalVoiceSessions(userId) {
    return [...this.monthlyVoiceUsage.entries()].filter(([key]) => key.startsWith(`${userId}:`)).reduce((total, [, usage]) => total + usage.sessionsUsed, 0);
  }
  async reserveVoiceSession(userId, monthKey2, sessionLimit, lifetimeLimit) {
    const lockScope = lifetimeLimit ? "lifetime" : monthKey2;
    await this.withUsageLock(`${userId}:sessions:${lockScope}`, async () => {
      const usage = await this.voiceMonthUsage(userId, monthKey2);
      const used = lifetimeLimit ? await this.totalVoiceSessions(userId) : usage.sessionsUsed;
      if (used >= sessionLimit) throw new ConflictError("Voice session allowance is exhausted.");
      this.monthlyVoiceUsage.set(`${userId}:${monthKey2}`, { ...usage, sessionsUsed: usage.sessionsUsed + 1 });
    });
  }
  async releaseVoiceSession(userId, monthKey2, lifetimeLimit) {
    const lockScope = lifetimeLimit ? "lifetime" : monthKey2;
    await this.withUsageLock(`${userId}:sessions:${lockScope}`, async () => {
      const key = `${userId}:${monthKey2}`;
      const usage = this.monthlyVoiceUsage.get(key);
      if (usage) usage.sessionsUsed = Math.max(0, usage.sessionsUsed - 1);
    });
  }
  async createConversation(conversation) {
    this.conversationRows.set(conversation.id, { ...conversation, currentPhase: conversation.currentPhase ?? "primary" });
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
  async claimConversationCompletion(userId, id) {
    return this.withUsageLock(`conversation:${id}`, async () => {
      const row = this.conversationRows.get(id);
      if (row?.userId !== userId || !["CREATED", "INTERRUPTED"].includes(row.state)) return false;
      row.state = "COMPLETED";
      row.updatedAt = /* @__PURE__ */ new Date();
      return true;
    });
  }
  async assessment(userId, conversationId) {
    if (this.conversationRows.get(conversationId)?.userId !== userId) return null;
    const record = this.assessmentRows.get(conversationId);
    return record ? structuredClone(record) : null;
  }
  async advanceConversation(userId, id) {
    return this.withUsageLock(`conversation:${id}`, async () => {
      const row = this.conversationRows.get(id);
      const hasPrimary = this.turns.get(id)?.some((turn) => turn.role === "user" && turn.phase === "primary");
      const activeVoice = [...this.voiceSessions.values()].some((session) => session.conversationId === id && session.status === "active");
      if (row?.userId !== userId || row.currentPhase !== "primary" || !hasPrimary || activeVoice || !["CREATED", "INTERRUPTED"].includes(row.state)) return false;
      row.currentPhase = "independent_retry";
      row.updatedAt = /* @__PURE__ */ new Date();
      return true;
    });
  }
  async appendConversationTurn(userId, turn) {
    return this.withUsageLock(`conversation:${turn.sessionId}`, async () => {
      const row = this.conversationRows.get(turn.sessionId);
      if (row?.userId !== userId) throw new Error("Conversation not found");
      if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(row.state)) throw new ConflictError("Practice is closed.");
      const saved = { ...turn, phase: row.currentPhase ?? "primary" };
      await this.addConversationTurn(saved);
      return saved;
    });
  }
  async saveAssessment(userId, assessment) {
    const record = checkedAssessment(assessment);
    await this.withUsageLock(`conversation:${record.conversationId}`, async () => {
      if (this.conversationRows.get(record.conversationId)?.userId !== userId) {
        throw new Error("Conversation not found");
      }
      if (this.assessmentRows.has(record.conversationId) || [...this.assessmentRows.values()].some((existing) => existing.id === record.id)) {
        throw new ConflictError("Assessment already exists.");
      }
      this.assessmentRows.set(record.conversationId, record);
    });
  }
  async recordAssessmentUsage(userId, usage) {
    const record = checkedAssessmentUsage(usage);
    await this.withUsageLock(`conversation:${record.conversationId}`, async () => {
      if (this.conversationRows.get(record.conversationId)?.userId !== userId) {
        throw new Error("Conversation not found");
      }
      if (record.runId) {
        const run = this.assessmentRunRows.get(record.runId);
        if (run?.userId !== userId || run.conversationId !== record.conversationId || run.status !== "running" || run.expiresAt <= record.createdAt) {
          throw new ConflictError("Assessment run is not active.");
        }
      }
      const key = `${record.conversationId}:${record.runId ?? "legacy"}:${record.attempt}`;
      if (this.assessmentUsageRows.has(key) || [...this.assessmentUsageRows.values()].some((existing) => existing.id === record.id)) {
        throw new ConflictError("Assessment attempt usage already exists.");
      }
      this.assessmentUsageRows.set(key, record);
    });
  }
  async claimAssessmentRun(userId, conversationId, now, dailyLimit) {
    return this.withUsageLock(`account:${userId}`, () => this.withUsageLock(`conversation:${conversationId}`, async () => {
      const run = newAssessmentRun(
        this.accounts.get(userId) ?? null,
        this.conversationRows.get(conversationId) ?? null,
        [...this.assessmentRunRows.values()],
        now,
        dailyLimit
      );
      const row = this.conversationRows.get(conversationId);
      this.assessmentRunRows.set(run.id, structuredClone(run));
      row.state = "ASSESSING";
      row.updatedAt = now;
      return structuredClone(run);
    }));
  }
  async finishAssessmentRun(userId, runId, assessment, now) {
    const candidate = this.assessmentRunRows.get(runId);
    if (candidate?.userId !== userId) return false;
    const checked = assessment ? checkedAssessment(assessment) : null;
    return this.withUsageLock(`conversation:${candidate.conversationId}`, async () => {
      const run = this.assessmentRunRows.get(runId);
      const row = this.conversationRows.get(candidate.conversationId);
      if (!run || run.status !== "running" || row?.userId !== userId) return false;
      if (checked && checked.conversationId !== row.id) throw new Error("Assessment conversation mismatch");
      const accepted = Boolean(checked && run.expiresAt > now && row.state === "ASSESSING");
      if (accepted) {
        if (this.assessmentRows.has(row.id) || [...this.assessmentRows.values()].some((existing) => existing.id === checked.id)) {
          throw new ConflictError("Assessment already exists.");
        }
        this.assessmentRows.set(row.id, checked);
      }
      run.status = accepted ? "succeeded" : "failed";
      run.finishedAt = now;
      if (row.state === "ASSESSING") {
        row.state = accepted ? "FEEDBACK_READY" : "FAILED";
        row.updatedAt = now;
      }
      return checked ? accepted : true;
    });
  }
  async expireAssessmentRuns(now) {
    let expired = 0;
    for (const run of this.assessmentRunRows.values()) {
      if (run.status === "running" && run.expiresAt <= now) {
        if (await this.finishAssessmentRun(run.userId, run.id, null, now)) expired += 1;
      }
    }
    for (const row of this.conversationRows.values()) {
      await this.withUsageLock(`conversation:${row.id}`, async () => {
        const hasRun = [...this.assessmentRunRows.values()].some((run) => run.conversationId === row.id);
        const saved = this.assessmentRows.has(row.id);
        if (row.state === "FAILED" && !hasRun && saved) {
          row.state = "FEEDBACK_READY";
          row.updatedAt = now;
          expired += 1;
        }
        if (row.state === "ASSESSING" && !hasRun && row.updatedAt.getTime() <= now.getTime() - assessmentLeaseMs) {
          row.state = saved ? "FEEDBACK_READY" : "FAILED";
          row.updatedAt = now;
          expired += 1;
        }
      });
    }
    return expired;
  }
  async settleAssessmentUsage(userId, usage) {
    const record = checkedAssessmentUsage(usage);
    await this.withUsageLock(`conversation:${record.conversationId}`, async () => {
      const key = `${record.conversationId}:${record.runId ?? "legacy"}:${record.attempt}`;
      const existing = this.assessmentUsageRows.get(key);
      if (this.conversationRows.get(record.conversationId)?.userId !== userId || existing?.id !== record.id || existing.modelVersion !== record.modelVersion) throw new Error("Assessment usage not found");
      if (existing.inputTokens !== null) return;
      this.assessmentUsageRows.set(key, { ...record, createdAt: existing.createdAt });
    });
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
    this.scenarioRevisionRows.set(scenario.id, [{ id: randomUUID8(), scenarioId: scenario.id, version: 1, scenario, changedBy: scenario.ownerId ?? null, createdAt: /* @__PURE__ */ new Date() }]);
  }
  async reviewCustomScenario(id, status, reviewerId, reviewedAt) {
    const scenario = this.scenarioRows.get(id);
    if (!scenario) return null;
    const reviewed = { ...scenario, reviewStatus: status, reviewedBy: reviewerId, reviewedAt: reviewedAt.toISOString() };
    this.scenarioRows.set(id, reviewed);
    const revisions = this.scenarioRevisionRows.get(id) ?? [];
    revisions.push({ id: randomUUID8(), scenarioId: id, version: revisions.length + 1, scenario: reviewed, changedBy: reviewerId, createdAt: reviewedAt });
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
    revisions.push({ id: randomUUID8(), scenarioId: id, version: revisions.length + 1, scenario: rolledBack, changedBy: reviewerId, createdAt: reviewedAt });
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
    if ([...this.voiceSessions.values()].some((item) => item.userId === session.userId && item.status === "active")) {
      throw new ConflictError("Another voice session is already active.");
    }
    this.voiceSessions.set(session.id, session);
  }
  async voiceSession(userId, id) {
    const session = this.voiceSessions.get(id);
    return session?.userId === userId ? session : null;
  }
  async activeVoiceSession(userId) {
    return [...this.voiceSessions.values()].find((session) => session.userId === userId && session.status === "active") ?? null;
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
  async endVoiceSession(userId, id, endedAt, status, consumedSeconds) {
    const session = await this.voiceSession(userId, id);
    if (!session) throw new Error("Voice session not found");
    if (session.status !== "active") throw new ConflictError("Voice session is already closed.");
    const reservation = this.reservations.get(session.reservationId);
    if (!reservation) throw new Error("Usage reservation not found");
    const chargedSeconds = Math.min(consumedSeconds, reservation.seconds);
    reservation.seconds = chargedSeconds;
    reservation.consumedSeconds = chargedSeconds;
    const usageKey = `${userId}:${session.monthKey}`;
    const monthly = this.monthlyVoiceUsage.get(usageKey) ?? { sessionsUsed: 0, consumedSeconds: 0 };
    monthly.consumedSeconds += chargedSeconds;
    this.monthlyVoiceUsage.set(usageKey, monthly);
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
      if (reservation) {
        const consumedSeconds = elapsedSeconds(session.startedAt, session.expiresAt, reservation.seconds);
        reservation.seconds = consumedSeconds;
        reservation.consumedSeconds = consumedSeconds;
        const usageKey = `${session.userId}:${session.monthKey}`;
        const usage = this.monthlyVoiceUsage.get(usageKey) ?? { sessionsUsed: 0, consumedSeconds: 0 };
        usage.consumedSeconds += consumedSeconds;
        this.monthlyVoiceUsage.set(usageKey, usage);
      }
      const conversation = this.conversationRows.get(session.conversationId);
      if (conversation?.state === "ACTIVE") {
        conversation.state = "INTERRUPTED";
        conversation.updatedAt = now;
      }
      expired += 1;
    }
    return expired;
  }
};

// src/config.ts
function productionConfigurationErrors(config) {
  if (config.vercel && config.nodeEnv !== "production") return ["Vercel deployments must use NODE_ENV=production."];
  if (config.nodeEnv !== "production") return [];
  const errors = [];
  if (config.vercel && config.rateLimitStorage !== "postgres") {
    errors.push("Vercel production requires shared PostgreSQL rate limiting.");
  }
  if (config.vercel && (!config.cronSecret || config.cronSecret.length < 32)) {
    errors.push("Vercel production requires CRON_SECRET with at least 32 characters.");
  }
  if (!config.emailSenderConfigured) errors.push("Configure EMAIL_PROVIDER=resend, RESEND_API_KEY and EMAIL_FROM in production.");
  if (!config.emailLinkBaseUrl || !/^https:\/\/[^\s?#]+$/.test(config.emailLinkBaseUrl)) {
    errors.push("ACCOUNT_EMAIL_LINK_BASE_URL must be a production HTTPS app-link or web origin.");
  }
  if (config.microsoftClientIds?.some((id) => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) {
    errors.push("MICROSOFT_OAUTH_CLIENT_IDS must contain Microsoft application UUIDs.");
  }
  const documentationPlaceholder = /(^|[.@])example\.(com|org|net)(?=[:/]|$)/i;
  if (config.devMemoryStore) errors.push("DEV_MEMORY_STORE must be false in production.");
  if (!config.databaseUrl || config.databaseUrl.includes("replace-with-") || documentationPlaceholder.test(config.databaseUrl) || !/^postgres(?:ql)?:\/\//.test(config.databaseUrl)) errors.push("DATABASE_URL must point to the production PostgreSQL database.");
  if (config.corsOrigins.length === 0 || config.corsOrigins.some((origin) => !origin.startsWith("https://") || origin.includes("localhost") || origin.includes("127.0.0.1"))) errors.push("CORS_ORIGINS must contain only HTTPS production origins.");
  if (config.managerEmails.length === 0) errors.push("MANAGER_EMAILS must contain at least one manager account.");
  if (config.managerEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /(^|\.)example\.(com|org|net)$/i.test(email.split("@")[1] ?? ""))) errors.push("MANAGER_EMAILS must contain valid manager email addresses.");
  if (config.googleClientIds?.some((id) => !id.trim() || id.startsWith("replace-with-") || ["android-client-id", "ios-client-id", "web-client-id"].includes(id))) errors.push("GOOGLE_OAUTH_CLIENT_IDS must contain valid production Google client IDs when Google sign-in is enabled.");
  if (config.realtimeEnabled && !config.realtimeApiKey) errors.push("OPENAI_API_KEY is required when OPENAI_REALTIME_ENABLED=true.");
  if (config.assessmentEnabled && !config.assessmentApiKey) {
    errors.push("OPENAI_API_KEY is required when ASSESSMENT_ENABLED=true.");
  }
  if (config.billingEnabled) {
    if (!config.billingWebhookSecret || config.billingWebhookSecret.startsWith("replace-with-")) errors.push("BILLING_WEBHOOK_SECRET must be configured when BILLING_ENABLED=true.");
    if ((config.billingProviders ?? ["apple", "google"]).includes("google") && (!config.googleNotificationAudience || !/^https:\/\//.test(config.googleNotificationAudience) || config.googleNotificationAudience.startsWith("replace-with-") || documentationPlaceholder.test(config.googleNotificationAudience))) {
      errors.push("GOOGLE_PUBSUB_AUDIENCE must be configured for verified Google Pub/Sub pushes.");
    }
    if (!config.billingProductMap) errors.push("BILLING_PRODUCT_MAP must be configured when BILLING_ENABLED=true.");
    if (!config.storeVerifierConfigured) {
      errors.push("Store verifier credentials for every enabled BILLING_PROVIDERS entry must be configured.");
    }
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
      const expiresAt = dateFromMilliseconds(transaction.expiresDate);
      if (!expiresAt || !Number.isFinite(expiresAt.getTime())) return null;
      return {
        productId: transaction.productId,
        transactionId: transaction.transactionId,
        originalTransactionId: transaction.originalTransactionId ?? null,
        purchaseToken: input.purchaseToken,
        status: entitlementStatus(expiresAt, transaction.revocationDate !== void 0, now()),
        environment: transaction.environment === Environment.SANDBOX ? "sandbox" : "production",
        expiresAt,
        providerEventDate: dateFromMilliseconds(transaction.signedDate),
        accountToken: transaction.appAccountToken ?? null
      };
    }
    if (!googleAuth || !config.google) return null;
    const client = await googleAuth.getClient();
    const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.google.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(input.purchaseToken)}`;
    const response = await fetch(endpoint, { headers: await client.getRequestHeaders(endpoint) });
    if (!response.ok) return null;
    return verifiedGoogleSubscription(await response.json(), input, now());
  };
}
function verifiedGoogleSubscription(purchase, input, now) {
  const lineItem = purchase.lineItems?.find((item) => item.productId === input.productId);
  if (!lineItem?.productId || !lineItem.expiryTime || !lineItem.latestSuccessfulOrderId) return null;
  const expiresAt = new Date(lineItem.expiryTime);
  if (!Number.isFinite(expiresAt.getTime())) return null;
  const state = purchase.subscriptionState;
  if (!state || state === "SUBSCRIPTION_STATE_PENDING" || state === "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED") return null;
  const activeStates = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"];
  const status = activeStates.includes(state) ? entitlementStatus(expiresAt, false, now) : "revoked";
  return {
    productId: lineItem.productId,
    transactionId: lineItem.latestSuccessfulOrderId,
    originalTransactionId: input.purchaseToken,
    purchaseToken: input.purchaseToken,
    status,
    environment: purchase.testPurchase ? "sandbox" : "production",
    expiresAt,
    providerEventDate: null,
    accountToken: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null
  };
}
function createStorePurchaseVerifierFromEnv(env2) {
  const providers = billingProvidersSchema.parse(env2.BILLING_PROVIDERS);
  const apple = providers.includes("apple") ? appleConfigFromEnv(env2) : void 0;
  const googleConfigured = providers.includes("google") && env2.GOOGLE_PLAY_PACKAGE_NAME && env2.GOOGLE_SERVICE_ACCOUNT_EMAIL && env2.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!apple && !googleConfigured) return void 0;
  return createStorePurchaseVerifier({
    apple,
    google: googleConfigured ? { packageName: env2.GOOGLE_PLAY_PACKAGE_NAME, serviceAccountEmail: env2.GOOGLE_SERVICE_ACCOUNT_EMAIL, privateKey: env2.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY } : void 0
  });
}
function createAppleNotificationVerifierFromEnv(env2) {
  if (!billingProvidersSchema.parse(env2.BILLING_PROVIDERS).includes("apple")) return void 0;
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
var env = runtimeEnvironmentSchema.parse(process.env);
if (!env.DEV_MEMORY_STORE && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required unless DEV_MEMORY_STORE=true");
}
var storeVerifierConfigured = storeCredentialsConfigured(process.env, env.BILLING_PROVIDERS);
var splitList = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
var googleClientIds = splitList(env.GOOGLE_OAUTH_CLIENT_IDS);
var microsoftClientIds = splitList(env.MICROSOFT_OAUTH_CLIENT_IDS);
var emailSender = createEmailSender();
var supabaseOAuth = {
  enabled: env.SUPABASE_OAUTH_ENABLED,
  url: env.SUPABASE_URL,
  publishableKey: env.SUPABASE_PUBLISHABLE_KEY
};
if (supabaseOAuth.enabled && !supabaseOAuthConfigured(supabaseOAuth)) {
  throw new Error("Configure a hosted SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before enabling Supabase OAuth.");
}
var productionErrors = productionConfigurationErrors({
  vercel: env.VERCEL === "1",
  rateLimitStorage: env.DEV_MEMORY_STORE ? "memory" : "postgres",
  cronSecret: env.CRON_SECRET,
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  devMemoryStore: env.DEV_MEMORY_STORE,
  corsOrigins: splitList(env.CORS_ORIGINS),
  managerEmails: splitList(env.MANAGER_EMAILS),
  googleClientIds,
  microsoftClientIds,
  emailSenderConfigured: emailSender !== null,
  emailLinkBaseUrl: process.env.ACCOUNT_EMAIL_LINK_BASE_URL,
  realtimeEnabled: env.OPENAI_REALTIME_ENABLED,
  realtimeApiKey: env.OPENAI_API_KEY,
  assessmentEnabled: env.ASSESSMENT_ENABLED,
  assessmentApiKey: env.OPENAI_API_KEY,
  billingEnabled: env.BILLING_ENABLED,
  billingWebhookSecret: env.BILLING_WEBHOOK_SECRET,
  billingProviders: env.BILLING_PROVIDERS,
  googleNotificationAudience: env.GOOGLE_PUBSUB_AUDIENCE,
  billingProductMap: env.BILLING_PRODUCT_MAP,
  storeVerifierConfigured
});
var launchGated = process.env.LAUNCH_GATED === "true";
var gatedOptionalErrors = [
  "Vercel production requires CRON_SECRET",
  "Configure EMAIL_PROVIDER=resend",
  "ACCOUNT_EMAIL_LINK_BASE_URL"
];
var blockingProductionErrors = launchGated ? productionErrors.filter((error) => !gatedOptionalErrors.some((prefix) => error.startsWith(prefix))) : productionErrors;
if (blockingProductionErrors.length > 0) {
  throw new Error(`Production configuration is invalid:
- ${blockingProductionErrors.join("\n- ")}`);
}
var storePurchaseVerifier = createStorePurchaseVerifierFromEnv(process.env);
var appleNotificationVerifier = createAppleNotificationVerifierFromEnv(process.env);
var googlePubSubAuthenticator = createGooglePubSubAuthenticatorFromEnv(process.env);
var database = env.DEV_MEMORY_STORE ? null : new PrismaClient2();
var store = env.DEV_MEMORY_STORE ? new MemoryStore() : prismaStore(database);
var app = await buildApp(store, {
  runtime: env.RUNTIME,
  cronSecret: env.CRON_SECRET,
  assessment: {
    enabled: env.ASSESSMENT_ENABLED,
    apiKey: env.OPENAI_API_KEY,
    model: env.ASSESSMENT_MODEL,
    dailyLimit: env.ASSESSMENT_DAILY_LIMIT,
    inputMicrosPerMillion: env.ASSESSMENT_INPUT_MICROS_PER_MILLION,
    outputMicrosPerMillion: env.ASSESSMENT_OUTPUT_MICROS_PER_MILLION
  },
  logger: true,
  origins: splitList(env.CORS_ORIGINS),
  oauth: { googleClientIds, microsoftClientIds, supabase: supabaseOAuth },
  email: { sender: emailSender },
  billing: {
    enabled: env.BILLING_ENABLED,
    webhookSecret: env.BILLING_WEBHOOK_SECRET,
    providers: env.BILLING_PROVIDERS,
    googleNotificationSecret: env.GOOGLE_PUBSUB_WEBHOOK_SECRET,
    verifyGoogleNotificationRequest: googlePubSubAuthenticator,
    verifyPurchase: storePurchaseVerifier,
    verifyAppleNotification: appleNotificationVerifier
  }
});

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
