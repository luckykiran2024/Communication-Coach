export function supabaseGoogleConfigured() {
  return process.env.EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED === "true"
    && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")
    && Boolean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"));
}
