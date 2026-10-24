# Detailed coaching review — 2026-10-24

## Requested experience

The founder supplied a feedback example with a summary, quoted opening, scorecard, strengths, specific reasoning gaps,
suggested wording and a stronger example answer. This increment adapts that presentation for all three workshops.
It does not copy the sample's compensation advice into other scenarios or manufacture an exercise number.

| Before | Now in source |
|---|---|
| Up to two quote/observation/next-exercise cards | Summary, opening, scorecard, strengths, focused improvements and rewrite |
| No detailed scorecard | Seven named areas, supporting retry evidence and explicit unassessable areas |
| Observations rendered as large headings | Short section titles with readable body text, quotes and practical steps |
| No model answer | Clearly labelled illustrative rewrite plus an explanation of why it is stronger |
| Existing feedback contract | Versioned detailed contract; earlier saved reviews remain readable without new scores |

## Presentation and scoring

1. Show the saved scenario title, not an invented exercise ordinal.
2. Show an overall AI coaching estimate and concise narrative summary.
3. Comment on the opening with an exact quotation from the start of the first learner independent-retry turn.
4. Present starting the answer, thought organisation, reasoning/trade-offs, relevance, conciseness, sentence clarity
   and audience-aware communication. Score only the independent retry, not a hidden mix of primary and retry.
5. Each assessed area has a half-point estimate from 0 to 10, an explanation and exact retry evidence.
   An unassessable area has a null score, no quoted evidence and a reason; the UI shows "Not assessed".
6. The overall is calculated, not model-supplied: equal-weight average of scored areas, rounded to one decimal,
   requiring at least four assessed areas. These are transcript-based AI estimates, not validated ability measurements.
7. Show zero to two genuine, evidence-linked strengths. Do not force compliments when none are supported.
8. Keep at most two improvement priorities. Each includes its observed gap and quote, why it matters, one to three
   practical steps, optional suggested wording and a concrete next exercise.
9. Show one hypothetical stronger answer and explain its decision/communication structure. Label all suggested wording
   as a rewrite, not the learner's own words. Prompts forbid adding unsupported facts, figures, policies or promises.
10. Preserve independent-transfer results, rubric/model provenance, ownership and the existing follow-up action.

The model receives the scenario and module framework, plus seven common area labels. Module rubrics are version 2;
the report is `coaching-review-1`. Reasoning is assessed as communication, not certified HR/financial/legal/technical advice.
Sentence clarity is about understandable meaning, not accent scoring or cosmetic grammar penalties.
Role/career-aware personalisation from Phase 10 is still not implemented by this increment.

## Evidence and compatibility boundaries

- Server validation rejects invented/foreign/assistant/primary quotes in report evidence; the priority quote rules remain.
- Every area must occur exactly once; invalid ranges, unsupported precision, unknown fields and missing new report data fail.
- New provider output must contain the detailed report and priority coaching fields. One schema correction attempt remains;
  repeated failure leaves saved turns intact and uses the existing recoverable feedback error path.
- The provider schema uses required object keys and denies additional fields, following the
  [official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
- Earlier stored reports with missing/null detailed content use the legacy view. They are not silently rescored or upgraded.
- Store validation preserves nested report JSON in memory and PostgreSQL adapters, including the atomic run-completion path.
- Structural validation cannot prove narrative correctness, usefulness or that a rewrite preserves every implied fact.
  Live provider quality, bias, calibration and human review remain release gates. No real provider call was made here.
- Scores do not feed into mastery, billing, plan access or measured practice time. Transfer validation remains unchanged.

## Persistence and deployment

Added nullable `Assessment.coachingReview` JSONB in migration `202610241200_coaching_review`.
No new table, grant or public-access policy is introduced. Existing assessments retain null detailed content.
Generate the Prisma Client and apply the migration to the approved target before deploying the new API.

Prisma Client generation passed locally. The isolated migration attempt failed before application, and a read-only
connection probe returned `FATAL: (ENOTFOUND) tenant/user postgres.nrrmhftccqsofjvoaffm not found`.
The connection/project state needs checking privately; the error alone does not establish the reason.
No database persistence pass is claimed for this increment, and no production migration was attempted.

## Verification and preview

- Required command results and evidence logs are in TESTING_STATUS.md.
- The authored UI fixture uses the real feedback component and React Native Web at 320px Light, 360px Dark and
  320px with enlarged 24px text. All three frames had zero horizontally overflowing elements; score evidence expanded.
- This is an isolated layout preview, not a signed-in phone journey or actual AI output. Unused native symbol,
  secure-storage and safe-area imports are stubbed in that preview; native safe-area/font-scaling acceptance is not claimed.
- Local preview: `http://127.0.0.1:8095/`; generated preview helpers and screenshots are ignored under artifacts/.
- The real mobile Expo web export also passed without those preview stubs.
- Existing installed APK, hosted test backend, OTA channel and production are unchanged. No commit, push or store submission.

## Still required before learner delivery

Restore isolated database connectivity and rerun the migration plus guarded PostgreSQL tests; conduct bounded real-provider
quality review and Android accessibility/interaction checks; then obtain release approval for backend/APK distribution.
The long home-page redesign discussed earlier is separate and was not changed in this feedback-format increment.
