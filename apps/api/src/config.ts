export type ProductionConfiguration = {
  nodeEnv: string;
  databaseUrl?: string;
  devMemoryStore: boolean;
  corsOrigins: string[];
  managerEmails: string[];
  googleClientIds?: string[];
  realtimeEnabled: boolean;
  realtimeApiKey?: string;
  billingEnabled: boolean;
  billingWebhookSecret?: string;
  googleNotificationAudience?: string;
  billingProductMap?: string;
  storeVerifierConfigured: boolean;
};

export function productionConfigurationErrors(config: ProductionConfiguration) {
  if (config.nodeEnv !== "production") return [];
  const errors: string[] = [];
  const documentationPlaceholder = /(^|[.@])example\.(com|org|net)(?=[:/]|$)/i;
  if (config.devMemoryStore) errors.push("DEV_MEMORY_STORE must be false in production.");
  if (!config.databaseUrl || config.databaseUrl.includes("replace-with-") || documentationPlaceholder.test(config.databaseUrl) || !/^postgres(?:ql)?:\/\//.test(config.databaseUrl)) errors.push("DATABASE_URL must point to the production PostgreSQL database.");
  if (config.corsOrigins.length === 0 || config.corsOrigins.some(origin => !origin.startsWith("https://") || origin.includes("localhost") || origin.includes("127.0.0.1"))) errors.push("CORS_ORIGINS must contain only HTTPS production origins.");
  if (config.managerEmails.length === 0) errors.push("MANAGER_EMAILS must contain at least one manager account.");
  if (config.managerEmails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /(^|\.)example\.(com|org|net)$/i.test(email.split("@")[1] ?? ""))) errors.push("MANAGER_EMAILS must contain valid manager email addresses.");
  if (!config.googleClientIds || config.googleClientIds.length === 0 || config.googleClientIds.some(id => !id.trim() || id.startsWith("replace-with-") || ["android-client-id", "ios-client-id", "web-client-id"].includes(id))) errors.push("GOOGLE_OAUTH_CLIENT_IDS must contain the production Google client IDs.");
  if (config.realtimeEnabled && !config.realtimeApiKey) errors.push("OPENAI_API_KEY is required when OPENAI_REALTIME_ENABLED=true.");
  if (config.billingEnabled) {
    if (!config.billingWebhookSecret || config.billingWebhookSecret.startsWith("replace-with-")) errors.push("BILLING_WEBHOOK_SECRET must be configured when BILLING_ENABLED=true.");
    if (!config.googleNotificationAudience || config.googleNotificationAudience.startsWith("replace-with-") || documentationPlaceholder.test(config.googleNotificationAudience)) errors.push("GOOGLE_PUBSUB_AUDIENCE must be configured for verified Google Pub/Sub pushes.");
    if (!config.billingProductMap) errors.push("BILLING_PRODUCT_MAP must be configured when BILLING_ENABLED=true.");
    if (!config.storeVerifierConfigured) errors.push("Apple and Google store verifier credentials must be configured when BILLING_ENABLED=true.");
  }
  return errors;
}
