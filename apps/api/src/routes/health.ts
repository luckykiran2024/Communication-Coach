import type { FastifyInstance } from "fastify";
import { modules } from "@coach/core";
import type { BuildAppOptions, RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies, options: BuildAppOptions = {}) {
  app.get("/", async () => ({
    name: "Communication Coach API",
    status: "ok",
    version: "0.1.0",
    docs: "/health",
  }));
  app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await deps.store.ready();
      const capabilities = {
        assessment: deps.assessmentEnabled && Boolean(deps.assessmentProvider),
        voice: deps.realtimeConfigured,
        billing: deps.billingEnabled && Boolean(deps.billing?.verifyPurchase),
        accountEmail: Boolean(deps.emailSender) && deps.emailLinkBaseUrl.startsWith("https://"),
        identityDeletion: !deps.oauth?.supabase?.enabled || Boolean(deps.oauth.supabase.adminKey),
        moderation: deps.configuredManagerEmails.size > 0,
        scheduler: (options.runtime ?? process.env.RUNTIME) === "server"
          || (process.env.SCHEDULER_ENABLED === "true" && (options.cronSecret ?? process.env.CRON_SECRET ?? "").length >= 32),
        launchEnabled: process.env.LAUNCH_GATED !== "true",
      };
      const supabaseHost = deps.oauth?.supabase?.url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1] ?? null;
      return { status: "ready", storage: deps.store.rateLimitStorage, capabilities,
        environment: process.env.COACH_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
        supabaseProjectRef: supabaseHost, projectId: process.env.VERCEL_PROJECT_ID ?? null,
        releaseConfigured: deps.store.rateLimitStorage === "postgres" && Object.values(capabilities).every(Boolean),
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
  app.get("/v1/catalog", async () => ({
    modules,
    plans: deps.plans,
    priceNotice: deps.billingEnabled && deps.billing?.verifyPurchase && Object.keys(deps.billingProductMap).length > 0
      ? "Monthly INR reference prices. Your store shows final pricing and subscription terms before purchase."
      : "Paid subscriptions are not available yet. Free practice remains available.",
    liveVoiceAvailable: deps.realtimeConfigured,
  }));
}
