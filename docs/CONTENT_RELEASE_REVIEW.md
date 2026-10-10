# Content release review

## Phase 8 catalog checkpoint — 2026-10-10

- Total validated scenarios: 146 (126 existing previews and 20 new HR/manager drafts).
- Catalog SHA-256: `13ae3413546824a0a6fd8d7b30763a259d3ee929d9cb419e33742f722b7116f5`.
- The new pack covers review, PIP, pay/promotion, resignation/counter-offer, complaints, restructure,
  skip-level escalation and senior-peer feedback. Every new record remains `reviewStatus: draft` with no reviewer.
- Template goals are deliberate and stable across levels. All 12 functions have management coverage.
- No approval evidence was created. Learner recommendations exclude drafts even when passed the full catalog.
  Founder/content-lead review, explicit publication changes and a fresh hash-bound sign-off are still required.

The catalog has an automated structural gate, but it must not be treated as human approval. Before release, a communication trainer or content lead must review the published scenario set, confirm that the prompts are appropriate for their levels and modules, and create a review evidence JSON file at `CONTENT_RELEASE_EVIDENCE_PATH`.

The evidence must be bound to the exact catalog currently being released:

Run `npm run content:hash` to obtain the current `scenarioCount` and `catalogHash`, then add the reviewer and approval fields.

```json
{
  "reviewer": "replace-with-reviewer-name",
  "reviewerRole": "Communication trainer",
  "status": "approved",
  "reviewedAt": "2026-10-06T10:00:00.000Z",
  "scenarioCount": 146,
  "catalogHash": "replace-with-sha256-catalog-hash"
}
```

Set `CONTENT_RELEASE_SIGNOFF=true` only after the review evidence has been independently checked. Any catalog change invalidates the hash and requires a new review.
