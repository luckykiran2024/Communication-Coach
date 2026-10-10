import { test } from "node:test";
import assert from "node:assert/strict";
import { functions, isPublishedScenario, profileSchema, recommendScenarios, scenarios } from "../src/index";

test("content: every function has at least three management scenarios with deliberate goals", () => {
  for (const functionName of functions) {
    assert.ok(scenarios.filter(scenario => isPublishedScenario(scenario)
      && scenario.module === "management" && scenario.functions.includes(functionName)).length >= 3, functionName);
  }
  const delay = scenarios.filter(scenario => scenario.id.startsWith("library-management-explain-delay-"));
  assert.equal(delay.length, 5);
  assert.ok(delay.every(scenario => scenario.goal === "Explain ideas clearly"));
  assert.ok(delay.every(scenario => scenario.question.includes("delivery risk")));
});

test("content: twenty concrete HR/manager drafts never enter learner recommendations", () => {
  const drafts = scenarios.filter(scenario => scenario.id.startsWith("hr-manager-"));
  assert.equal(drafts.length, 20);
  assert.equal(new Set(drafts.map(scenario => scenario.id)).size, 20);
  for (const scenario of drafts) {
    assert.equal(scenario.reviewStatus, "draft");
    assert.equal(scenario.reviewedBy, null);
    assert.notEqual(scenario.question, scenario.independentQuestion);
    assert.match(scenario.context, /[0-9₹]/);
  }
  const profile = profileSchema.parse({ displayName: "Asha", function: "Human Resources", jobTitle: "HR partner",
    careerLevel: "Experienced manager", audience: "Managers", goal: "Give constructive feedback" });
  assert.ok(recommendScenarios(profile, scenarios, 5).every(scenario => !scenario.id.startsWith("hr-manager-")));
});
