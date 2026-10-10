import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/memory-store";
import { registerAssessmentStoreTests } from "./assessment-store-contract";

registerAssessmentStoreTests("Memory assessment store", async () => ({ store: new MemoryStore() }));

test("Memory assessment store: account deletion removes assessment and usage rows", async () => {
  const store = new MemoryStore();
  const owner = await store.createAccount("delete-assessment@example.com", "test-only-hash");
  const other = await store.createAccount("keep-assessment@example.com", "test-only-hash");
  const now = new Date();
  for (const user of [owner, other]) {
    await store.createConversation({
      id: user.id, userId: user.id, scenarioId: "engineering-delay", state: "COMPLETED", createdAt: now, updatedAt: now,
    });
    await store.saveAssessment(user.id, {
      id: user.id, conversationId: user.id, rubricVersion: "test-1", modelVersion: "mock",
      priorities: [], transferResult: "not_yet", audioAssessed: false,
      inputTokens: 0, outputTokens: 0, costMicros: null, createdAt: now,
    });
    await store.recordAssessmentUsage(user.id, {
      id: user.id, conversationId: user.id, attempt: 1, modelVersion: "mock",
      inputTokens: null, outputTokens: null, costMicros: null, createdAt: now,
    });
  }
  await store.deleteAccount(owner.id);
  assert.equal(store.assessmentRows.size, 1);
  assert.equal(store.assessmentUsageRows.size, 1);
  assert.ok(store.assessmentRows.has(other.id));
  assert.ok(store.assessmentUsageRows.has(`${other.id}:1`));
});
