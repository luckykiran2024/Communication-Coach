/** @param {Record<string, string | undefined>} env */
function assertStagingMobileEnvironment(env) {
  if (env.COACH_ENVIRONMENT !== "staging") return;
  let api;
  try { api = new URL(env.EXPO_PUBLIC_API_URL ?? ""); }
  catch { throw new Error("Set the dedicated staging EXPO_PUBLIC_API_URL before building this profile."); }
  if (api.protocol !== "https:" || api.username || api.password || api.port || api.search || api.hash
    || !/^communication-coach-staging-api(?:-[a-z0-9-]+)?\.vercel\.app$/.test(api.hostname)
    || api.pathname.replace(/\/$/, "") !== "/api"
    || env.EXPO_PUBLIC_SUPABASE_URL !== "https://szebsownsnvyrpwlbyau.supabase.co"
    || env.EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED !== "true"
    || !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
    throw new Error("Staging mobile builds require the dedicated staging API and Supabase Auth project.");
  }
}

module.exports = { assertStagingMobileEnvironment };
