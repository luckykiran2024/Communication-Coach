import { test } from "node:test";
import assert from "node:assert/strict";
import { verifiedTestDatabaseUrl } from "./database-fixture";

test("database fixture: absent URLs and non-isolated schemas are refused", () => {
  assert.throws(() => verifiedTestDatabaseUrl({}));
  assert.throws(() => verifiedTestDatabaseUrl({ DATABASE_TEST_URL: "postgresql://localhost/coach?schema=public" }));
});

test("database fixture: TLS exemption is restricted to explicit loopback CI services", () => {
  const env = { CI: "true", DATABASE_TEST_LOCAL: "true",
    DATABASE_TEST_URL: "postgresql://localhost/coach?schema=coach_verification" };
  assert.equal(verifiedTestDatabaseUrl(env).hostname, "localhost");
  assert.throws(() => verifiedTestDatabaseUrl({ ...env, CI: "false" }));
  assert.throws(() => verifiedTestDatabaseUrl({ ...env,
    DATABASE_TEST_URL: "postgresql://hosted.internal/coach?schema=coach_verification" }));
});

test("database fixture: hosted URLs retain strict TLS even if local flags are supplied", () => {
  const env = { DATABASE_TEST_URL: "postgresql://hosted.internal/coach?schema=coach_verification&sslmode=require&sslaccept=strict" };
  assert.equal(verifiedTestDatabaseUrl(env).searchParams.get("sslaccept"), "strict");
  assert.throws(() => verifiedTestDatabaseUrl({ DATABASE_TEST_URL: env.DATABASE_TEST_URL.replace("strict", "accept_invalid_certs") }));
});
