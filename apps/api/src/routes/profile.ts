import type { FastifyInstance } from "fastify";
import { profileSchema } from "@coach/core";
import { authenticate, publicAccount } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import { deleteSupabaseIdentity } from "../lib/supabase-oauth";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.delete("/v1/me", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    await deps.reapVoiceSessions();
    if (await deps.store.activeVoiceSession(user.id) || (await deps.store.pendingVoiceProviderCalls()).some(session => session.userId === user.id)) {
      throw new ApiError(409, "Stop your active voice session before deleting your account. If cleanup is pending, try again shortly.");
    }
    if (!user.supabaseUserId && deps.oauth?.supabase?.enabled && (await deps.store.accountOAuthIdentities(user.id)).some(identity => identity.provider === "google")) {
      throw new ApiError(409, "Sign in with Google once more to verify your linked identity, then retry deletion.");
    }
    await deps.store.beginAccountDeletion(user.id, deps.now());
    if (user.supabaseUserId) await deleteSupabaseIdentity(user.supabaseUserId, deps.oauth?.supabase);
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
