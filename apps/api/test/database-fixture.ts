export function verifiedTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (!env.DATABASE_TEST_URL) throw new Error("Set an explicit isolated DATABASE_TEST_URL.");
  const url = new URL(env.DATABASE_TEST_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || url.searchParams.get("schema") !== "coach_verification") throw new Error("Use the coach_verification test schema.");
  const localCi = env.CI === "true" && env.DATABASE_TEST_LOCAL === "true"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!localCi && (url.searchParams.get("sslmode") !== "require" || url.searchParams.get("sslaccept") !== "strict")) {
    throw new Error("Hosted database tests require strict TLS.");
  }
  return url;
}
