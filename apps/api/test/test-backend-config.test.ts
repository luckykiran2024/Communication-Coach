import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabaseUrl } from "../src/test-backend-config";

const env = {
  NODE_ENV: "production",
  COACH_TEST_BACKEND: "true",
  VERCEL_PROJECT_ID: "prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf",
  DATABASE_URL: "postgresql://coach_apk_test.nrrmhftccqsofjvoaffm:fixture@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=coach_apk_test&sslmode=require&sslaccept=strict",
};

test("APK test backend pins the project, schema, database role and strict TLS", () => {
  const configured = new URL(testDatabaseUrl(env, "/fixture/ca.crt"));
  assert.equal(configured.searchParams.get("sslcert"), "/fixture/ca.crt");
  assert.equal(configured.searchParams.get("connection_limit"), "1");
  assert.throws(() => testDatabaseUrl({ ...env, COACH_TEST_BACKEND: "false" }, "/fixture/ca.crt"));
  assert.throws(() => testDatabaseUrl({ ...env, NODE_ENV: "development" }, "/fixture/ca.crt"));
  assert.throws(() => testDatabaseUrl({ ...env, VERCEL_PROJECT_ID: "production-project" }, "/fixture/ca.crt"));
  for (const [key, value] of [["schema", "public"], ["schema", "coach_verification"], ["sslmode", "disable"], ["sslaccept", "accept_invalid_certs"]]) {
    const invalid = new URL(env.DATABASE_URL);
    invalid.searchParams.set(key, value);
    assert.throws(() => testDatabaseUrl({ ...env, DATABASE_URL: invalid.toString() }, "/fixture/ca.crt"));
  }
  for (const username of ["postgres.nrrmhftccqsofjvoaffm", "other_role.nrrmhftccqsofjvoaffm"]) {
    const invalid = new URL(env.DATABASE_URL);
    invalid.username = username;
    assert.throws(() => testDatabaseUrl({ ...env, DATABASE_URL: invalid.toString() }, "/fixture/ca.crt"));
  }
  const invalid = new URL(env.DATABASE_URL);
  invalid.hostname = "other.supabase.com";
  assert.throws(() => testDatabaseUrl({ ...env, DATABASE_URL: invalid.toString() }, "/fixture/ca.crt"));
});
