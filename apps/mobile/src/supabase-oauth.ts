import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { runSupabaseGoogleSignIn } from "./supabase-oauth-flow";
import { supabaseGoogleConfigured } from "./supabase-config";
import { Platform } from "react-native";
import { installOAuthCrypto } from "./oauth-crypto";

export async function signInWithSupabaseGoogle(exchangeAppSession: (accessToken: string) => Promise<void>) {
  if (!supabaseGoogleConfigured()) throw new Error("Supabase Google sign-in is not configured for this app.");
  if (Platform.OS !== "web") {
    const crypto = await import("expo-crypto");
    installOAuthCrypto(globalThis, {
      getRandomValues: crypto.getRandomValues, randomUUID: crypto.randomUUID,
      digestSha256: data => crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, data),
    });
  }
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("Secure Google sign-in requires native crypto or an HTTPS browser (localhost is also supported).");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
    },
  );
  const redirectUri = makeRedirectUri({ scheme: "communicationcoach", path: "oauth" });
  await runSupabaseGoogleSignIn(client, redirectUri, WebBrowser.openAuthSessionAsync, exchangeAppSession);
}
