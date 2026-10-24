import { test } from "node:test";
import assert from "node:assert/strict";
import { practiceNavigation, radioSelection, textPracticeDescription, wrappingTextStyle } from "../apps/mobile/src/presentation";

test("mobile presentation: row headings and action labels can shrink without disabling font scaling", () => {
  assert.deepEqual(wrappingTextStyle, { flexShrink: 1, minWidth: 0 });
});

test("mobile presentation: only the parent stack supplies the practice header", () => {
  assert.equal(practiceNavigation.group.title, "Practice session");
  assert.equal(practiceNavigation.nested.headerShown, false);
});

test("mobile presentation: radio selection exposes matching native and web checked state", () => {
  for (const checked of [true, false]) {
    assert.equal(radioSelection(checked)["aria-checked"], checked);
    assert.equal(radioSelection(checked).accessibilityState.checked, checked);
  }
});

test("mobile presentation: practice copy distinguishes enabled, disabled and unknown feedback capability", () => {
  for (const retry of [true, false]) {
    assert.match(textPracticeDescription(true, retry), /requests an AI review/);
    assert.match(textPracticeDescription(true, retry), /remain saved/);
    assert.match(textPracticeDescription(false, retry), /limited local evidence check/);
    assert.doesNotMatch(textPracticeDescription(false, retry), /requests an AI review/);
    assert.match(textPracticeDescription(undefined, retry), /server determines/);
  }
});
