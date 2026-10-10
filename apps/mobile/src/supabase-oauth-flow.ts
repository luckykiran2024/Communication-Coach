import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseCallbackCode(callback: string, redirectUri: string) {
  const actual = new URL(callback);
  const expected = new URL(redirectUri);
  if (actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname
    || actual.username || actual.password || actual.hash) {
    throw new Error("Google returned an unexpected sign-in address. Please try again.");
  }
  if (actual.searchParams.has("error")) throw new Error("Google sign-in was not completed. Please try again.");
  const codes = actual.searchParams.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) {
    throw new Error("Google did not return a valid sign-in code. Please try again.");
  }
  return codes[0];
}

export async function runSupabaseGoogleSignIn(
  client: Pick<SupabaseClient, "auth">,
  redirectUri: string,
  openBrowser: (url: string, redirect: string) => Promise<{ type: string; url?: string }>,
  exchangeAppSession: (accessToken: string) => Promise<void>,
) {
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUri, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error || !data.url) throw new Error("Google sign-in could not start. Check the Supabase provider configuration.");
    if (new URL(data.url).searchParams.get("code_challenge_method")?.toLowerCase() !== "s256") {
      throw new Error("Secure Google sign-in requires SHA-256 PKCE. Please update the app.");
    }
    const result = await openBrowser(data.url, redirectUri);
    if (result.type === "cancel" || result.type === "dismiss") return;
    if (result.type !== "success" || !result.url) throw new Error("Google sign-in was interrupted. Please try again.");
    const code = supabaseCallbackCode(result.url, redirectUri);
    const flowIds = new URL(result.url).searchParams.getAll("sb_flow_id");
    if (flowIds.length > 1 || (flowIds.length === 1 && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowIds[0]))) {
      throw new Error("Google returned an invalid sign-in flow. Please try again.");
    }
    const exchange = await client.auth.exchangeCodeForSession(code, flowIds[0] ? { flowId: flowIds[0] } : undefined);
    if (exchange.error || !exchange.data.session?.access_token) {
      throw new Error("Google sign-in expired or could not be verified. Please try again.");
    }
    await exchangeAppSession(exchange.data.session.access_token);
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
