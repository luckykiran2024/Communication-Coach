# Known issues and limits

## Native billing / latest database checkpoint — 2026-10-24

- Google Play and Apple billing source is prepared and regression-tested, not activated or store-validated. Play Console
  still reports identity/contact-phone verification required and Create app disabled; Apple enrollment/iPhone unavailable.
- Explicit BILLING_PROVIDERS=google supports Android-first credential setup without enabling Apple. No local/hosted billing
  flag was changed. Sandbox build profile needs confirmed final identifiers, real products, licensed testers and staging API.
- Native purchase blocks overlapping subscriptions rather than implementing seamless plan replacement/proration.
  Upgrade/downgrade semantics and sandbox lifecycle acceptance remain release gates, not completed features.
- Supabase now connects and the earlier coaching-review migration plus 16/16 persistence tests pass in coach_verification.
  Historical connection-failure notes below are superseded. Production and coach_apk_test remain unchanged.
- Browser verification uses simulated payment/AI/email and an Executive development grant; choosing a plan there is not
  a paid entitlement test. ADB still lists only an offline emulator. No new test APK or iOS device evidence exists.
- Email, scheduler, live AI/voice/OAuth, native store lifecycle, legal/content approval and public-release gates remain open.
  No charge, paid provider request, deployment, source push, cloud build or store submission occurred.
  See STORE_BILLING_TEST_PLAN.md for before/after, exact results and ordered next steps.

## Functional verification limits — 2026-10-24

- Browser learner-flow checks now have actual UI/API evidence, not only a component screenshot. Provider/email/payment
  fixtures and memory persistence are labelled; they do not establish live service quality or production database readiness.
- Duplicate practice headers, misleading enabled-feedback text, 320px home overflow and missing web checked/expanded state
  were fixed and retested. The broader long-home-page redesign is still a separate UX task.
- Native QA is blocked by the emulator acceleration failure and offline software instance; no physical phone is currently
  listed. Android/iOS voice, recording, interruptions, font scaling and store purchases remain unverified.
- Supabase isolated connection still returns tenant/user not found. Pending migration/database verification must precede
  deployment. Email/domain, scheduler, live OAuth/AI, store sandbox and final legal/content approval remain release gates.
  Its dashboard requires human GitHub sign-in before project status can be inspected; a paused-project diagnosis is not confirmed.
- Current code builds and automated checks pass, but public-launch sign-off is NOT granted. Existing APK/production are
  unchanged; see FUNCTIONAL_TEST_REPORT.md for the actual browser test matrix and external blockers.

## Detailed coaching review limits — 2026-10-24

- The requested report format is implemented in source, not delivered to the existing APK or hosted backend.
- Scores are transcript-based model estimates, not measured/certified ability scores. Structural quote/schema checks do not
  establish narrative correctness, domain advice, calibration or actual learning outcomes; real-provider review is pending.
- The isolated Supabase connection currently returns tenant/user not found. New migration/database persistence verification
  is blocked; check project/connection status privately before deploying or rerunning the guarded integration tests.
- Earlier assessments have no detailed report; they retain the original view without fabricated retrospective scoring.
- Browser fixture layouts pass narrow-width/enlarged-text checks, but Android/iOS accessibility, native font scaling and
  a full signed-in feedback journey remain unverified. No provider flag or release gate was relaxed.
- The long home-page redesign and Phase 10 role-aware personalisation are not included in this report-format change.
- See COACHING_REVIEW.md and TESTING_STATUS.md for current evidence; older checkpoints below are historical.

## Launch hardening checkpoint — 2026-10-10

- Fixed in source: failed/stuck assessment recovery, stale-worker fencing, verified-email gates and daily review quotas,
  production billing-off Executive fallback, answer-date progress/streak grouping and unpublished public-library entries.
- Pending release: real-provider feedback quality/cancellation/billing verification, unlocked Android voice/transcript/retry QA,
  separate iOS QA, verified email delivery/recovery, native OAuth, every-minute scheduling and store sandbox purchases.
- No local OpenAI key is present; the approved US$3 assessment-test cap is unused. No public release, APK/OTA update,
  source commit or push occurred in this increment. Hosted production/test services are unchanged.
- An aborted/killed worker can still leave provider charges unknown. Unknown ledger entries remain null and retain client
  request IDs; late known usage reconciles only while processing survives. Provider invoice reconciliation is operational,
  not automatic; verified email and per-account caps do not eliminate multi-account abuse or replace project spend limits.
- Public-schema ACL containment is the previously approved audit, not proof of a full production authenticated journey.
  New feature migrations were applied only to coach_verification; existing-data migration/rollback and backend-role review
  remain required. See PUBLIC_LAUNCH_READINESS.md for current gates and before/after details.

