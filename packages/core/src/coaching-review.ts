import { z } from "zod/v4";

export const coachingAreas = [
  "opening", "organisation", "reasoning", "relevance", "conciseness", "clarity", "audience",
] as const;

export const coachingAreaLabels = {
  opening: "Starting the answer",
  organisation: "Thought organisation",
  reasoning: "Reasoning and trade-offs",
  relevance: "Relevance",
  conciseness: "Conciseness",
  clarity: "Sentence clarity",
  audience: "Audience-aware communication",
} as const;

const evidenceSchema = z.object({
  quote: z.string().trim().min(1).max(2000), turnId: z.string().min(1),
}).strict();

const evidenceNoteSchema = evidenceSchema.extend({ observation: z.string().trim().min(1).max(900) });

const areaScoreSchema = z.object({
  area: z.enum(coachingAreas), score: z.number().min(0).max(10).multipleOf(0.5).nullable(),
  rationale: z.string().trim().min(1).max(600), evidence: z.array(evidenceSchema).max(2),
}).strict().superRefine((value, context) => {
  if ((value.score === null) !== (value.evidence.length === 0)) {
    context.addIssue({ code: "custom", message: "A score needs evidence; unassessable areas must be unscored." });
  }
});

export const priorityCoachingSchema = z.object({
  title: z.string().trim().min(1).max(100), whyItMatters: z.string().trim().min(1).max(900),
  steps: z.array(z.string().trim().min(1).max(400)).min(1).max(3),
  suggestedWording: z.string().trim().min(1).max(900).nullable(),
}).strict();

export const coachingReviewSchema = z.object({
  version: z.literal("coaching-review-1"), reviewedPhase: z.literal("independent_retry"),
  summary: z.string().trim().min(1).max(900), opening: evidenceNoteSchema,
  scores: z.array(areaScoreSchema).length(coachingAreas.length).superRefine((values, context) => {
    if (new Set(values.map(value => value.area)).size !== coachingAreas.length) {
      context.addIssue({ code: "custom", message: "Each coaching area must appear exactly once." });
    }
  }),
  strengths: z.array(evidenceNoteSchema).max(2),
  strongerAnswer: z.object({
    text: z.string().trim().min(1).max(2400), whyStronger: z.string().trim().min(1).max(900),
  }).strict(),
}).strict();

export type CoachingReview = z.infer<typeof coachingReviewSchema>;
export type CoachingTurn = { id: string; role: string; text: string; phase?: string };

export function validateCoachingReview(review: CoachingReview, turns: CoachingTurn[]) {
  const retries = turns.filter(turn => turn.role === "user" && turn.phase === "independent_retry" && turn.text.trim());
  const evidence = [review.opening, ...review.strengths, ...review.scores.flatMap(area => area.evidence)];
  for (const item of evidence) {
    if (!retries.some(turn => turn.id === item.turnId && turn.text.includes(item.quote))) {
      throw new Error("Coaching evidence must quote the learner's independent retry");
    }
  }
  const firstRetry = retries[0];
  if (!firstRetry || review.opening.turnId !== firstRetry.id || !firstRetry.text.trimStart().startsWith(review.opening.quote)) {
    throw new Error("Opening evidence must come from the start of the independent retry");
  }
}

export function coachingOverallScore(review: CoachingReview): number | null {
  const scores = review.scores.flatMap(area => area.score === null ? [] : [area.score]);
  return scores.length < 4 ? null : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length * 10) / 10;
}
