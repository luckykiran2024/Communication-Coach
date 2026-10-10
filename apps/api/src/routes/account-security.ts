import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { credentialsSchema } from "@coach/core";
import { authenticate } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import { hashPassword, verifyPassword } from "../password";
import type { EmailTokenPurpose } from "../store";
import type { RouteDependencies } from "./context";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const confirmSchema = z.object({ token: tokenSchema, password: credentialsSchema.shape.password }).strict();
const requestSchema = z.object({ email: credentialsSchema.shape.email }).strict();
const genericResetResponse = { message: "If this account exists, password reset instructions have been sent." };
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const invalidLink = () => new ApiError(400, "This link is invalid, expired or already used. Request a new one.");

async function sendLink(userId: string, to: string, purpose: EmailTokenPurpose, deps: RouteDependencies) {
  if (!deps.emailSender) throw new ApiError(503, "Account email delivery is not configured.");
  const token = randomBytes(32).toString("hex");
  const createdAt = deps.now();
  const issued = await deps.store.issueEmailToken({
    tokenHash: digest(token), userId, purpose, createdAt,
    expiresAt: new Date(createdAt.getTime() + 30 * 60000), usedAt: null,
  }, 3);
  if (!issued) return false;
  const path = purpose === "verify_email" ? "verify-email" : "password-reset";
  const separator = deps.emailLinkBaseUrl.endsWith("/") ? "" : "/";
  const link = `${deps.emailLinkBaseUrl}${separator}${path}?token=${token}`;
  await deps.emailSender.send({ to, purpose, link, token });
  return true;
}

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.post("/v1/auth/verify-email/request", async request => {
    const { user } = await authenticate(request, deps);
    if (user.emailVerifiedAt) return { message: "Your email is already verified." };
    try {
      if (!await sendLink(user.id, user.email, "verify_email", deps)) {
        throw new ApiError(429, "You can request three verification emails per hour. Please try later.");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "Unable to send the verification email. Please try later.");
    }
    return { message: "Verification instructions sent. The link expires in 30 minutes." };
  });

  app.post("/v1/auth/verify-email/confirm", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const { user } = await authenticate(request, deps);
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) throw invalidLink();
    if (!await verifyPassword(parsed.data.password, user.passwordHash)) throw new ApiError(401, "Password is incorrect.");
    const verified = await deps.store.consumeEmailToken(digest(parsed.data.token), "verify_email", deps.now(), user.id);
    if (!verified) throw invalidLink();
    return { message: "Your email is verified." };
  });

  app.post("/v1/auth/password-reset/request", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async request => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a valid email address.");
    if (!deps.emailSender) throw new ApiError(503, "Account email delivery is not configured.");
    const user = await deps.store.accountByEmail(parsed.data.email);
    if (user) {
      try { await sendLink(user.id, user.email, "password_reset", deps); }
      catch { request.log.warn("Password reset delivery failed; no account details or tokens logged"); }
    }
    return genericResetResponse;
  });

  app.post("/v1/auth/password-reset/confirm", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async request => {
    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) throw invalidLink();
    const passwordHash = await hashPassword(parsed.data.password);
    const reset = await deps.store.consumeEmailToken(digest(parsed.data.token), "password_reset", deps.now(), undefined, passwordHash);
    if (!reset) throw invalidLink();
    return { message: "Password changed. All devices have been signed out. Sign in with your new password." };
  });
}
