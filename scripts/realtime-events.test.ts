import { test } from "node:test";
import assert from "node:assert/strict";
import { initialRealtimeResponse } from "../apps/mobile/src/realtime-events";

test("realtime: initial GA response requests audio with its transcript, not incompatible dual modalities", () => {
  assert.deepEqual(initialRealtimeResponse(), { type: "response.create", response: { output_modalities: ["audio"] } });
  assert.equal("modalities" in initialRealtimeResponse().response, false);
});
