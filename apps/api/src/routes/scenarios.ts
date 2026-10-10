import type { FastifyInstance } from "fastify";
import { isPublishedScenario, recommendScenarios } from "@coach/core";
import { authenticate } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/scenarios/library", async () => {
    const catalog = await deps.availableScenarios();
    return { scenarios: catalog, count: catalog.length };
  });
  app.get("/v1/me/scenarios", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const progress = await deps.learnerScenarioProgress(user.id, profile);
    const includedModules = (await deps.activePlan(user.id)).modules;
    const eligibleScenarios = (await deps.availableScenarios()).filter(scenario => isPublishedScenario(scenario) && includedModules.includes(scenario.module));
    return {
      scenarios: recommendScenarios(profile, eligibleScenarios, progress.mastery.level, progress.completedScenarioIds),
      mastery: progress.mastery,
      previewOnly: true,
    };
  });
}
