import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { scenarios } from "@coach/core";
import { buildApp } from "../src/app";
import { MemoryStore } from "../src/memory-store";

test("phase: advance requires a primary learner turn, ownership, an idle call and a single transition", async context => {
  const store = new MemoryStore();
  const app = await buildApp(store, { assessment: { enabled: false } });
  context.after(() => app.close());
  const registration = (await app.inject({ method: "POST", url: "/v1/auth/register", payload: {
    email: "phase@example.com", password: "long-phase-password",
  } })).json();
  const headers = { authorization: `Bearer ${registration.token}` };
  const id = randomUUID();
  const scenario = scenarios[0];
  await store.createConversation({ id, userId: registration.user.id, scenarioId: scenario.id, scenarioSnapshot: scenario,
    state: "CREATED", createdAt: new Date(), updatedAt: new Date() });
  const advance = () => app.inject({ method: "POST", url: `/v1/me/conversations/${id}/advance`, headers });
  assert.equal((await advance()).statusCode, 409);
  const first = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/turns`, headers,
    payload: { role: "user", text: "My primary response", phase: "independent_retry" } });
  assert.equal(first.json().turn.phase, "primary");
  const voiceId = randomUUID();
  await store.createVoiceSession({ id: voiceId, userId: registration.user.id, conversationId: id,
    reservationId: randomUUID(), monthKey: "2026-10", providerSessionId: "fake", providerCallId: null,
    providerTerminatedAt: null, status: "active", startedAt: new Date(), expiresAt: new Date(Date.now() + 60000), endedAt: null });
  assert.equal((await advance()).statusCode, 409);
  store.voiceSessions.get(voiceId)!.status = "ended";
  const attempts = await Promise.all(Array.from({ length: 5 }, advance));
  assert.equal(attempts.filter(result => result.statusCode === 200).length, 1);
  const second = await app.inject({ method: "POST", url: `/v1/me/conversations/${id}/turns`, headers,
    payload: { role: "user", text: "Independent response", phase: "primary" } });
  assert.equal(second.json().turn.phase, "independent_retry");
  store.voiceSessions.get(voiceId)!.status = "active";
  const transcript = await app.inject({ method: "POST", url: `/v1/voice/sessions/${voiceId}/transcript`, headers,
    payload: { role: "user", text: "Spoken independent response", phase: "primary" } });
  assert.equal(transcript.statusCode, 201);
  assert.equal(transcript.json().turn.phase, "independent_retry");
  const other = await store.createAccount("other-phase@example.com", "unused");
  assert.equal(await store.advanceConversation(other.id, id), false);
  await store.updateConversationState(registration.user.id, id, "COMPLETED");
  await assert.rejects(() => store.appendConversationTurn(registration.user.id, {
    id: randomUUID(), sessionId: id, role: "user", text: "late turn", createdAt: new Date(),
  }));
});
