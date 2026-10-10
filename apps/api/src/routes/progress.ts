import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import { progressSnapshot } from "../lib/progress-snapshot";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/me/progress", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const [records, voice] = await Promise.all([
      deps.store.learningRecords(user.id), deps.store.measuredVoiceSessions(user.id),
    ]);
    return progressSnapshot(records, voice, profile, deps.now(), deps.assessmentEnabled);
  });
}
