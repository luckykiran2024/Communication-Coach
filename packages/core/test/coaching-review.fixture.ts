import { coachingAreas, type CoachingReview } from "../src/coaching-review";

export function coachingReviewFixture(turnId: string, quote: string): CoachingReview {
  const evidence = { turnId, quote };
  return {
    version: "coaching-review-1", reviewedPhase: "independent_retry",
    summary: "You state a decision and name an owner. Make the reason for the next step equally clear.",
    opening: { ...evidence, observation: "You lead with the changed situation rather than background detail." },
    scores: coachingAreas.map(area => ({ area, score: area === "clarity" ? 7.5 : 8,
      rationale: "The response states a relevant next step; its reasoning could be more explicit.", evidence: [{ ...evidence }] })),
    strengths: [{ ...evidence, observation: "You give the listener a concrete action and owner." }],
    strongerAnswer: {
      text: "The dependency changed. I recommend confirming its impact before agreeing the revised rollout date.",
      whyStronger: "It makes the condition behind the recommendation explicit without inventing a commitment.",
    },
  };
}

export const priorityCoachingFixture = {
  title: "Make the decision logic explicit",
  whyItMatters: "An owner and date help, but the listener also needs the reason for the recommendation.",
  steps: ["Name the changed constraint.", "Explain how it affects the next decision."],
  suggestedWording: "I recommend confirming the dependency's impact before committing to a revised date.",
};
