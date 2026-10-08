import { existsSync } from "node:fs";
import { planIds, scenarios } from "@coach/core";
import { contentCatalogReady, loadContentReviewEvidence } from "./content-release";
import { loadNativeQaEvidence } from "./native-qa";

type CheckStatus = "PASS" | "BLOCKED" | "MANUAL";
type Check = { name: string; status: CheckStatus; detail: string };

function configuredValue(value: string) {
  return value.length > 0 && !value.startsWith("replace-with-") && !/(^|[.@])example\.(com|org|net)(?=[:/]|$)/i.test(value) && !["android-client-id", "ios-client-id", "web-client-id"].includes(value);
}

function productionValue(name: string) {
  return configuredValue(process.env[name] ?? "");
}

function validManagerAllowlist() {
  const emails = (process.env.MANAGER_EMAILS ?? "").split(",").map(email => email.trim()).filter(Boolean);
  return emails.length > 0 && emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/(^|\.)example\.(com|org|net)$/i.test(email.split("@")[1] ?? ""));
}

function validGoogleAudienceAllowlist() {
  const ids = (process.env.GOOGLE_OAUTH_CLIENT_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  return ids.length > 0 && ids.every(configuredValue);
}

function validBillingProductMap() {
  try {
    const parsed = JSON.parse(process.env.BILLING_PRODUCT_MAP ?? "") as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.length > 0 && entries.every(([product, plan]) => product.trim().length > 0 && typeof plan === "string" && planIds.includes(plan as typeof planIds[number]));
  } catch {
    return false;
  }
}

function validAppleRootCertificates() {
  const paths = (process.env.APPLE_ROOT_CERT_PATHS ?? "").split(",").map(path => path.trim()).filter(Boolean);
  return paths.length > 0 && paths.every(path => existsSync(path));
}

function validBillingConfiguration() {
  if (process.env.BILLING_ENABLED !== "true") return false;
  return productionValue("BILLING_WEBHOOK_SECRET") && productionValue("GOOGLE_PUBSUB_AUDIENCE") && /^https:\/\//.test(process.env.GOOGLE_PUBSUB_AUDIENCE ?? "") && validBillingProductMap() && productionValue("APPLE_PRIVATE_KEY") && productionValue("APPLE_KEY_ID") && productionValue("APPLE_ISSUER_ID") && productionValue("APPLE_BUNDLE_ID") && validAppleRootCertificates() && (process.env.APPLE_ENVIRONMENT === "sandbox" || productionValue("APPLE_APPLE_ID")) && productionValue("GOOGLE_PLAY_PACKAGE_NAME") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "") && productionValue("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
}

function check(name: string, status: CheckStatus, detail: string): Check {
  return { name, status, detail };
}

const checks: Check[] = [
  check("PostgreSQL", productionValue("DATABASE_URL") && /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "") ? "PASS" : "BLOCKED", productionValue("DATABASE_URL") ? "DATABASE_URL is configured; run migrations and the isolated database test." : "Set DATABASE_URL to an isolated PostgreSQL database."),
  check("Voice provider", process.env.OPENAI_REALTIME_ENABLED === "true" && productionValue("OPENAI_API_KEY") ? "PASS" : "BLOCKED", process.env.OPENAI_REALTIME_ENABLED === "true" && productionValue("OPENAI_API_KEY") ? "Server provider credentials are configured." : "Set OPENAI_REALTIME_ENABLED=true and OPENAI_API_KEY."),
  check("Store billing", validBillingConfiguration() ? "PASS" : "BLOCKED", process.env.BILLING_ENABLED === "true" ? "Billing configuration is incomplete or contains placeholders; verify product mapping, Apple roots, and Google credentials." : "Enable billing and configure the webhook secret, Pub/Sub audience, product map, Apple roots/app ID, and Google verifier credentials."),
  check("OAuth", productionValue("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID") && productionValue("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID") && productionValue("EXPO_PUBLIC_MICROSOFT_CLIENT_ID") && validGoogleAudienceAllowlist() ? "PASS" : "BLOCKED", "Production Google Android/iOS, Microsoft and server Google audience client IDs are required."),
  check("Manager authentication", validManagerAllowlist() ? "PASS" : "BLOCKED", validManagerAllowlist() ? "Manager allowlist is configured with valid email addresses." : "Set MANAGER_EMAILS to one or more valid production manager email addresses."),
  check("Native device QA", process.env.NATIVE_QA_SIGNOFF !== "true" ? "MANUAL" : loadNativeQaEvidence(process.env.NATIVE_QA_EVIDENCE_PATH).valid ? "PASS" : "BLOCKED", process.env.NATIVE_QA_SIGNOFF !== "true" ? "Physical Android and iOS development-build evidence is required." : loadNativeQaEvidence(process.env.NATIVE_QA_EVIDENCE_PATH).errors.join(" ")),
  check("Content and release", !contentCatalogReady() ? "BLOCKED" : process.env.CONTENT_RELEASE_SIGNOFF !== "true" ? "MANUAL" : loadContentReviewEvidence(process.env.CONTENT_RELEASE_EVIDENCE_PATH).valid ? "PASS" : "BLOCKED", !contentCatalogReady() ? `${scenarios.length} scenarios fail the structural release gate.` : process.env.CONTENT_RELEASE_SIGNOFF !== "true" ? `${scenarios.length} scenarios are structurally ready; human content review and release sign-off are required.` : loadContentReviewEvidence(process.env.CONTENT_RELEASE_EVIDENCE_PATH).errors.join(" ")),
];

for (const result of checks) console.log(`[${result.status}] ${result.name}: ${result.detail}`);
if (checks.some(result => result.status !== "PASS")) process.exitCode = 1;
