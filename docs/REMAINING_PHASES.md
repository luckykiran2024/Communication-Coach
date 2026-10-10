# Remaining remediation phases — 2026-10-10

## Scope and completion boundary

Phases 6–9 are implemented in this local checkout. Phase 5 security code was already implemented; its live
email/OAuth verification remains outstanding. Automated tests are not a claim of production, provider-quality or
physical-device acceptance. The installed APK, hosted API, public database, GitHub and store releases are unchanged.
The original remediation plan is now retained at the repository root as CODEX_PLAN.md.

## Phase 6 — evidence-linked AI feedback

Before: saved answers were checked only by a length/keyword heuristic; there was no coaching review flow.

Now:
- The OpenAI Responses adapter sends a strict schema generated from the extended Zod assessment contract.
- Three versioned rubrics cover TASC, DIMA/CLEAR and MESSAGE with observable criteria and transcript-only instructions.
- Completion is claimed atomically, then moves through ASSESSING to FEEDBACK_READY. Quotes must match learner turn IDs
  exactly; assistant quotes, unknown IDs, wrong versions and more than two priorities are rejected.
- A missing legacy scenario is rejected before completion is claimed, preserving editable answers without a paid request.
- Invalid output gets one retry within a shared 30-second provider deadline. Failure preserves turns, records unknown
  usage where necessary and returns a clear error instead of fabricated coaching. Concurrent completion has one winner.
- Mastery uses demonstrated transfer when assessment is enabled. Disabled assessment uses explicitly labelled local_check.
- Owner-only feedback retrieval and a mobile review screen show up to two priorities, quoted evidence, a concrete
  next exercise, confidence, transfer outcome and a recommended next practice. Reviews can be reopened from practice.
- Every assessment attempt, including invalid output, has a token/cost ledger. Rates must be explicitly supplied;
  absent prices remain null. The read-only cost report can match externally reconciled voice billing by provider call ID.

Configuration: ASSESSMENT_ENABLED defaults false; ASSESSMENT_MODEL defaults gpt-5-mini. The provider key stays server-side.
Optional token rates are USD micros per million tokens. VOICE_COST_LEDGER_PATH is private operator-supplied billing evidence,
not client-reported usage. Missing billing evidence never becomes a zero-dollar average or an estimate from duration.

Still required: approved paid-provider quality/cost evaluation, operational billing reconciliation and native review-screen QA.

## Phase 7 — primary practice and independent transfer

Before: clients chose text phases and voice transcripts remained primary; a voice-only learner could not finish the loop.

Now:
- A new migration persists currentPhase and backfills existing learner retries.
- Both text and voice append operations take the phase from the owned conversation; legacy client phase hints are ignored.
- Advance is atomic and owner-scoped, needs a primary learner response and refuses active voice calls or repeat advances.
- Primary call instructions set the scene and permit at most two probes, without feedback. Retry instructions present
  only the independent situation and listen. Neither call scores the learner.
- The mobile app shows Ready for the new situation, then supports another voice call or text and the feedback finish flow.
- Queued transcripts are awaited before stopping voice. Failed transcript persistence is reported, not silently ignored;
  a saved text fallback clears the failure. Closed practice cannot start a new call.
- Provider expiry settles the call but leaves learning INTERRUPTED, preserving the phase and the ability to finish/retry.
- The initial native GA Realtime response now uses output_modalities: [audio]; the obsolete dual-modalities payload is removed.

Still required: physical Android/iOS two-call testing, interruptions, final-transcript timing and real provider audio quality.
The mocked two-call API test is not a microphone or speaker test.

## Phase 8 — explicit tagging and draft content

Before: a modulo calculation assigned unrelated goals across levels; no concrete HR/manager draft pack was included.

Now:
- Each of the 24 templates declares a semantic goal and an explicit function list, stable across its five levels.
- Every supported function has at least three management scenarios. Speaking and transfer prompts retain task-specific detail.
- Twenty HR/manager scenarios include named participants, concrete stakes/numbers and distinct transfer situations.
- Topics cover review, PIP, compensation/promotion denial, resignation/counter-offer, complaints, restructuring,
  skip-level escalation, senior-peer feedback and manager prioritisation.
- All twenty are draft, without reviewer approval. Core recommendations exclude drafts even when given the full catalog.
- Catalog count is 146; the current hash is recorded in CONTENT_RELEASE_REVIEW.md. No approval evidence was invented.

Still required: founder/content-lead editorial review, explicit publication changes and a fresh hash-bound release sign-off.

## Phase 9 — serverless operations and measured progress

Before: cleanup depended on a process timer, rate limits were process-local, progress multiplied completions by the chosen
practice length, and evidence reads performed per-conversation queries.

Now:
- Only RUNTIME=server runs the local cleanup interval. server.ts imports the actual runtime, not a previously generated function bundle.
- GET and POST /internal/cron/reap-voice-sessions require a timing-safe CRON_SECRET check; missing configuration fails closed.
  Vercel's every-minute cron targets /api/internal/cron/reap-voice-sessions. Hangup requests have a ten-second timeout.
- Rate-limit counters use a PostgreSQL atomic upsert, shared across function instances. Storage failures return 503,
  not a bypass. Vercel production refuses a memory-backed limiter; production configuration requires a strong cron secret.
- Expired counters are pruned by the authenticated cleanup route. Test fixtures use unique namespaces and remove their
  tracked buckets, without weakening the shared production limiter.
- Progress sums settled reservation consumed seconds for voice time. Text sessions, unknown durations and voice calls
  are separate; missing durations are excluded rather than guessed. Daily/weekly charts and engagement use measured time.
- Empty session creation does not create a practice streak. Mobile labels distinguish measured voice minutes from goals.
- Both stores batch conversation/evidence records. Prisma uses relation joins; a PostgreSQL test verifies one SQL query
  loads conversations, turns and assessment data. Recommendations and exports use the batch path too.
- CI uses the isolated schema and explicit test URL. Hosted tests retain strict TLS; only explicit loopback CI services
  may omit TLS. GitHub CI itself has not been run from this unpushed checkout.

Still required: approved deployment/migration, CRON_SECRET provisioning and a verified every-minute scheduler.
Vercel Hobby does not support the requested cadence. Upgrade or explicitly arrange an equivalent trusted scheduler;
do not silently downgrade cleanup to once daily. Function maxDuration is 60 seconds to accommodate the bounded assessment
plus database work. Configuration was changed in source only.

Official references: [Vercel cron behaviour](https://vercel.com/docs/cron-jobs),
[Vercel scheduler limits and authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[Realtime response events](https://developers.openai.com/api/reference/resources/realtime/client-events).

## Verification and release decision

See TESTING_STATUS.md for exact commands, actual results and intermediate failures. No new APK, OTA update, deployment,
store submission, Git commit/push or paid AI request was made. Existing free and paid plan prices/allowances are preserved.
Live email delivery, Google native/browser login, provider-backed voice/feedback, purchase sandbox evidence, privacy/deletion
review, RLS/grant review and human content approval remain release gates—not completed features hidden by placeholders.
