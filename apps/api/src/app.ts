import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ConflictError, type Store } from "./store";
import { ApiError } from "./lib/errors";
import { createRouteDependencies } from "./lib/create-route-dependencies";
import type { BuildAppOptions } from "./routes/context";
import { register as registerHealthRoutes } from "./routes/health";
import { register as registerBillingRoutes } from "./routes/billing";
import { register as registerScenarioRoutes } from "./routes/scenarios";
import { register as registerManagerRoutes } from "./routes/manager";
import { register as registerAuthRoutes } from "./routes/auth";
import { register as registerAccountSecurityRoutes } from "./routes/account-security";
import { register as registerProfileRoutes } from "./routes/profile";
import { register as registerConversationRoutes } from "./routes/conversations";
import { register as registerProgressRoutes } from "./routes/progress";
import { register as registerVoiceRoutes } from "./routes/voice";

export async function buildApp(store: Store, options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger
      ? {
        redact: ["req.headers.authorization", "req.headers.cookie"],
        serializers: { req: request => ({ method: request.method, url: request.url }) },
      }
      : false,
    bodyLimit: 16384,
    trustProxy: false,
  });
  await app.register(helmet);
  await app.register(cors, { origin: options.origins ?? ["http://localhost:3000", "http://localhost:8081"] });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  const deps = await createRouteDependencies(store, options);
  const expiryTimer = setInterval(() => { void deps.reapVoiceSessions().catch(() => undefined); }, 30_000);
  expiryTimer.unref();
  app.addHook("onClose", async () => { clearInterval(expiryTimer); });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ConflictError) {
      return reply.code(409).send({ error: error.message || "Unable to create account. Try signing in." });
    }
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: error.message });
    const failure = error instanceof Error ? error as Error & { statusCode?: number } : new Error("Unknown error");
    const status = "statusCode" in failure && typeof failure.statusCode === "number"
      && failure.statusCode >= 400 && failure.statusCode < 500
      ? failure.statusCode
      : 500;
    if (status === 500) request.log.error({ errorType: failure.name }, "Request failed");
    return reply.code(status).send({ error: status === 500 ? "Service unavailable. Please try again." : failure.message });
  });
  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });

  registerHealthRoutes(app, deps);
  registerBillingRoutes(app, deps);
  registerScenarioRoutes(app, deps);
  registerManagerRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerAccountSecurityRoutes(app, deps);
  registerProfileRoutes(app, deps);
  registerConversationRoutes(app, deps);
  registerProgressRoutes(app, deps);
  registerVoiceRoutes(app, deps);
  return app;
}
