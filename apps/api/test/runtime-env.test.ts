import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeEnvironmentSchema } from "../src/runtime-env";
import { productionConfigurationErrors } from "../src/config";

const flags = ["DEV_MEMORY_STORE", "OPENAI_REALTIME_ENABLED", "BILLING_ENABLED", "SUPABASE_OAUTH_ENABLED"] as const;

test("runtime feature flags default to disabled", () => {
  const env = runtimeEnvironmentSchema.parse({});
  for (const flag of flags) assert.equal(env[flag], false);
});

test("runtime feature flags accept only explicit true and false strings", () => {
  for (const flag of flags) {
    assert.equal(runtimeEnvironmentSchema.parse({ [flag]: "true" })[flag], true);
    assert.equal(runtimeEnvironmentSchema.parse({ [flag]: "false" })[flag], false);
    for (const value of ["", "0", "1", "TRUE", "False", " true", "false ", "yes", "no", true, false, 0, 1, null]) {
      const result = runtimeEnvironmentSchema.safeParse({ [flag]: value });
      assert.equal(result.success, false, `${flag} must reject ${JSON.stringify(value)}`);
      if (!result.success) assert.deepEqual(result.error.issues[0].path, [flag]);
    }
  }
});

test("disabled runtime flags preserve production safety gates without demanding paid-provider credentials", () => {
  const env = runtimeEnvironmentSchema.parse({
    NODE_ENV: "production", DEV_MEMORY_STORE: "false", OPENAI_REALTIME_ENABLED: "false",
    BILLING_ENABLED: "false", SUPABASE_OAUTH_ENABLED: "false",
  });
  const errors = productionConfigurationErrors({
    nodeEnv: env.NODE_ENV, databaseUrl: "postgresql://coach:fixture@db.internal/coach",
    devMemoryStore: env.DEV_MEMORY_STORE, corsOrigins: ["https://coach.company.test"],
    managerEmails: ["manager@company.test"], emailSenderConfigured: true,
    emailLinkBaseUrl: "https://coach.company.test", realtimeEnabled: env.OPENAI_REALTIME_ENABLED,
    billingEnabled: env.BILLING_ENABLED, storeVerifierConfigured: false,
  });
  assert.deepEqual(errors, []);
  assert.ok(productionConfigurationErrors({
    nodeEnv: env.NODE_ENV, devMemoryStore: env.DEV_MEMORY_STORE, corsOrigins: [], managerEmails: [],
    realtimeEnabled: env.OPENAI_REALTIME_ENABLED, billingEnabled: env.BILLING_ENABLED, storeVerifierConfigured: false,
  }).some(error => error.includes("DATABASE_URL")));
});

test("runtime schema preserves OAuth values and explicit enabled-provider validation", () => {
  const env = runtimeEnvironmentSchema.parse({
    SUPABASE_OAUTH_ENABLED: "true", SUPABASE_URL: "https://nrrmhftccqsofjvoaffm.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", OPENAI_REALTIME_ENABLED: "true", BILLING_ENABLED: "true",
  });
  assert.equal(env.SUPABASE_URL, "https://nrrmhftccqsofjvoaffm.supabase.co");
  assert.equal(env.SUPABASE_PUBLISHABLE_KEY, "sb_publishable_fixture");
  const errors = productionConfigurationErrors({
    nodeEnv: "production", devMemoryStore: false, corsOrigins: [], managerEmails: [],
    realtimeEnabled: env.OPENAI_REALTIME_ENABLED, billingEnabled: env.BILLING_ENABLED, storeVerifierConfigured: false,
  });
  assert.ok(errors.some(error => error.includes("OPENAI_API_KEY")));
  assert.ok(errors.some(error => error.includes("BILLING_WEBHOOK_SECRET")));
});