## Live database exposure — contained 2026-10-10

- The original 13-table public exposure is contained after approval: RLS is enabled and effective anon/authenticated
  table/column privileges are zero. The public-key User probe now returns HTTP 401/42501. No customer rows were fetched.
- The isolated coach schemas retain their existing denied API-role schema access and functional backend access.
  Postgres migration defaults are restricted; platform-owned supabase_admin defaults remain uneditable by this operator.
  Review future alternate-creator objects and possible historical exposure. See SUPABASE_ACCESS_AUDIT.md.
- Those feedback/quota/development-plan source gaps are fixed in the latest launch-hardening checkpoint above;
  they have not been deployed to the installed APK or production backend.
- No inference of actual compromise or verified unit economics is made. Production feature/deployment gates remain in place.

## Role personalization gap

- Phase 10 in CODEX_PLAN.md specifies every-function/every-career-stage personalization; it is not implemented yet.
- Current function tags do not guarantee distinct professional contexts. Career level/designation are not yet used for
  role-aware recommendations or assessment. The new context packs, career lenses and voice/feedback snapshots remain planned.
- The installed d66eca5b test APK has not gained these features from this documentation update.

## Current test release

- Refreshed test APK d66eca5b-8d55-4f71-aeca-79210ef5056d finished, passed artifact checks and installed successfully.
  The app process starts without sampled startup errors; phone lock prevents interactive theme/full native QA.
- Its isolated backend is refreshed and passes 31 hosted HTTP checks; latest local checks pass 138 general/117 regression tests.
- Live AI voice/assessment, OAuth, email delivery and purchases remain disabled. Executive test grants expose all workshops;
  this is not a paid-plan entitlement test. Production remains gated and unchanged. See TEST_APK.md.

## Release blockers

- The founder explicitly kept production gated during the Git publication request. Main Git deployments and automatic
  OTA publishing are disabled; see PRODUCTION_RELEASE.md. Latest release-gate checks pass 135 general/114 regression tests.
- Phases 6–9 are implemented locally, including assessment, feedback UI, independent voice retries, draft content,
  shared PostgreSQL rate limits and measured progress. See REMAINING_PHASES.md for evidence and remaining acceptance gates.
  Provider-backed assessment is disabled by default and has not been tested with a paid request or on the phone.
- The every-minute cron in apps/api/vercel.json needs a hosting plan that supports that cadence. Vercel Hobby is daily-only.
  Provision a strong CRON_SECRET and verify scheduling before serverless voice activation; no deployment was performed.
- Voice monetary averages require operator-supplied provider billing evidence. Missing cost data remains null, never zero.
- Final local verification passes 133 general tests, 112 regression tests and 9 isolated PostgreSQL tests; typecheck,
  API bundles and web export pass. Release preflight still exits 1 with configuration/manual acceptance gates.
- Legacy conversations without a snapshot can lose their catalog scenario. AI completion now rejects that case before
  claiming completion or calling the provider, preserving the learner's editable responses; restoring missing content is manual.
- The latest source groups practice/streak activity by learner answer timestamps rather than conversation creation.
  This correction is not yet in the installed APK/hosted backend; measured voice minutes remain separately recorded.
- Supabase Google OAuth is configured at the provider and implemented in source, not activated in the installed APK or hosted API.
  Google consent is still Testing; only the approved test account is registered. Native callback and real-account sign-in remain unverified.
- Supabase Auth user records are separate from custom application accounts. Existing app deletion does not delete that external
  identity record; complete the deletion/retention design and privacy disclosure before public OAuth release.

- Live AI voice is wired for a native development build with server-controlled phase and expiry settlement. The initial
  Realtime GA response payload is corrected and the mocked two-call loop passes. Real microphone/speaker behaviour,
  final transcript timing, native interruption handling and paid entitlement/provider evaluation remain unverified.
- Social buttons use `EXPO_PUBLIC_TWITTER_URL`, `EXPO_PUBLIC_FACEBOOK_URL`, `EXPO_PUBLIC_INSTAGRAM_URL` and `EXPO_PUBLIC_REDDIT_URL`; they fall back to platform landing URLs until the final branded profile handles are supplied.
- Display pictures can be selected from the native gallery or supplied as an image URL and remain on the device; server-backed profile media is not yet included.
- Payment has a development preview and a native `expo-iap` purchase/restore lifecycle. Server-side Apple and Google purchase adapters are implemented, but the API intentionally fails closed until both credential sets are configured. Server-created purchase intents, the authenticated entitlement webhook boundary, Apple Server Notifications v2 verification, Google Pub/Sub OIDC notification re-verification, lifecycle lookup, stale-event protection and server-authoritative product-to-plan allowance enforcement are implemented; sandbox evidence and production store credentials remain before charging users.
- Native recording/playback code is untested on actual Android/iOS devices.
- Docker's daemon remains unavailable. Hosted Supabase verification uses strict TLS in coach_verification;
  twenty migrations are applied there. Public and coach_apk_test were not migrated in this continuation.
