import { test } from "node:test";
import assert from "node:assert/strict";
import { scenarios } from "@coach/core";
import { contentCatalogReady, scenarioCatalogHash, validateContentReviewEvidence } from "./content-release";

test("content release sign-off is bound to the reviewed catalog", () => {
  assert.equal(contentCatalogReady(), true);
  const approved = validateContentReviewEvidence({ reviewer: "Communication trainer", reviewerRole: "Content lead", status: "approved", reviewedAt: "2026-10-06T10:00:00.000Z", scenarioCount: scenarios.length, catalogHash: scenarioCatalogHash() });
  assert.equal(approved.valid, true);
  const stale = validateContentReviewEvidence({ reviewer: "Communication trainer", reviewerRole: "Content lead", status: "approved", reviewedAt: "2026-10-06T10:00:00.000Z", scenarioCount: scenarios.length - 1, catalogHash: scenarioCatalogHash() });
  assert.equal(stale.valid, false);
  assert.match(stale.errors.join(" "), /scenarioCount/);
  const invalidTimestamp = validateContentReviewEvidence({ reviewer: "Communication trainer", reviewerRole: "Content lead", status: "approved", reviewedAt: "October 6, 2026", scenarioCount: scenarios.length, catalogHash: scenarioCatalogHash() });
  assert.equal(invalidTimestamp.valid, false);
  assert.match(invalidTimestamp.errors.join(" "), /reviewedAt/);
});
