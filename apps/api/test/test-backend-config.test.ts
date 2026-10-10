import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabaseUrl, testSupabaseOAuthOptions } from "../src/test-backend-config";

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

test("APK test OAuth remains disabled until an explicit activation flag", () => {
  assert.deepEqual(testSupabaseOAuthOptions({}), { enabled: false });
  assert.deepEqual(testSupabaseOAuthOptions({ SUPABASE_OAUTH_ENABLED: "false" }), { enabled: false });
  assert.deepEqual(testSupabaseOAuthOptions({
    SUPABASE_OAUTH_ENABLED: "false", SUPABASE_URL: "https://unapproved.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture",
  }), { enabled: false });
  for (const value of ["", "1", "0", "yes", "TRUE", "false "]) {
    assert.throws(() => testSupabaseOAuthOptions({ SUPABASE_OAUTH_ENABLED: value }));
  }
});

test("APK test OAuth accepts only the approved Supabase URL and publishable key", () => {
  const enabled = {
    SUPABASE_OAUTH_ENABLED: "true", SUPABASE_URL: "https://nrrmhftccqsofjvoaffm.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  };
  assert.deepEqual(testSupabaseOAuthOptions(enabled), {
    enabled: true, url: enabled.SUPABASE_URL, publishableKey: enabled.SUPABASE_PUBLISHABLE_KEY,
  });
  for (const url of [undefined, "http://nrrmhftccqsofjvoaffm.supabase.co", "https://other.supabase.co",
    "https://nrrmhftccqsofjvoaffm.supabase.co.attacker.test", `${enabled.SUPABASE_URL}?redirect=other`]) {
    assert.throws(() => testSupabaseOAuthOptions({ ...enabled, SUPABASE_URL: url }));
  }
  for (const key of [undefined, "", "sb_secret_fixture", "legacy-admin-token"]) {
    assert.throws(() => testSupabaseOAuthOptions({ ...enabled, SUPABASE_PUBLISHABLE_KEY: key }));
  }
});
