export const stagingProjectRef = "szebsownsnvyrpwlbyau";
export const stagingVercelProjectId = "prj_5Ue9vRNMQ7RufENdOPKUXk8BBmzl";

export function deploymentDatabaseUrl(env: NodeJS.ProcessEnv, certificatePath: string): string | undefined {
  const staging = env.COACH_ENVIRONMENT === "staging";
  if (env.VERCEL_PROJECT_ID === stagingVercelProjectId && !staging) {
    throw new Error("The staging Vercel project requires COACH_ENVIRONMENT=staging.");
  }
  if (!staging) return env.DATABASE_URL || env.Communicatio_Caoch_DATABASE_URL;
  if ((env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== stagingVercelProjectId)
    || env.Communicatio_Caoch_DATABASE_URL
    || env.SUPABASE_URL !== `https://${stagingProjectRef}.supabase.co`) {
    throw new Error("Staging requires its separate Vercel, database and Supabase Auth configuration.");
  }
  let url: URL;
  try { url = new URL(env.DATABASE_URL ?? ""); }
  catch { throw new Error("Set the dedicated staging DATABASE_URL."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !["aws-0-ap-northeast-1.pooler.supabase.com", `db.${stagingProjectRef}.supabase.co`].includes(url.hostname)
    || !["5432", "6543"].includes(url.port)
    || !new RegExp(`^[a-z_][a-z0-9_]*\\.${stagingProjectRef}$`).test(decodeURIComponent(url.username))
    || !url.password || url.pathname !== "/postgres"
    || url.searchParams.get("schema") !== "public"
    || url.searchParams.get("sslmode") !== "require" || url.searchParams.get("sslaccept") !== "strict"
    || [...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length !== 1)
    || (url.port === "6543" && url.searchParams.get("pgbouncer") !== "true")) {
    throw new Error("Staging requires its own public database schema and strict TLS; unexpected database settings were rejected.");
  }
  // Local files contain a Windows certificate path. Resolve the bundled CA at
  // build/runtime instead of carrying a workstation path into Linux Functions.
  url.searchParams.set("sslcert", certificatePath);
  url.searchParams.set("connection_limit", "2");
  return url.toString();
}
