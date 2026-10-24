# Public launch readiness — 2026-10-10

**Decision: NOT READY for public release. Continue code fixes and isolated verification only.**

The founder approved at most US$3 for controlled assessment validation, provided Android only, and confirmed that
the sending domain and every-minute scheduler are not ready. Public deployment and paid-service activation remain gated.
No APK, OTA update, store submission, source commit or GitHub push was performed in this hardening increment.

## Implemented in this increment

| Area | Before | Now | Root cause |
|---|---|---|---|
| Failed feedback | Responses saved, but no retry endpoint | Explicit owner-only feedback retry and mobile retry/status controls | Terminal state without a recovery transition |
| Killed assessment worker | ASSESSING could persist indefinitely | Durable 60-second leases, authenticated cleanup and recovery when reopening practice | State had no durable processing lease |
| Late feedback | State writes were not tied to a specific run | Run fencing; assessment and FEEDBACK_READY commit atomically | Separate unconditional writes |
| Legacy partial commit | Saved assessment could remain hidden after a crash | Reuses the saved assessment instead of making another paid request | Older two-write completion path |
| Paid-call abuse | Unlimited feedback calls and unverified free voice | Verified email required for AI feedback/voice; 10 feedback runs per account per UTC day by default | Missing eligibility and durable account-wide quota |
| Feedback retries | Attempt numbers collided across retries | At most three runs per conversation; at most two validation attempts per run | Attempt identity lacked a run namespace |
| Network ambiguity | Usage inserted only after the provider returned or failed | Nullable attempt ledger inserted before the call; no automatic network retry | Worker death could lose the billing trail |
| Cost reconciliation | Limited request correlation | Stable client request ID, returned provider IDs and unresolved-cost entries in the operator report | Insufficient diagnostic identifiers |
| Billing disabled in production | Development Executive grant could apply | Production/Vercel falls back to Free; dedicated isolated test exception has both paid providers disabled | Development grant was not environment-bounded |
| Practice activity | Creation dates could inflate or misdate activity | Learner answer timestamps drive streaks, practice days and weekly activity; measured voice stays separate | Conversation creation was treated as practice |
| Release checks | Email absent from preflight | Explicit email configuration/live-verification gate | Operational requirement omitted from the checklist |
| Public scenario catalog | Unpublished drafts appeared in the public library | Public endpoint filters published content; managers have an authenticated full catalog | Only recommendations, not the public library, enforced review status |

`ASSESSMENT_DAILY_LIMIT` accepts 1–100, default 10, across all plans. A failed or ambiguous run still consumes its quota;
it is not refunded merely because the client lost its connection. Text practice and existing voice plan prices are unchanged.
Daily text bars count completed practices with learner activity on that date; a practice spanning two dates can appear on
both. Weekly activity counts distinct conversations with learner answers or measured positive-duration voice, including
unfinished work. These are activity measures, not interchangeable completion totals or inferred text-practice minutes.

## Timeout and billing guarantees — and limits

- The foreground request receives an AbortSignal and is aborted at the configured deadline, capped at 30 seconds.
- A durable run lease is independent of the process timer. An expired or superseded worker cannot publish feedback.
- Valid known usage can reconcile after a late response while the worker is still alive, without publishing stale feedback.
- A killed worker or lost provider response can leave cost/token values **unknown (null)**. Do not interpret them as free calls.
- Network failures do not trigger an automatic second paid call. A learner must explicitly request another run within quota.
- The stable client request ID supports investigation; it is **not** a provider billing-idempotency guarantee.
- Operators must reconcile unresolved attempts with provider logs/billing and set provider-project spend limits before launch.
  This implementation does not claim remote cancellation acknowledgement or automatic provider invoice reconciliation.

Official references: [foreground/background cancellation](https://developers.openai.com/api/docs/guides/background),
[request correlation](https://developers.openai.com/api/reference/overview).

## Database release boundary

New migration: `202610101600_assessment_recovery`. It adds AssessmentRun, leases, quota indexes, one-running-run uniqueness,
run-scoped usage uniqueness, correlation fields and public-schema RLS/API-role denial for the new table.
The prior `202610101500_public_data_api_lockdown` migration is preserved. Both memory and PostgreSQL stores implement
the new operations. Existing attempt records retain their legacy uniqueness constraint through a partial index.

Migration deployment was restricted to `coach_verification`, with strict TLS and an explicit isolated DATABASE_TEST_URL.
The public-only ACL migration was a no-op in that schema. Production and the hosted APK test database were not upgraded.
The prior approved live public-schema lockdown remains documented in SUPABASE_ACCESS_AUDIT.md; this increment did not
repeat or expand that production change. Production migrations, backend-role access and backup/rollback require release review.

## Outstanding launch gates

| Gate | Current evidence | Required next step |
|---|---|---|
| Live AI feedback quality | Automated provider mocks only; no local OPENAI_API_KEY | Configure the key privately, run controlled calls within the approved US$3 cap, then review feedback usefulness |
| Native Android journey | Authorized Samsung SM-S908E connected; lock screen active | Unlock device, prepare an explicitly approved test build/backend, verify mic, interruption, transcripts, retry and progress |
| iOS | No physical iOS device available | Separate iOS validation before any iOS release; do not infer it from Android |
| Email and recovery | Sending domain not ready | Verify sender/domain and HTTPS links; deliver real verification and reset messages and test recovery |
| OAuth | Supabase integration in source; installed test features remain disabled | Verify native Google sign-in, callback handling and account linking on the release environment |
| Scheduler | Not approved/provisioned | Approve an every-minute scheduler and verify authenticated cleanup in hosted staging |
| Purchases | Automated verifier contracts only | Confirm store sandbox purchase, restore, expiry, refund and entitlement behavior |
| Database operations | Isolated migration tests; prior public ACL audit | Review existing-data migrations, backup/rollback and actual hosted backend role before promotion |
| Content/legal/store assets | 146 structurally valid scenarios; 20 HR drafts unpublished | Human content and policy review, final support/contact details, screenshots and accurate store declarations |
| Role-aware Phase 10 | Specification only | Implement/review context packs and career-level rendering separately; do not advertise it as delivered |

The API learner-journey test exercises registration → captured verification email → onboarding → recommended scenario →
primary response → independent retry → interrupted review → feedback retry → next exercise → measured progress.
Its email sender and AI provider are test doubles: it does **not** establish real delivery, paid-provider quality or device QA.

See TESTING_STATUS.md for exact command results and local evidence paths. A passing build is not public-launch approval.

Final automated checkpoint: typecheck PASS; general 158/158, regression 137/137 and isolated PostgreSQL 14/14 PASS;
API bundles/mobile web export PASS. Release preflight remains blocked (exit 1). No real-provider or native acceptance claimed.
