import { PrismaClient } from "@prisma/client";
import { runtimeEnvironmentSchema } from "./runtime-env";
import { buildApp } from "./app";
import { prismaStore } from "./prisma-store";
import { MemoryStore } from "./memory-store";
import { productionConfigurationErrors } from "./config";
import { storeCredentialsConfigured } from "./billing-configuration";
import { createEmailSender } from "./email-sender";
import { supabaseOAuthConfigured } from "./lib/supabase-oauth";
import {
  createAppleNotificationVerifierFromEnv, createGooglePubSubAuthenticatorFromEnv, createStorePurchaseVerifierFromEnv,
} from "./store-verifier";

process.env.DATABASE_URL ??= process.env.Communicatio_Caoch_DATABASE_URL;
const env = runtimeEnvironmentSchema.parse(process.env);
if (!env.DEV_MEMORY_STORE && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required unless DEV_MEMORY_STORE=true");
}
const storeVerifierConfigured = storeCredentialsConfigured(process.env, env.BILLING_PROVIDERS);
const splitList = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
const googleClientIds = splitList(env.GOOGLE_OAUTH_CLIENT_IDS);
const microsoftClientIds = splitList(env.MICROSOFT_OAUTH_CLIENT_IDS);
const emailSender = createEmailSender();
const supabaseOAuth = {
  enabled: env.SUPABASE_OAUTH_ENABLED,
  url: env.SUPABASE_URL,
  publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
};
if (supabaseOAuth.enabled && !supabaseOAuthConfigured(supabaseOAuth)) {
  throw new Error("Configure a hosted SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before enabling Supabase OAuth.");
}
const productionErrors = productionConfigurationErrors({
  vercel: env.VERCEL === "1", rateLimitStorage: env.DEV_MEMORY_STORE ? "memory" : "postgres", cronSecret: env.CRON_SECRET,
  nodeEnv: env.NODE_ENV, databaseUrl: env.DATABASE_URL, devMemoryStore: env.DEV_MEMORY_STORE,
  corsOrigins: splitList(env.CORS_ORIGINS), managerEmails: splitList(env.MANAGER_EMAILS),
  googleClientIds, microsoftClientIds, emailSenderConfigured: emailSender !== null,
  emailLinkBaseUrl: process.env.ACCOUNT_EMAIL_LINK_BASE_URL,
  realtimeEnabled: env.OPENAI_REALTIME_ENABLED, realtimeApiKey: env.OPENAI_API_KEY,
  assessmentEnabled: env.ASSESSMENT_ENABLED, assessmentApiKey: env.OPENAI_API_KEY,
  billingEnabled: env.BILLING_ENABLED, billingWebhookSecret: env.BILLING_WEBHOOK_SECRET,
  billingProviders: env.BILLING_PROVIDERS,
  googleNotificationAudience: env.GOOGLE_PUBSUB_AUDIENCE, billingProductMap: env.BILLING_PRODUCT_MAP,
  storeVerifierConfigured,
});
const launchGated = process.env.LAUNCH_GATED === "true";
const gatedOptionalErrors = [
  "Vercel production requires CRON_SECRET",
  "Configure EMAIL_PROVIDER=resend",
  "ACCOUNT_EMAIL_LINK_BASE_URL",
];
const blockingProductionErrors = launchGated
  ? productionErrors.filter(error => !gatedOptionalErrors.some(prefix => error.startsWith(prefix)))
  : productionErrors;
if (blockingProductionErrors.length > 0) {
  throw new Error(`Production configuration is invalid:\n- ${blockingProductionErrors.join("\n- ")}`);
}
const storePurchaseVerifier = createStorePurchaseVerifierFromEnv(process.env);
const appleNotificationVerifier = createAppleNotificationVerifierFromEnv(process.env);
const googlePubSubAuthenticator = createGooglePubSubAuthenticatorFromEnv(process.env);
const database = env.DEV_MEMORY_STORE ? null : new PrismaClient();
const store = env.DEV_MEMORY_STORE ? new MemoryStore() : prismaStore(database!);
if (env.DEV_MEMORY_STORE) {
  const { hashPassword } = await import("./password");
  const user = await store.createAccount("soma.kiran20@gmail.com", await hashPassword("Password12345678"), { version: "2026-10-10", acceptedAt: new Date() });
  await store.markEmailVerified(user.id, new Date());
  await store.saveProfile(user.id, {
    displayName: "Soma Kiran",
    primaryLanguage: "English",
    coachingLanguage: "English",
    function: "Engineering",
    jobTitle: "Engineering Leader",
    careerLevel: "Executive",
    industry: "Technology",
    audience: "Executive leadership and global engineering teams",
    situations: "Strategic alignment and technical vision",
    goal: "Explain ideas clearly",
    challenges: "Concise executive summaries",
    practiceMinutes: 10,
    planId: "professional",
    timezone: "Asia/Kolkata",
    reducedMotion: false,
  });
  await store.saveEntitlement({
    id: "seed-entitlement-soma",
    userId: user.id,
    provider: "apple",
    productId: "com.communicationcoach.professional.monthly",
    transactionId: "seed-tx-soma",
    originalTransactionId: "seed-tx-soma",
    purchaseToken: "seed-token-soma",
    status: "active",
    environment: "sandbox",
    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    providerEventDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
export const app = await buildApp(store, {
  runtime: env.RUNTIME, cronSecret: env.CRON_SECRET,
  assessment: {
    enabled: env.ASSESSMENT_ENABLED, apiKey: env.OPENAI_API_KEY, model: env.ASSESSMENT_MODEL,
    dailyLimit: env.ASSESSMENT_DAILY_LIMIT,
    inputMicrosPerMillion: env.ASSESSMENT_INPUT_MICROS_PER_MILLION,
    outputMicrosPerMillion: env.ASSESSMENT_OUTPUT_MICROS_PER_MILLION,
  },
  logger: true, origins: splitList(env.CORS_ORIGINS),
  oauth: { googleClientIds, microsoftClientIds, supabase: supabaseOAuth }, email: { sender: emailSender },
  billing: {
    enabled: env.BILLING_ENABLED, webhookSecret: env.BILLING_WEBHOOK_SECRET,
    providers: env.BILLING_PROVIDERS,
    googleNotificationSecret: env.GOOGLE_PUBSUB_WEBHOOK_SECRET,
    verifyGoogleNotificationRequest: googlePubSubAuthenticator,
    verifyPurchase: storePurchaseVerifier, verifyAppleNotification: appleNotificationVerifier,
  },
});
export { database };

