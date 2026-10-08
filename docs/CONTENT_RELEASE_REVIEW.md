# Content release review

The catalog has an automated structural gate, but it must not be treated as human approval. Before release, a communication trainer or content lead must review the published scenario set, confirm that the prompts are appropriate for their levels and modules, and create a review evidence JSON file at `CONTENT_RELEASE_EVIDENCE_PATH`.

The evidence must be bound to the exact catalog currently being released:

Run `npm run content:hash` to obtain the current `scenarioCount` and `catalogHash`, then add the reviewer and approval fields.

```json
{
  "reviewer": "replace-with-reviewer-name",
  "reviewerRole": "Communication trainer",
  "status": "approved",
  "reviewedAt": "2026-10-06T10:00:00.000Z",
  "scenarioCount": 126,
  "catalogHash": "replace-with-sha256-catalog-hash"
}
```

Set `CONTENT_RELEASE_SIGNOFF=true` only after the review evidence has been independently checked. Any catalog change invalidates the hash and requires a new review.
