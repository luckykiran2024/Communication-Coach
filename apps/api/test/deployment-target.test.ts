import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentDatabaseUrl, stagingProjectRef, stagingVercelProjectId } from "../src/deployment-target";

const db = `postgresql://postgres.${stagingProjectRef}:synthetic-fixture@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=public&sslmode=require&sslaccept=strict&sslcert=C%3A%2Flocal-ca.crt`;
const staging = { COACH_ENVIRONMENT: "staging", VERCEL_PROJECT_ID: stagingVercelProjectId,
  DATABASE_URL: db, SUPABASE_URL: `https://${stagingProjectRef}.supabase.co` };

test("staging deployment rejects production database/Auth settings and mismatched hosting", () => {
  for (const changed of [
    { COACH_ENVIRONMENT: undefined }, { VERCEL_PROJECT_ID: "production-project" },
    { Communicatio_Caoch_DATABASE_URL: "production-integration-secret" },
    { SUPABASE_URL: "https://nrrmhftccqsofjvoaffm.supabase.co" },
    { DATABASE_URL: db.replace(stagingProjectRef, "nrrmhftccqsofjvoaffm") },
    { DATABASE_URL: db.replace("schema=public", "schema=coach_verification") },
    { DATABASE_URL: db.replace("sslaccept=strict", "sslaccept=accept_invalid_certs") },
    { DATABASE_URL: db + "&schema=coach_verification" },
    { DATABASE_URL: db.replace(":5432/", ":6543/") },
  ]) assert.throws(() => deploymentDatabaseUrl({ ...staging, ...changed }, "/var/task/prisma/ca.crt"));
});

test("staging resolves its trusted CA inside the deployed bundle and bounds the pool", () => {
  const url = new URL(deploymentDatabaseUrl(staging, "/var/task/prisma/supabase-ca.crt")!);
  assert.equal(url.searchParams.get("sslcert"), "/var/task/prisma/supabase-ca.crt");
  assert.equal(url.searchParams.get("sslaccept"), "strict");
  assert.equal(url.searchParams.get("connection_limit"), "2");
});

test("existing production integrations and local memory-mode startup remain supported", () => {
  assert.equal(deploymentDatabaseUrl({ DATABASE_URL: "existing-database" }, "unused"), "existing-database");
  assert.equal(deploymentDatabaseUrl({ Communicatio_Caoch_DATABASE_URL: "existing-integration" }, "unused"), "existing-integration");
  assert.equal(deploymentDatabaseUrl({}, "unused"), undefined);
});
