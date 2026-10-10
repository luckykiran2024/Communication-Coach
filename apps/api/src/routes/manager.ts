import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { scenarioSchema } from "@coach/core";
import { requireManager } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

const reviewScenarioSchema = z.object({ status: z.enum(["draft", "published", "deprecated"]) }).strict();
const rollbackScenarioSchema = z.object({ revisionId: z.string().uuid() }).strict();

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.post("/v1/manager/scenarios", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a complete scenario with a valid module, goal, level and prompts.");
    const catalog = await deps.availableScenarios();
    if (catalog.some(scenario => scenario.id === parsed.data.id)) throw new ApiError(409, "A scenario with this id already exists.");
    const scenario = { ...parsed.data, reviewStatus: "draft" as const, ownerId: manager.userId, reviewedBy: null, reviewedAt: null };
    await deps.store.createCustomScenario(scenario);
    return reply.code(201).send({ scenario, message: "Scenario added to the library as a draft for review." });
  });
  app.post("/v1/manager/scenarios/:id/review", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const id = (request.params as { id?: string }).id;
    const parsed = reviewScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a scenario and a valid review status.");
    const scenario = await deps.store.reviewCustomScenario(id, parsed.data.status, manager.userId, deps.now());
    if (!scenario) throw new ApiError(404, "Scenario not found.");
    return reply.send({ scenario, message: parsed.data.status === "published" ? "Scenario published for learner practice." : `Scenario marked ${parsed.data.status}.` });
  });
  app.get("/v1/manager/scenarios/:id/revisions", async (request, reply) => {
    await requireManager(request, deps);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "Choose a scenario.");
    const revisions = await deps.store.scenarioRevisions(id);
    if (revisions.length === 0) throw new ApiError(404, "Scenario not found.");
    return reply.send({ revisions });
  });
  app.post("/v1/manager/scenarios/:id/rollback", async (request, reply) => {
    const manager = await requireManager(request, deps);
    const id = (request.params as { id?: string }).id;
    const parsed = rollbackScenarioSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Choose a valid scenario revision.");
    const scenario = await deps.store.rollbackCustomScenario(id, parsed.data.revisionId, manager.userId, deps.now());
    if (!scenario) throw new ApiError(404, "Scenario or revision not found.");
    return reply.send({ scenario, message: "Scenario rolled back as a draft. Review and publish it before learner practice." });
  });
}
