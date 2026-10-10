import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { credentialsSchema, oauthSchema } from "@coach/core";
import { z } from "zod";
import { ApiError } from "../lib/errors";
import { authenticate, issueSession, verifiedOAuthIdentity } from "../lib/auth-context";
import { hashPassword, verifyPassword } from "../password";
import type { OAuthIdentity } from "../store";
import type { RouteDependencies } from "./context";
import { supabaseGoogleIdentity } from "../lib/supabase-oauth";

const supabaseSchema = z.object({
  accessToken: z.string().trim().min(20).max(10000),
  password: z.string().min(12).max(128).optional(),
}).strict();

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.post("/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and a password of 12–128 characters.");
    const user = await deps.store.createAccount(parsed.data.email, await hashPassword(parsed.data.password));
    return reply.code(201).send(await issueSession(user, deps));
  });
  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.");
    const user = await deps.store.accountByEmail(parsed.data.email);
    const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? deps.dummyHash);
    if (!user || !valid) throw new ApiError(401, "Email or password is incorrect.");
    return issueSession(user, deps);
  });
  app.post("/v1/auth/oauth", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const parsed = oauthSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose Google or Microsoft and try again.");
    const credential = parsed.data.provider === "google" ? parsed.data.accessToken : parsed.data.idToken;
    const identity = await verifiedOAuthIdentity(parsed.data.provider, credential, deps);
    return signInWithIdentity(parsed.data.provider, identity, deps);
  });
  app.post("/v1/auth/supabase", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async request => {
    const parsed = supabaseSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter valid Google sign-in credentials.");
    const identity = await supabaseGoogleIdentity(parsed.data.accessToken, deps.oauth?.supabase);
    return signInWithIdentity("google", identity, deps, parsed.data.password);
  });
  app.post("/v1/auth/logout", async (request, reply) => {
    const { tokenHash } = await authenticate(request, deps);
    await deps.store.deleteSession(tokenHash);
    return reply.code(204).send();
  });
  app.post("/v1/auth/logout-all", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    await deps.store.deleteSessions(user.id);
    return reply.code(204).send();
  });
}

async function signInWithIdentity(
  provider: "google" | "microsoft",
  identity: { email: string; subject: string; emailVerified: boolean },
  deps: RouteDependencies,
  password?: string,
) {
  const linked = await deps.store.oauthIdentity(provider, identity.subject);
  const linkedUser = linked ? await deps.store.accountById(linked.userId) : null;
  if (linked && !linkedUser) throw new ApiError(401, "The provider identity is no longer linked to an account.");
  const existing = linkedUser ?? await deps.store.accountByEmail(identity.email);
  if (!linked && existing && !existing.emailVerifiedAt) {
    if (!password) throw new ApiError(409, "Verify this email with your password first, or reset your password.");
    if (!await verifyPassword(password, existing.passwordHash)) throw new ApiError(401, "Email or password is incorrect.");
  }
  if (!linked && existing && !identity.emailVerified) {
    throw new ApiError(409, "Microsoft cannot safely link accounts by email. Sign in using your existing account method.");
  }
  const user = existing ?? await deps.store.createAccount(identity.email, await hashPassword(randomBytes(32).toString("hex")));
  if (identity.emailVerified && (!existing || (!linked && password && !existing.emailVerifiedAt))) {
    user.emailVerifiedAt = (await deps.store.markEmailVerified(user.id, deps.now())).emailVerifiedAt;
  }
  if (!linked) {
    const timestamp = deps.now();
    const oauthIdentity: OAuthIdentity = {
      id: randomUUID(), provider, subject: identity.subject, userId: user.id, createdAt: timestamp, updatedAt: timestamp,
    };
    await deps.store.saveOAuthIdentity(oauthIdentity);
  }
  return issueSession(user, deps);
}
