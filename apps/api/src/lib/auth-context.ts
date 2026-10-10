import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { ApiError } from "./errors";
import type { Account, OAuthProvider, Store } from "../store";
import { safeEqual } from "./safe-equal";
import { microsoftIdentity, type OAuthOptions } from "./oauth";

export type AuthDependencies = {
  store: Store;
  now: () => Date;
  configuredManagerKey: string;
  configuredManagerEmails: Set<string>;
  oauth?: OAuthOptions;
};

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function authenticate(request: FastifyRequest, deps: AuthDependencies) {
  const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw new ApiError(401, "Sign in to continue.");
  const tokenHash = digest(token);
  const session = await deps.store.sessionByHash(tokenHash);
  if (!session || session.expiresAt <= deps.now()) throw new ApiError(401, "Your session has expired. Please sign in.");
  const user = await deps.store.accountById(session.userId);
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return { user, tokenHash };
}

export async function issueSession(user: Account, deps: AuthDependencies) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(deps.now().getTime() + 7 * 86400000);
  await deps.store.createSession({ tokenHash: digest(token), userId: user.id, expiresAt }, user.passwordHash);
  return { token, expiresAt: expiresAt.toISOString(), user: publicAccount(user) };
}

export function publicAccount(user: Pick<Account, "id" | "email" | "emailVerifiedAt">) {
  return { id: user.id, email: user.email, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null };
}

export async function requireManager(request: FastifyRequest, deps: AuthDependencies) {
  if (process.env.NODE_ENV !== "production" && safeEqual(request.headers["x-manager-key"], deps.configuredManagerKey)) {
    return { userId: null as string | null };
  }
  const { user } = await authenticate(request, deps);
  const verifiedManagerEmail = Boolean(user.emailVerifiedAt) && deps.configuredManagerEmails.has(user.email);
  if (user.role !== "manager" && !verifiedManagerEmail) throw new ApiError(403, "Manager access is required.");
  return { userId: user.id };
}

export async function verifiedOAuthIdentity(provider: OAuthProvider, accessToken: string, deps: AuthDependencies) {
  if (provider === "microsoft") return microsoftIdentity(accessToken, deps.oauth, deps.now());
  if (!deps.oauth?.googleClientIds?.length) throw new ApiError(503, "Google sign-in is not configured for this deployment.");
  type ProviderIdentityResponse = {
    email?: string; sub?: string; aud?: string | string[]; email_verified?: boolean | string;
  };
  const response = await (deps.oauth?.fetchImpl ?? fetch)(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new ApiError(401, "The provider sign-in token is invalid or expired.");
  const data = await response.json() as ProviderIdentityResponse;
  const email = (data.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(401, "The provider did not return a valid email address.");
  }
  const subject = data.sub?.trim() ?? "";
  if (!subject) throw new ApiError(401, "The provider did not return a stable account identifier.");
  if (data.email_verified !== true && data.email_verified !== "true") throw new ApiError(401, "The Google email is not verified.");
  const audiences = data.aud ? (Array.isArray(data.aud) ? data.aud : [data.aud]) : [];
  if (!audiences.some(audience => deps.oauth!.googleClientIds!.includes(audience))) {
    throw new ApiError(401, "The Google sign-in token was issued for an unrecognized application.");
  }
  return { email, subject, emailVerified: true };
}
