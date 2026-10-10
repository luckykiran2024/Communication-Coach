import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { states } from "@coach/core";
import { ConflictError, type Assessment, type AssessmentUsage, type Store } from "../src/store";

type StoreFixture = { store: Store; close?: () => Promise<void> };

export function registerAssessmentStoreTests(name: string, setup: (context: TestContext) => Promise<StoreFixture>) {
  async function fixture(context: TestContext) {
    const { store, close } = await setup(context);
    const accountIds: string[] = [];
    context.after(async () => {
      try {
        for (const id of accountIds) if (await store.accountById(id)) await store.deleteAccount(id);
      }
      finally { await close?.(); }
    });
    const owner = await store.createAccount(`${randomUUID()}@assessment.example`, "test-only-hash");
    accountIds.push(owner.id);
    const other = await store.createAccount(`${randomUUID()}@assessment.example`, "test-only-hash");
    accountIds.push(other.id);
    const conversationId = randomUUID();
    const now = new Date("2026-10-10T10:00:00Z");
    await store.createConversation({
      id: conversationId, userId: owner.id, scenarioId: "engineering-delay", state: "CREATED",
      createdAt: now, updatedAt: now,
    });
    const assessment: Assessment = {
      id: randomUUID(), conversationId, rubricVersion: "tasc-assessment-1", modelVersion: "test-provider",
      priorities: [{
        observation: "State the owner clearly.", quote: "I will send the update.", turnId: randomUUID(),
        nextExercise: "Explain who will own a different handoff.", confidence: "high",
      }],
      audioAssessed: false, transferResult: "demonstrated", inputTokens: 100, outputTokens: 40,
      costMicros: null, createdAt: now,
    };
    const usage: AssessmentUsage = {
      id: randomUUID(), conversationId, attempt: 1, modelVersion: "test-provider",
      inputTokens: null, outputTokens: null, costMicros: null, createdAt: now,
    };
    return { store, owner, other, conversationId, assessment, usage };
  }

  test(`${name}: completion is owned and exactly one concurrent claimant wins`, async context => {
    const { store, owner, other, conversationId } = await fixture(context);
    assert.equal(await store.claimConversationCompletion(other.id, conversationId), false);
    assert.equal(await store.claimConversationCompletion(owner.id, randomUUID()), false);
    const claims = await Promise.all(Array.from({ length: 10 }, () =>
      store.claimConversationCompletion(owner.id, conversationId)));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal((await store.conversation(owner.id, conversationId))?.state, "COMPLETED");
  });

  test(`${name}: only created or interrupted conversations can be claimed`, async context => {
    const { store, owner, conversationId } = await fixture(context);
    for (const state of states) {
      await store.updateConversationState(owner.id, conversationId, state);
      assert.equal(await store.claimConversationCompletion(owner.id, conversationId),
        ["CREATED", "INTERRUPTED"].includes(state), state);
    }
  });

  test(`${name}: feedback is unique, immutable to callers and owner scoped`, async context => {
    const { store, owner, other, conversationId, assessment } = await fixture(context);
    assert.equal(await store.assessment(owner.id, conversationId), null);
    await assert.rejects(() => store.saveAssessment(other.id, assessment), /Conversation not found/);
    const writes = await Promise.allSettled(Array.from({ length: 10 }, () =>
      store.saveAssessment(owner.id, { ...assessment, id: randomUUID() })));
    assert.equal(writes.filter(result => result.status === "fulfilled").length, 1);
    for (const result of writes) {
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof ConflictError, `Unexpected write rejection: ${result.reason?.code ?? "unknown"}`);
      }
    }
    assert.equal(await store.assessment(other.id, conversationId), null);
    assert.equal(await store.assessment(owner.id, randomUUID()), null);
    const saved = await store.assessment(owner.id, conversationId);
    assert.ok(saved);
    assert.equal(saved.transferResult, "demonstrated");
    assert.equal(saved.audioAssessed, false);
    assert.equal(saved.costMicros, null);
    assert.equal(saved.createdAt.toISOString(), assessment.createdAt.toISOString());
    saved.priorities[0].quote = "changed by caller";
    assessment.priorities[0].quote = "changed input";
    assert.equal((await store.assessment(owner.id, conversationId))?.priorities[0].quote, "I will send the update.");
  });

  test(`${name}: feedback primary keys cannot be reused on another conversation`, async context => {
    const { store, owner, conversationId, assessment } = await fixture(context);
    await store.saveAssessment(owner.id, assessment);
    const secondId = randomUUID();
    await store.createConversation({ ...(await store.conversation(owner.id, conversationId))!, id: secondId });
    await assert.rejects(() => store.saveAssessment(owner.id, { ...assessment, conversationId: secondId }), ConflictError);
    assert.equal(await store.assessment(owner.id, secondId), null);
  });

  test(`${name}: attempt ledger enforces ownership, two attempts and uniqueness under races`, async context => {
    const { store, owner, other, usage } = await fixture(context);
    await assert.rejects(() => store.recordAssessmentUsage(other.id, usage), /Conversation not found/);
    const writes = await Promise.allSettled(Array.from({ length: 10 }, () =>
      store.recordAssessmentUsage(owner.id, { ...usage, id: randomUUID() })));
    assert.equal(writes.filter(result => result.status === "fulfilled").length, 1);
    for (const result of writes) {
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof ConflictError, `Unexpected write rejection: ${result.reason?.code ?? "unknown"}`);
      }
    }
    await store.recordAssessmentUsage(owner.id, { ...usage, id: randomUUID(), attempt: 2, inputTokens: 0, costMicros: 0 });
    await assert.rejects(() => store.recordAssessmentUsage(owner.id, { ...usage, id: randomUUID(), attempt: 3 }));
    await assert.rejects(() => store.recordAssessmentUsage(owner.id, { ...usage, conversationId: randomUUID() }));
  });

  test(`${name}: invalid feedback and usage fail without inserting records`, async context => {
    const { store, owner, conversationId, assessment, usage } = await fixture(context);
    const badFeedback = [
      { ...assessment, priorities: Array.from({ length: 3 }, () => assessment.priorities[0]) },
      { ...assessment, audioAssessed: true },
      { ...assessment, transferResult: "invented" },
      { ...assessment, inputTokens: -1 },
      { ...assessment, outputTokens: 0.5 },
      { ...assessment, costMicros: 2147483648 },
    ];
    for (const record of badFeedback) {
      await assert.rejects(() => store.saveAssessment(owner.id, record as Assessment));
    }
    for (const inputTokens of [-1, 0.5, NaN, Infinity, 2147483648]) {
      await assert.rejects(() => store.recordAssessmentUsage(owner.id, { ...usage, inputTokens }));
    }
    assert.equal(await store.assessment(owner.id, conversationId), null);
    await store.saveAssessment(owner.id, assessment);
    await store.recordAssessmentUsage(owner.id, usage);
    await store.deleteAccount(owner.id);
    assert.equal(await store.assessment(owner.id, conversationId), null);
    await assert.rejects(() => store.saveAssessment(owner.id, assessment), /Conversation not found/);
  });
}
