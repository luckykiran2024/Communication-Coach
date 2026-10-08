import { test } from "node:test";
import assert from "node:assert/strict";
import { nativeQaChecks, validateNativeQaEvidence } from "./native-qa";

function evidence() {
  return ["android", "ios"].map(platform => ({ platform, device: `${platform}-test-device`, osVersion: "2026.1", buildId: `${platform}-build-1`, testedAt: "2026-10-06T10:00:00.000Z", checks: Object.fromEntries(nativeQaChecks.map(check => [check, "pass"])) }));
}

test("native QA evidence requires both platforms and every critical check", () => {
  const result = validateNativeQaEvidence(evidence());
  assert.equal(result.valid, true);
  const incomplete = evidence();
  delete (incomplete[1].checks as Record<string, string>).screenReader;
  const failure = validateNativeQaEvidence(incomplete);
  assert.equal(failure.valid, false);
  assert.match(failure.errors.join(" "), /ios\.checks\.screenReader/);
  const invalidTimestamp = evidence();
  invalidTimestamp[0].testedAt = "October 6, 2026";
  const timestampFailure = validateNativeQaEvidence(invalidTimestamp);
  assert.equal(timestampFailure.valid, false);
  assert.match(timestampFailure.errors.join(" "), /android\.testedAt/);
});
