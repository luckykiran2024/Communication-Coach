import { test } from "node:test";
import assert from "node:assert/strict";
import { createRealtimeClientSecret, RealtimeProviderError } from "../src/realtime-provider";
import { RealtimeVoiceProvider } from "../src/realtime-voice-provider";

test("realtime client secret adapter sends server-only credentials and safety identifier", async () => {
  let request: { url: RequestInfo | URL; init?: RequestInit } | undefined;
  const result = await createRealtimeClientSecret({
    apiKey: "server-key",
    safetyIdentifier: "hashed-user-id",
    model: "gpt-realtime-2.1",
    voice: "marin",
    instructions: "Coach the learner through this scenario.",
    expiresAfterSeconds: 900,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ value: "ek_test", expires_at: 1_800_000_000, session: { id: "sess_test" } }), { status: 200 });
    },
  });
  assert.equal(result.value, "ek_test");
  assert.equal(result.sessionId, "sess_test");
  assert.equal(request?.url, "https://api.openai.com/v1/realtime/client_secrets");
  assert.equal((request?.init?.headers as Record<string, string>)["OpenAI-Safety-Identifier"], "hashed-user-id");
  assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer server-key");
  assert.match(String(request?.init?.body), /gpt-realtime-2\.1/);
  assert.match(String(request?.init?.body), /marin/);
  assert.match(String(request?.init?.body), /gpt-4o-mini-transcribe/);
});

test("realtime client secret adapter clamps expiry and fails closed on provider errors", async () => {
  let body = "";
  await assert.rejects(() => createRealtimeClientSecret({ apiKey: "server-key", safetyIdentifier: "id", model: "model", voice: "voice", instructions: "prompt", expiresAfterSeconds: 9000, fetchImpl: async (_url, init) => { body = String(init?.body); return new Response(JSON.stringify({ error: "invalid" }), { status: 401 }); } }), RealtimeProviderError);
  assert.match(body, /7200/);
});

test("realtime voice provider can hang up an OpenAI WebRTC call server-side", async () => {
  let request: { url: RequestInfo | URL; init?: RequestInit } | undefined;
  const provider = new RealtimeVoiceProvider({ apiKey: "server-key", model: "model", voice: "voice", fetchImpl: async (url, init) => { request = { url, init }; return new Response(null, { status: 200 }); } });
  await provider.terminate("call_123");
  assert.equal(request?.url, "https://api.openai.com/v1/realtime/calls/call_123/hangup");
  assert.equal((request?.init?.headers as Record<string, string>).Authorization, "Bearer server-key");
});