- Supabase public access was confirmed and then contained through the approved public-only migration. The original
  read-only audit did not change permissions; the subsequent containment did. See SUPABASE_ACCESS_AUDIT.md.
- Email verification and password recovery are implemented and tested with mocked delivery and isolated PostgreSQL. Real sender credentials/domain, HTTPS recovery-link routing and native-device sign-off are still missing; production startup intentionally rejects absent delivery configuration. Retention jobs and session/device listing remain missing. Do not expose the preview as a public service.
- Microsoft now accepts signed ID tokens only, with configured audience allowlisting. It never trusts an email claim for automatic linking. Existing email collisions are refused; recovering a previously unverified Microsoft account removes its provider link, so use password login afterwards. Explicit authenticated linking and legacy Graph identity migration remain unsupported.
- Phase 5 web export passes, but Codex in-app browser requests to the local preview were refused/timed out. Screenshots and interactive UI verification were not obtained; temporary preview servers were stopped. A React Native DevTools fallback warning also occurred during Metro startup.
- Runtime boolean parsing has been repaired in source: only literal true/false strings are accepted, absent flags default
  to false, and malformed values fail startup. This prevents false from activating memory storage, voice or billing.
  Supabase activation uses the same strict parser. Deployment is still required before hosted runtimes use this fix.
- No tenant administration exists; enterprise screen is a public content preview.
- Dependency audit on 2026-09-24 reported 17 affected packages (4 high, 13 moderate), cascading from effect/deepmerge-ts in Prisma configuration and decode-uri-component/uuid in Expo tooling. No automatic forced downgrade was applied. Review upstream patches, remediate compatibly, rerun audit and all checks before release.
- No human trainer review or scientific validation of diagnostic content.
- The scenario library is seeded with structured practice content. Manager Studio now supports draft/publish/deprecate review status, persisted manager roles, production email allowlisting, scenario snapshots for learner history, revision history, and draft-only rollback. Full manager SSO remains pending; configure manager roles or `MANAGER_EMAILS` and review content before exposing it to a team.

## Development limitations

- Phase 3 voice accounting and active-session guards pass memory-backed and PostgreSQL integration tests. Advisory locks, the partial unique index, monthly/lifetime caps and cascade cleanup were exercised against the isolated Supabase verification schema. This does not verify a paid provider call or native device behavior.

- Plan session allowances are defined and enforced: the free tier grants two lifetime voice sessions; paid tier counts reset monthly in the profile timezone, and each voice session is capped at seven minutes. Migration `202610090002_monthly_voice_usage` passed on the isolated schema; review existing production data before applying it to the live schema.
- Text fallback uses server-owned phases and requires both responses. With assessment disabled it returns a labelled local
  heuristic. With assessment enabled it enters the validated AI review pipeline; neither path assesses audio or accent.
- Browser preview uses Web Speech API and Android/iOS use Expo Speech for spoken prompts. A rebuilt native runtime is required after dependency changes; accessibility announcement remains the fallback if device speech cannot start.
- Local microphone POC has no AI connection, VAD, barge-in, network recovery or persisted history.
- Audio cache files are deleted on normal screen exit; forced process termination may leave OS cache files. Add startup cleanup and verify all interruption paths before production.
- Mobile web tokens are memory-only; refreshing requires sign-in. Native uses SecureStore.
- Profile timezone is locked after first save; a support change workflow is not yet implemented.
- All twelve functions have management-library coverage, subject to plan/mastery gates. Twenty additional HR/manager
  scenarios remain unpublished drafts; no founder/trainer sign-off has been fabricated.
- Branding uses placeholder iconography. Final logos/store artwork and company/domain identity are not supplied.
- Light/dark mobile tokens are implemented; extensive animation and full accessibility/device review remain pending.
- The plan-reported malformed escaped-newline code in `apps/api/test/regression.test.ts` was not present in the current checkout. The source scan found only intentional newline escapes; no Phase 1 regression behavior needed changing.
# Isolated APK test environment update (2026-10-10)

The approved isolated test backend is deployed and its 30-request HTTP smoke flow passed. It deliberately uses an Executive workshop test grant; choosing a different plan is not a verified purchase/entitlement change. Email delivery, OAuth, AI live coaching and real store billing remain disabled. The test APK compiled, passed binary/configuration checks, installed and launched on the authorized Android phone. Native microphone/voice/theme/interruption/accessibility acceptance remains pending; see TEST_APK.md for the download and current evidence. The existing production database/API were not upgraded and main was not pushed.
