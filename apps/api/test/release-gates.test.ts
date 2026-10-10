import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release gates: source pushes cannot automatically migrate or replace production", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.git.deploymentEnabled.main, false);
  assert.equal(config.git.deploymentEnabled["test-apk-ready"], false);
  assert.equal(config.crons[0].schedule, "* * * * *");
});

test("release gates: mobile updates require a separate manual workflow dispatch", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/eas-update.yml", import.meta.url), "utf8");
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
});
