import type { FastifyInstance } from "fastify";
import { profileSchema } from "@coach/core";
import { authenticate, publicAccount } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.delete("/v1/me", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    await deps.store.deleteAccount(user.id);
    return reply.code(204).send();
  });
  app.get("/v1/me", async request => {
    const { user } = await authenticate(request, deps);
    return { user: publicAccount(user), profile: await deps.store.profile(user.id) };
  });
  app.put("/v1/me/profile", async request => {
    const { user } = await authenticate(request, deps);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues.map(issue => issue.path.join(".") + ": " + issue.message).join("; "));
    }
    await deps.store.saveProfile(user.id, parsed.data);
    return { profile: parsed.data };
  });
}
