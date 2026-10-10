import { ApiError } from "./errors";

export type SupabaseOAuthOptions = {
  enabled?: boolean;
  url?: string;
  publishableKey?: string;
  fetchImpl?: typeof fetch;
};

export function supabaseOAuthConfigured(options: SupabaseOAuthOptions | undefined) {
  if (!options?.enabled || !options.url || !options.publishableKey?.startsWith("sb_publishable_")) return false;
  try {
    const url = new URL(options.url);
    return url.protocol === "https:" && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
      && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === "/";
  } catch { return false; }
}

export async function supabaseGoogleIdentity(token: string, options: SupabaseOAuthOptions | undefined) {
  if (!supabaseOAuthConfigured(options)) throw new ApiError(503, "Supabase Google sign-in is not configured.");
  let response: Response;
  try {
    response = await (options!.fetchImpl ?? fetch)(new URL("/auth/v1/user", options!.url), {
      headers: { apikey: options!.publishableKey!, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000), redirect: "error",
    });
  } catch {
    throw new ApiError(503, "Google sign-in is temporarily unavailable. Please try again.");
  }
  if (response.status >= 500 || response.status === 429) {
    throw new ApiError(503, "Google sign-in is temporarily unavailable. Please try again.");
  }
  if (!response.ok) throw new ApiError(401, "The Supabase sign-in session is invalid or expired.");
  const data = await response.json().catch(() => null) as {
    id?: string;
    role?: string;
    identities?: { provider?: string; user_id?: string;
      identity_data?: { sub?: string; email?: string; email_verified?: boolean } }[];
  } | null;
  const identity = Array.isArray(data?.identities)
    ? data.identities.find(item => item?.provider === "google" && item.user_id === data.id) : undefined;
  const email = typeof identity?.identity_data?.email === "string" ? identity.identity_data.email.trim().toLowerCase() : "";
  const subject = typeof identity?.identity_data?.sub === "string" ? identity.identity_data.sub.trim() : "";
  if (data?.role !== "authenticated" || !data.id || !subject || subject.length > 255
    || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || identity?.identity_data?.email_verified !== true) {
    throw new ApiError(401, "Sign in with a verified Google account to continue.");
  }
  return { email, subject, emailVerified: true };
}
