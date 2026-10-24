import { test } from "node:test";
import assert from "node:assert/strict";
import { functionalPreviewNotice, requireFunctionalPreview } from "./functional-preview-config";

test("functional preview: fixtures require explicit opt-in and reject production or hosted execution", () => {
  for (const env of [{}, { COACH_FUNCTIONAL_PREVIEW: "1" },
    { COACH_FUNCTIONAL_PREVIEW: "true", NODE_ENV: "production" }, { COACH_FUNCTIONAL_PREVIEW: "true", VERCEL: "1" }]) {
    assert.throws(() => requireFunctionalPreview(env), /local-only/);
  }
  assert.doesNotThrow(() => requireFunctionalPreview({ COACH_FUNCTIONAL_PREVIEW: "true", NODE_ENV: "development" }));
  assert.match(functionalPreviewNotice, /simulated AI, email and payment/);
});
