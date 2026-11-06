import { test } from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { acceptanceChecks, validateReleaseAcceptance } from "./release-acceptance";
import { nativeQaChecks, validateNativeQaEvidence } from "./native-qa";
import { requiredReleaseCapabilities, releaseRuntimeConfigured, stagingCandidateConfigured } from "./release-capabilities.mjs";

test("release gates reject restricted test runtimes even at the correct commit", () => {
  const ready = { status: "ready", storage: "postgres", commit: "a".repeat(40), releaseConfigured: true,
    capabilities: Object.fromEntries(requiredReleaseCapabilities.map(name => [name, true])) };
  assert.equal(releaseRuntimeConfigured(ready), true);
  for (const name of requiredReleaseCapabilities) {
    assert.equal(releaseRuntimeConfigured({ ...ready, capabilities: { ...ready.capabilities, [name]: false } }), false);
  }
  assert.equal(releaseRuntimeConfigured({ ...ready, capabilities: {} }), false);
  assert.equal(releaseRuntimeConfigured({ ...ready, storage: "memory" }), false);
});

test("sandbox release gates require the exact isolated staging identity and commit", () => {
  const commit = "a".repeat(40);
  const ready = { status: "ready", storage: "postgres", commit, releaseConfigured: true,
    environment: "staging", supabaseProjectRef: "szebsownsnvyrpwlbyau", projectId: "prj_5Ue9vRNMQ7RufENdOPKUXk8BBmzl",
    capabilities: Object.fromEntries(requiredReleaseCapabilities.map(name => [name, true])) };
  assert.equal(stagingCandidateConfigured(ready, commit), true);
  for (const changed of [{ environment: "production" }, { supabaseProjectRef: "nrrmhftccqsofjvoaffm" },
    { projectId: "prj_production_fixture" }, { commit: "b".repeat(40) }, { releaseConfigured: false }]) {
    assert.equal(stagingCandidateConfigured({ ...ready, ...changed }, commit), false);
  }
  for (const missing of ["environment", "supabaseProjectRef", "projectId"]) {
    const incomplete = { ...ready }; delete incomplete[missing];
    assert.equal(stagingCandidateConfigured(incomplete, commit), false);
  }
  assert.equal(stagingCandidateConfigured(ready, undefined), false);
});

test("release preflight runs through the root CommonJS script runner and blocks missing evidence", () => {
  const result = spawnSync(process.execPath, ["--require=./scripts/node-os-compat.cjs", "./node_modules/tsx/dist/cli.mjs", "scripts/release-preflight.ts"], {
    encoding: "utf8", env: { ...process.env, RELEASE_ACCEPTANCE_PATH: "", RELEASE_AAB_PATH: "", RELEASE_COMMIT: "", RELEASE_BUILD_ID: "", EMAIL_PROVIDER: "console", NODE_ENV: "test" },
    timeout: 30000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[BLOCKED\] Exact Android candidate acceptance/);
  assert.doesNotMatch(result.stderr, /Top-level await|Transform failed/);
});
test("release acceptance rejects stale evidence, missing checks and the wrong Android artifact", () => {
  const candidate = { commit: "a".repeat(40), buildId: "android-test-build", aabSha256: "b".repeat(64) };
  const evidence = { ...candidate, apiDeploymentId: "dpl_fixture", reviewer: "QA reviewer", testedAt: "2026-11-06T10:00:00Z", checks: Object.fromEntries(acceptanceChecks.map(check => [check, "pass"])) };
  const now = new Date("2026-11-06T11:00:00Z");
  assert.equal(validateReleaseAcceptance(evidence, candidate, now).valid, true);
  for (const changed of [{ aabSha256: "c".repeat(64) }, { buildId: "old-build" }, { commit: "d".repeat(40) }, { checks: {} }, { testedAt: "2026-09-01T10:00:00Z" }]) {
    assert.equal(validateReleaseAcceptance({ ...evidence, ...changed }, candidate, now).valid, false);
  }
});
test("Android-only release QA does not require an iOS device", () => {
  const evidence = [{ platform: "android", device: "QA phone", osVersion: "16", buildId: "candidate", testedAt: "2026-11-06T10:00:00Z", checks: Object.fromEntries(nativeQaChecks.map(check => [check, "pass"])) }];
  assert.equal(validateNativeQaEvidence(evidence, ["android"]).valid, true);
  assert.equal(validateNativeQaEvidence(evidence).valid, false);
});
