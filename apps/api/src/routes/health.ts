import type { FastifyInstance } from "fastify";
import { modules } from "@coach/core";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/health", async () => ({ status: "ok", version: "0.1.0" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await deps.store.ready();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "database_unavailable" });
    }
  });
  app.get("/v1/catalog", async () => ({
    modules,
    plans: deps.plans,
    priceNotice: "Proposed monthly INR prices. Store pricing and purchases are not configured.",
    liveVoiceAvailable: false,
  }));
}
