import { test } from "node:test";
import assert from "node:assert/strict";
import { withDeadline } from "../apps/mobile/src/deadline";
import { readWebPreference, writeWebPreference, tryCompleteAuthSession } from "../apps/mobile/src/safe-storage";
import { readRealtimeAnswer } from "../apps/mobile/src/realtime-answer";

test("created voice calls bind before a failed SDP body read", async () => {
  const order: string[] = [];
  const response = { ok: true, headers: new Headers({ location: "/v1/realtime/calls/rtc_fixture" }),
    text: async () => { order.push("body"); throw new Error("connection interrupted"); } } as unknown as Response;
  await assert.rejects(readRealtimeAnswer(response, async id => { order.push(`bound:${id}`); }), /interrupted/);
  assert.deepEqual(order, ["bound:rtc_fixture", "body"]);
});

test("voice setup cannot proceed with an unbound call or an unrelated Location", async () => {
  const response = new Response("v=0", { headers: { location: "https://api.openai.com/v1/realtime/calls/rtc_fixture" } });
  await assert.rejects(readRealtimeAnswer(response, async () => { throw new Error("bind failed"); }), /bind failed/);
  assert.equal(response.bodyUsed, false);
  for (const location of ["https://other.example/v1/realtime/calls/rtc_fixture", "/v1/realtime/calls/../other", "/v1/realtime/calls/rtc_fixture?secret=value"]) {
    await assert.rejects(readRealtimeAnswer(new Response("v=0", { headers: { location } }), async () => { assert.fail("must not bind"); }), /identifier/);
  }
});

test("a denied auth-callback storage access cannot crash route discovery", () => {
  assert.equal(tryCompleteAuthSession(() => { throw new DOMException("Access denied", "SecurityError"); }), false);
  assert.equal(tryCompleteAuthSession(() => ({ type: "success" })), true);
});

test("microphone deadline releases a hung request and handles a late rejection", async () => {
  let reject!: (error: Error) => void;
  const work = new Promise<void>((_resolve, fail) => { reject = fail; });
  await assert.rejects(withDeadline(work, 10), /did not respond in time/);
  reject(new Error("late device failure"));
  await new Promise(resolve => setImmediate(resolve));
});
test("cancelling pending device work releases the UI before the device responds", async () => {
  const controller = new AbortController();
  const work = withDeadline(new Promise<void>(() => {}), 10000, controller.signal);
  controller.abort();
  await assert.rejects(work, /cancelled/);
  await assert.rejects(withDeadline(new Promise<void>(() => {}), 10000, controller.signal), /cancelled/);
  assert.equal(await withDeadline(Promise.resolve("ready"), 1000), "ready");
});
test("denied browser storage getter and quota failures keep preferences usable", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
    assert.equal(readWebPreference("theme"), null);
    assert.doesNotThrow(() => writeWebPreference("theme", "dark"));
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "light", setItem() { throw new Error("QuotaExceededError"); }, removeItem() { throw new Error("denied"); } } });
    assert.equal(readWebPreference("theme"), "light");
    assert.doesNotThrow(() => writeWebPreference("theme", "dark"));
    assert.doesNotThrow(() => writeWebPreference("theme", null));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
