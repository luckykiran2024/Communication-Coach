import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessmentJsonSchema, assessmentRubrics, coachedAssessmentSchema, coachingAreas, coachingOverallScore,
  coachingReviewSchema, feedbackAssessmentSchema, validateAssessment,
} from "../src/index";
import { coachingReviewFixture, priorityCoachingFixture } from "./coaching-review.fixture";

const quote = "The dependency changed. I recommend confirming the impact before promising a date.";
const turns = [{ id: "retry", role: "user", phase: "independent_retry", text: quote }];
function feedback() {
  return {
    rubricVersion: assessmentRubrics.daily.version, modelVersion: "fixture", audioAssessed: false as const,
    transferResult: "partial" as const, coachingReview: coachingReviewFixture("retry", quote),
    priorities: [{ observation: "Make the impact explicit.", quote, turnId: "retry", nextExercise: "Explain a new constraint.",
      confidence: "medium" as const, coaching: { ...priorityCoachingFixture } }],
  };
}

test("coaching report: seven distinct areas, exact evidence, two priorities and deterministic overall", () => {
  const value = coachedAssessmentSchema.parse(feedback());
  const { transferResult: _transferResult, ...assessment } = value;
  assert.equal(validateAssessment(assessment, turns).coachingReview?.version, "coaching-review-1");
  assert.equal(coachingOverallScore(value.coachingReview), 7.9);
  assert.deepEqual(value.coachingReview.scores.map(area => area.area), [...coachingAreas]);
  assert.throws(() => coachedAssessmentSchema.parse({ ...value, priorities: Array(3).fill(value.priorities[0]) }));
});

test("coaching report: scores need evidence, allow explicit unknowns and never infer an overall from sparse evidence", () => {
  const review = coachingReviewFixture("retry", quote);
  review.strengths = [];
  for (const area of review.scores.slice(0, 4)) {
    area.score = null; area.evidence = []; area.rationale = "Insufficient evidence in the saved response.";
  }
  assert.ok(coachingReviewSchema.parse(review));
  assert.equal(coachingOverallScore(review), null);
  review.scores[0].score = 0;
  assert.throws(() => coachingReviewSchema.parse(review));
  review.scores[0].score = null;
  review.scores[0].evidence = [{ turnId: "retry", quote }];
  assert.throws(() => coachingReviewSchema.parse(review));
});

test("coaching report: invalid ranges, precision, duplicate areas and unknown fields are rejected", () => {
  for (const score of [-0.5, 10.5, 8.1, Number.NaN]) {
    const review = coachingReviewFixture("retry", quote);
    review.scores[0].score = score;
    assert.throws(() => coachingReviewSchema.parse(review));
  }
  const review = coachingReviewFixture("retry", quote);
  review.scores[1].area = review.scores[0].area;
  assert.throws(() => coachingReviewSchema.parse(review));
  assert.throws(() => coachingReviewSchema.parse({ ...review, overallScore: 10 }));
});

test("coaching report: strengths, opening and scores cannot cite fabricated, primary, assistant or foreign evidence", () => {
  for (const section of ["strength", "opening", "score"]) {
    for (const candidate of [
      { id: "retry", role: "assistant", phase: "independent_retry", text: quote },
      { id: "retry", role: "user", phase: "primary", text: quote },
      { ...turns[0], id: "someone-else" },
      { ...turns[0], text: "A different response" },
    ]) {
      const value = feedback();
      if (section === "strength") value.coachingReview.strengths[0].quote = "Fabricated strength";
      if (section === "opening") value.coachingReview.opening.quote = "Fabricated opening";
      if (section === "score") value.coachingReview.scores[0].evidence[0].quote = "Fabricated score evidence";
      const { transferResult: _transferResult, ...assessment } = value;
      assert.throws(() => validateAssessment(assessment, [candidate]));
      assert.throws(() => validateAssessment(assessment, turns));
    }
  }
});

test("coaching report: an exact substring from later in the answer is not an opening", () => {
  const value = feedback();
  value.coachingReview.opening.quote = "I recommend confirming";
  const { transferResult: _transferResult, ...assessment } = value;
  assert.throws(() => validateAssessment(assessment, turns), /Opening evidence/);
});

test("coaching report: valid priority evidence cannot conceal a report citing primary, assistant or foreign turns", () => {
  for (const section of ["strength", "score"]) {
    for (const candidate of [
      { id: "other", role: "assistant", phase: "independent_retry", text: "Other evidence" },
      { id: "other", role: "user", phase: "primary", text: "Other evidence" },
    ]) {
      const value = feedback();
      const evidence = section === "strength" ? value.coachingReview.strengths[0] : value.coachingReview.scores[0].evidence[0];
      evidence.quote = candidate.text; evidence.turnId = candidate.id;
      const { transferResult: _transferResult, ...assessment } = value;
      assert.throws(() => validateAssessment(assessment, [...turns, candidate]), /independent retry/);
      assert.throws(() => validateAssessment(assessment, turns), /independent retry/);
    }
  }
});

test("coaching report: old reviews remain readable without invented detail; new provider output requires full coaching", () => {
  const { coachingReview: _review, ...legacy } = feedback();
  const { coaching: _coaching, ...priority } = legacy.priorities[0];
  const old = { ...legacy, rubricVersion: "tasc-assessment-1", priorities: [priority] };
  assert.equal(feedbackAssessmentSchema.parse(old).coachingReview, undefined);
  assert.equal(feedbackAssessmentSchema.parse({ ...old, coachingReview: null }).coachingReview, null);
  assert.throws(() => coachedAssessmentSchema.parse(old));
  assert.throws(() => coachedAssessmentSchema.parse({ ...feedback(), priorities: [priority] }));
});

test("coaching report: provider schema has only required object keys and no unconstrained additional fields", () => {
  function check(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(check); return; }
    const node = value as Record<string, unknown>;
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...(node.required as string[])].sort(), Object.keys(node.properties as object).sort());
    }
    Object.values(node).forEach(check);
  }
  check(assessmentJsonSchema);
});
