import { test } from "node:test";
import assert from "node:assert/strict";
import { assessCommunicationEvidence, getEngagementLevel, getMasteryLevel, profileSchema, recommendScenarios, scenarios, transition, validateAssessment, voiceTransportStatus } from "../src/index";
test("scenario library contains 100-plus levelled practice scenarios", () => {
  assert.ok(scenarios.length >= 100);
  assert.equal(scenarios.filter(scenario => scenario.id.startsWith("library-")).length, 120);
  assert.deepEqual([...new Set(scenarios.map(scenario => scenario.level))], [1, 2, 3, 4, 5]);
});
test("role context selects different scenarios without assigning ability", () => {
  const profile = profileSchema.parse({ displayName: "Asha", function: "Human Resources", jobTitle: "HRBP", careerLevel: "Senior leader", audience: "Business leader", goal: "Explain ideas clearly" });
  assert.equal(recommendScenarios(profile)[0].id, "hr-engagement");
  assert.equal(recommendScenarios(profile, scenarios, 1).every(scenario => scenario.level <= 1), true);
  assert.equal(recommendScenarios(profile, scenarios, 2).some(scenario => scenario.level === 2), true);
  assert.equal(profile.timezone, "Asia/Kolkata");
  assert.equal(profile.planId, "professional");
  assert.equal(profileSchema.safeParse({ ...profile, timezone: "Not/AZone" }).success, false);
});
test("completed voice sessions cannot restart or bypass assessment", () => {
  assert.equal(transition("ACTIVE", "COMPLETED"), "COMPLETED");
  assert.throws(() => transition("COMPLETED", "ACTIVE"));
  assert.throws(() => transition("CREATED", "ACTIVE"));
  assert.equal(transition("EXPIRED", "ASSESSING"), "ASSESSING");
});
test("feedback must quote the learner and cannot claim audio analysis", () => {
  const feedback = { rubricVersion: "daily-1", modelVersion: "test-only", audioAssessed: false, priorities: [{ observation: "A concrete next action is stated", quote: "I will check tomorrow", turnId: "turn-1", nextExercise: "Try a new scenario", confidence: "low" }] };
  const turns = [{ id: "turn-1", role: "user", text: "I will check tomorrow and report back." }];
  assert.equal(validateAssessment(feedback, turns).priorities.length, 1);
  assert.throws(() => validateAssessment(feedback, [{ ...turns[0], role: "assistant" }]));
  assert.throws(() => validateAssessment(feedback, [{ ...turns[0], text: "Different answer" }]));
  assert.throws(() => validateAssessment({ ...feedback, audioAssessed: true }, turns));
});
test("voice transport status never reports live readiness without every native prerequisite", () => {
  assert.equal(voiceTransportStatus({ platform: "web", nativeModuleAvailable: true, developmentBuild: true, providerConfigured: true }).liveVoiceAvailable, false);
  assert.equal(voiceTransportStatus({ platform: "android", nativeModuleAvailable: false, developmentBuild: true, providerConfigured: true }).code, "DEV_CLIENT_REQUIRED");
  assert.equal(voiceTransportStatus({ platform: "ios", nativeModuleAvailable: true, developmentBuild: true, providerConfigured: false }).code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(voiceTransportStatus({ platform: "ios", nativeModuleAvailable: true, developmentBuild: true, providerConfigured: true }).code, "READY");
});
test("engagement levels reward practice activity without implying ability", () => {
  assert.deepEqual(getEngagementLevel({ completedSessions: 0, practiceMinutes: 0, currentStreakDays: 0 }), { level: 1, title: "Getting started", points: 0, nextLevelPoints: 60, pointsToNext: 60, progressPercent: 0 });
  assert.equal(getEngagementLevel({ completedSessions: 15, practiceMinutes: 200, currentStreakDays: 5 }).level, 5);
});
test("mastery levels require practice, scenarios, retries and evidence", () => {
  assert.equal(getMasteryLevel({ practiceDays: 0, completedScenarios: 20, successfulRetries: 20, evidenceAssessments: 20 }).level, 1);
  assert.equal(getMasteryLevel({ practiceDays: 2, completedScenarios: 1, successfulRetries: 1, evidenceAssessments: 1 }).level, 2);
  const evidence = assessCommunicationEvidence({ primary: "I will explain the evidence, the impact, and my recommendation for the next decision.", retry: "I recommend a staged plan because the data shows a risk. Next, I will confirm the owner and timeline." });
  assert.equal(evidence.passed, true);
  assert.equal(evidence.score, 100);
});
