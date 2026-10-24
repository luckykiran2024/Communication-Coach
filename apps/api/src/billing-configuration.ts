import { z } from "zod";

export type BillingProvider = "apple" | "google";
export const billingProvidersSchema = z.enum(["google", "apple", "google,apple", "apple,google"])
  .default("google,apple").transform(value => value.split(",") as BillingProvider[]);

export function storeCredentialsConfigured(env: NodeJS.ProcessEnv, providers: BillingProvider[]) {
  const apple = Boolean(env.APPLE_PRIVATE_KEY && env.APPLE_KEY_ID && env.APPLE_ISSUER_ID && env.APPLE_BUNDLE_ID
    && env.APPLE_ROOT_CERT_PATHS && (env.APPLE_ENVIRONMENT === "sandbox" || env.APPLE_APPLE_ID));
  const google = Boolean(env.GOOGLE_PLAY_PACKAGE_NAME && env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  return providers.length > 0 && providers.every(provider => provider === "apple" ? apple : google);
}
