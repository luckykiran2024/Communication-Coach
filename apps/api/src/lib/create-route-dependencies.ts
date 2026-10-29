import { randomBytes } from "node:crypto";
import { plansSchema, scenarios } from "@coach/core";
import planData from "../../config/plans.json" with { type: "json" };
import type { Store } from "../store";
import { hashPassword } from "../password";
import { RealtimeVoiceProvider } from "../realtime-voice-provider";
import { learnerScenarioProgress } from "./progress";
import type { BuildAppOptions, RouteDependencies } from "../routes/context";
import { createEmailSender } from "../email-sender";
import { OpenAIAssessmentProvider } from "../assessment-provider";
import { billingProvidersSchema } from "../billing-configuration";

function billingProductMap(value: string | undefined) {
  if (!value) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export async function createRouteDependencies(store: Store, options: BuildAppOptions): Promise<RouteDependencies> {
  const now = options.now ?? (() => new Date());
  const assessmentEnabled = options.assessment?.enabled ?? process.env.ASSESSMENT_ENABLED === "true";
  const assessmentKey = options.assessment?.apiKey ?? process.env.OPENAI_API_KEY;
  const assessmentModel = options.assessment?.model ?? process.env.ASSESSMENT_MODEL ?? "gpt-5-mini";
  const assessmentProvider = !assessmentEnabled ? null : options.assessment?.provider ?? (assessmentKey
    ? new OpenAIAssessmentProvider({
      apiKey: assessmentKey, inputMicrosPerMillion: options.assessment?.inputMicrosPerMillion,
      outputMicrosPerMillion: options.assessment?.outputMicrosPerMillion,
    }) : null);
  const plans = plansSchema.parse(planData);
  const freePlan = plans.find(plan => plan.id === "free")!;
  const dummyHash = await hashPassword(randomBytes(32).toString("hex"));
  const availableScenarios = async () => [...scenarios, ...(await store.customScenarios())];
  const configuredManagerKey = process.env.MANAGER_SCENARIO_KEY ?? (process.env.NODE_ENV === "production" ? "" : "development-manager-key");
  const configuredManagerEmails = new Set(
    (options.managerEmails ?? (process.env.MANAGER_EMAILS ?? "").split(","))
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const billingEnabled = options.billing?.enabled ?? process.env.BILLING_ENABLED === "true";
  const billingWebhookSecret = options.billing?.webhookSecret ?? process.env.BILLING_WEBHOOK_SECRET ?? "";
  const googleNotificationSecret = options.billing?.googleNotificationSecret
    ?? process.env.GOOGLE_PUBSUB_WEBHOOK_SECRET
    ?? billingWebhookSecret;
  const configuredBillingProductMap = options.billing?.productMap ?? billingProductMap(process.env.BILLING_PRODUCT_MAP);
  const realtimeEnabled = options.voice?.enabled ?? process.env.OPENAI_REALTIME_ENABLED === "true";
  const realtimeApiKey = options.voice?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
  const realtimeConfigured = realtimeEnabled && realtimeApiKey.length > 0;
  const realtimeModel = options.voice?.model ?? process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1-mini";
  const realtimeProvider = realtimeConfigured
    ? new RealtimeVoiceProvider({
      apiKey: realtimeApiKey,
      model: realtimeModel,
      voice: options.voice?.voice ?? process.env.OPENAI_REALTIME_VOICE ?? "marin",
      fetchImpl: options.voice?.fetchImpl,
    })
    : null;

  function planForProduct(productId: string) {
    const configuredPlanId = configuredBillingProductMap[productId];
    const plan = plans.find(item => item.id === configuredPlanId);
    if (plan) return plan;
    if (process.env.NODE_ENV === "production") return undefined;
    return plans.find(item => productId.endsWith(`.${item.id}.monthly`) || productId.endsWith(`.${item.id}`));
  }
  async function activePlan(userId: string) {
    const reviewerEmails = new Set((process.env.PLAY_REVIEWER_EMAILS ?? "")
      .split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
    if (reviewerEmails.size > 0) {
      const reviewer = await store.accountById(userId);
      if (reviewer && reviewerEmails.has(reviewer.email.toLowerCase())) {
        return plans.find(plan => plan.id === "executive") ?? freePlan;
      }
    }
    if (!billingEnabled) {
      const isolatedTest = process.env.COACH_TEST_BACKEND === "true"
        && process.env.VERCEL_PROJECT_ID === "prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf" && !assessmentEnabled && !realtimeEnabled;
      if ((process.env.NODE_ENV === "production" || process.env.VERCEL === "1") && !isolatedTest) return freePlan;
      const devPlanId = options.devPlanId ?? process.env.DEV_PLAN_ID ?? "executive";
      return plans.find(plan => plan.id === devPlanId) ?? freePlan;
    }
    const entitlement = await store.entitlement(userId);
    if (!entitlement || entitlement.status !== "active" || (entitlement.expiresAt && entitlement.expiresAt <= now())) return freePlan;
    return planForProduct(entitlement.productId) ?? freePlan;
  }
  async function reapVoiceSessions() {
    await store.expireAssessmentRuns(now());
    await store.expireVoiceSessions(now());
    if (!realtimeProvider) return;
    const pending = await store.pendingVoiceProviderCalls();
    await Promise.all(pending.map(async session => {
      if (!session.providerCallId) return;
      try {
        await realtimeProvider.terminate(session.providerCallId);
        await store.markVoiceProviderTerminated(session.id, now());
      } catch {
        return;
      }
    }));
  }

  return {
    store,
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
    assessmentEnabled, assessmentProvider, assessmentModel,
    assessmentTimeoutMs: Math.min(30000, Math.max(1, options.assessment?.timeoutMs ?? 30000)),
    assessmentDailyLimit: options.assessment?.dailyLimit ?? Number(process.env.ASSESSMENT_DAILY_LIMIT ?? 10),
    reapVoiceSessions,
    activePlan,
    planForProduct,
    learnerScenarioProgress: (userId, profile) => learnerScenarioProgress(store, userId, profile, assessmentEnabled),
  };
}
