import { test } from "node:test";
import assert from "node:assert/strict";
import { modules, scenarios } from "../src/index";

test("content release gate covers a complete, levelled and reviewable scenario catalog", () => {
  assert.ok(scenarios.length >= 100);
  assert.equal(new Set(scenarios.map(scenario => scenario.id)).size, scenarios.length);
  for (const scenario of scenarios) {
    assert.ok(scenario.id.trim());
    assert.ok(scenario.title.trim());
    assert.ok(scenario.context.trim());
    assert.ok(scenario.question.trim());
    assert.ok(scenario.independentQuestion.trim());
    assert.notEqual(scenario.question.trim().toLowerCase(), scenario.independentQuestion.trim().toLowerCase());
    assert.ok(scenario.rubricVersion.trim());
    assert.ok(scenario.focus.trim());
    assert.ok(scenario.level >= 1 && scenario.level <= 5);
  }
  for (const module of modules) {
    for (const level of [1, 2, 3, 4, 5]) assert.ok(scenarios.some(scenario => scenario.module === module.id && scenario.level === level), `${module.id} is missing level ${level}`);
  }
});
