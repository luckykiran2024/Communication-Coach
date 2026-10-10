import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ApiError } from "./errors";
import type { SupabaseOAuthOptions } from "./supabase-oauth";

export type OAuthOptions = {
  supabase?: SupabaseOAuthOptions;
  googleClientIds?: string[];
  microsoftClientIds?: string[];
  microsoftJwks?: JWTVerifyGetKey;
  fetchImpl?: typeof fetch;
};

const microsoftKeys = createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function microsoftIdentity(token: string, options: OAuthOptions | undefined, now: Date) {
  if (!options?.microsoftClientIds?.length) {
    throw new ApiError(503, "Microsoft sign-in is not configured for this deployment.");
  }
  try {
    const { payload } = await jwtVerify(token, options.microsoftJwks ?? microsoftKeys, {
      audience: options.microsoftClientIds, algorithms: ["RS256"], currentDate: now,
      requiredClaims: ["exp", "iat", "iss", "aud", "oid", "tid", "sub"],
    });
    const { tid, oid, email } = payload;
    if (typeof tid !== "string" || typeof oid !== "string" || !uuidPattern.test(tid) || !uuidPattern.test(oid)) {
      throw new Error("Missing stable Microsoft identity");
    }
    if (payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new Error("Invalid Microsoft issuer");
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email required");
    return { email: email.trim().toLowerCase(), subject: `${tid}:${oid}`, emailVerified: false };
  } catch {
    throw new ApiError(401, "The Microsoft ID token is invalid or expired.");
  }
}
