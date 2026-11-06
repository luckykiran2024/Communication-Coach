import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { assertStagingMobileEnvironment } from "../apps/mobile/staging-config.cjs";

const staging = { COACH_ENVIRONMENT: "staging", EXPO_PUBLIC_API_URL: "https://communication-coach-staging-api.vercel.app/api",
  EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED: "true", EXPO_PUBLIC_SUPABASE_URL: "https://szebsownsnvyrpwlbyau.supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture" };

test("staging mobile configuration cannot inherit production or restricted-test services", () => {
  for (const changed of [
    { EXPO_PUBLIC_API_URL: "https://communication-coach-api.vercel.app/api" },
    { EXPO_PUBLIC_API_URL: "https://communication-coach-test-api-luckykiran2024s-projects.vercel.app/api" },
    { EXPO_PUBLIC_API_URL: "" },
    { EXPO_PUBLIC_API_URL: staging.EXPO_PUBLIC_API_URL + "?token=fixture" },
    { EXPO_PUBLIC_SUPABASE_URL: "https://nrrmhftccqsofjvoaffm.supabase.co" },
    { EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED: "false" },
    { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  ]) assert.throws(() => assertStagingMobileEnvironment({ ...staging, ...changed }));
  assert.doesNotThrow(() => assertStagingMobileEnvironment(staging));
  assert.doesNotThrow(() => assertStagingMobileEnvironment({}));
});

test("Expo can load the staging guard through its dynamic config loader", () => {
  const expoRoot = path.dirname(require.resolve("expo/package.json", { paths: [path.resolve("apps/mobile")] }));
  const result = spawnSync(process.execPath, ["--require=" + path.resolve("scripts/node-os-compat.cjs"),
    path.join(expoRoot, "bin/cli"), "config", "--type", "public", "--json"], {
    cwd: path.resolve("apps/mobile"), env: { ...process.env, ...staging, APP_VARIANT: "preview" },
    encoding: "utf8", timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).android.package, "com.c2coach.app.preview");
});
