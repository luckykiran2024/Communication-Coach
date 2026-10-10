import { runtimeEnvironmentSchema } from "./runtime-env";
import { supabaseOAuthConfigured, type SupabaseOAuthOptions } from "./lib/supabase-oauth";

export function testSupabaseOAuthOptions(env: NodeJS.ProcessEnv): SupabaseOAuthOptions {
  const values = runtimeEnvironmentSchema.pick({
    SUPABASE_OAUTH_ENABLED: true, SUPABASE_URL: true, SUPABASE_PUBLISHABLE_KEY: true,
  }).parse(env);
  if (!values.SUPABASE_OAUTH_ENABLED) return { enabled: false };
  const options = { enabled: true, url: values.SUPABASE_URL, publishableKey: values.SUPABASE_PUBLISHABLE_KEY };
  if (options.url !== "https://nrrmhftccqsofjvoaffm.supabase.co" || !supabaseOAuthConfigured(options)) {
    throw new Error("Test Google sign-in requires the approved Supabase project URL and a public publishable key.");
  }
  return options;
}

export function testDatabaseUrl(env: NodeJS.ProcessEnv, certificatePath: string) {
  if (env.NODE_ENV !== "production" || env.COACH_TEST_BACKEND !== "true"
    || env.VERCEL_PROJECT_ID !== "prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf") {
    throw new Error("The test backend must run in the dedicated test project.");
  }
  const databaseUrl = new URL(env.DATABASE_URL ?? "");
  if (!["postgresql:", "postgres:"].includes(databaseUrl.protocol)
    || databaseUrl.hostname !== "aws-0-ap-northeast-1.pooler.supabase.com"
    || decodeURIComponent(databaseUrl.username) !== "coach_apk_test.nrrmhftccqsofjvoaffm"
    || databaseUrl.searchParams.get("schema") !== "coach_apk_test"
    || databaseUrl.searchParams.get("sslmode") !== "require"
    || databaseUrl.searchParams.get("sslaccept") !== "strict") {
    throw new Error("The test backend requires its isolated database role/schema and strict TLS.");
  }
  databaseUrl.searchParams.set("sslcert", certificatePath);
  databaseUrl.searchParams.set("connection_limit", "1");
  return databaseUrl.toString();
}
