import { test } from "node:test";
import assert from "node:assert/strict";
import { costSummary, parseVoiceCosts } from "./cost-summary";

test("cost report: includes all assessment attempts and only complete provider-matched voice costs", () => {
  const result = costSummary([{ costMicros: 150 }, { costMicros: 50 }], 1,
    [{ providerCallId: "call-a" }, { providerCallId: "call-b" }],
    parseVoiceCosts([{ providerCallId: "call-a", costMicros: 2000 }, { providerCallId: "call-b", costMicros: 4000 }]));
  assert.equal(result.averageAssessmentCostPerFeedbackSession, 0.0002);
  assert.equal(result.averageVoiceCostPerSession, 0.003);
});

test("cost report: incomplete evidence and zero sessions produce null, not invented zero-dollar averages", () => {
  const missing = costSummary([{ costMicros: null }], 1, [{ providerCallId: "unknown" }]);
  assert.equal(missing.averageAssessmentCostPerFeedbackSession, null);
  assert.equal(missing.averageVoiceCostPerSession, null);
  assert.equal(missing.unknownVoiceCosts, 1);
  assert.equal(costSummary([], 0, []).averageVoiceCostPerSession, null);
});

test("cost report: duplicate, negative and malformed billing evidence is rejected", () => {
  assert.throws(() => parseVoiceCosts({}));
  assert.throws(() => parseVoiceCosts([{ providerCallId: "call", costMicros: -1 }]));
  assert.throws(() => parseVoiceCosts([{ providerCallId: "call", costMicros: 1 }, { providerCallId: "call", costMicros: 2 }]));
});
