# Implementation status

## Account-creation legal consent — 2026-10-24

- The app identifies C2Coach as the India-based operator in its Terms of Service and Privacy Policy. Registration,
  including first-time Google/Microsoft sign-in, requires an explicit switch after a link to both documents; returning
  sign-in does not.
- The API enforces the current legal version for new accounts and stores its version and server timestamp. Existing accounts
  remain sign-in eligible. The welcome/home legal shortcut is removed; Settings retains legal access for existing users.
- Added a nullable database migration for the acceptance receipt. It has **not** been applied to hosted or production data,
  and neither the API nor mobile app has been deployed/rebuilt. Deploy in order: review policy and privacy contact,
  apply migration, deploy API, then release mobile. Do not ship this client against the old strict API schema.
- This is a test-build policy draft, not legal sign-off. The operator country is India; a verified operator identity,
  privacy/support email, public privacy URL, complete Supabase Auth deletion handling, and store disclosures still need
  approval before public launch.
- See TESTING_STATUS.md for automated and browser checks. No Git commit/push or APK update occurred for this change.

## Supabase Google sign-in — 2026-10-24

- Activated the existing PKCE Google flow in ignored local development configuration and the isolated Vercel test API.
  Real Google sign-in through the local web app reached onboarding with an API session; the isolated hosted API now
  rejects invalid Supabase tokens instead of reporting the provider disabled. Production remains gated.
- Configured the public Supabase URL/key in Expo's preview environment and enabled the mobile button only for the
  `test-preview` EAS profile. Existing APKs are unchanged. Native callback and hosted real-account QA are outstanding.
- Full typecheck and current general/regression suites pass. See SUPABASE_OAUTH.md and TESTING_STATUS.md for limits,
  remaining launch gates and evidence. No Git push or APK rebuild occurred in this continuation.

## Emerald Studio visual system — 2026-10-24

- Added Emerald Studio as the recommended palette for new installs, with pale sage Light and charcoal/forest Dark modes.
- Existing saved Sunrise, Ocean and Berry choices remain valid. The system-based appearance option remains absent.
- The palette now supplies foreground colours for primary buttons, microphone controls and errors as well as card,
  background, border and input colours. All four palettes meet the automated 4.5:1 text contrast check.
- A 1.2 KB bundled gradient mask gives pages and feature cards a soft colour transition without an added native package.
- Settings links to a live Colour & appearance screen. Changes apply across the app and persist on the device.
- This is a source and local-browser change. The installed APK, hosted app, GitHub and production remain unchanged.
  Native appearance and enlarged-text device checks are still required before a release.

## Native billing preparation — 2026-10-24 (latest checkpoint)

- Adopted Google Play Billing / Apple IAP, Android first; Razorpay is not added. Fixed monthly offer/account binding,
  pending/restore handling, provider-owned order/expiry validation, truthful confirmation and Android-only credential isolation.
- Added a gated store-sandbox AAB profile; final identifier, HTTPS staging API and store configuration are still required.
  Twenty-one new tests pass; typecheck PASS; general 197/197 and regression 176/176 PASS; API/web builds PASS.
- Supabase connectivity is restored. Applied the earlier coaching-review migration only to coach_verification;
  23 migrations present and guarded PostgreSQL suite 16/16 PASS. No billing migration added or production upgrade performed.
- Browser package preview/confirmation checked with explicit simulation. Real sandbox purchases remain NOT RUN.
- Play Console still reports identity/phone Action required with Create app disabled; Apple enrollment/iPhone unavailable.
  Emulator remains offline, no physical Android listed. Seamless subscription replacement/proration remains outstanding.
- No real charges, paid AI call, billing activation, cloud build, APK/OTA update, deployment, Git push or store submission.
  Release preflight remains BLOCKED; STORE_BILLING_TEST_PLAN.md contains the ordered owner/setup/test matrix and evidence.
  Older checkpoints below describe historical states, including the now-resolved Supabase connection blocker.

## Browser functional verification — 2026-10-24 (previous checkpoint)

- Exercised the real exported Expo app in the in-app browser through registration, onboarding, test email verification,
  package preview, all three workshops, primary/independent responses, interrupted assessment recovery, detailed feedback,
  follow-up practice, progress, themes, plan review, legal navigation, login/logout and recovery request.
- Fixed four reproduced defects: duplicate practice headers, stale no-feedback copy, small-screen row overflow and
  missing web accessibility selection/disclosure attributes. Retested the affected screens after rebuilding.
- Added a guarded loopback-only functional harness with disposable memory data and labelled injected AI/email fixtures.
  It refuses hosted/production execution; real voice/purchases stay off. The production API bundle contains no fixture marker.
- Typecheck PASS; 176/176 general and 155/155 regression tests PASS; API bundle and actual mobile web export PASS.
- Native testing remains BLOCKED: emulator acceleration check fails; software instance stays offline; no phone is listed.
  Supabase still rejects the isolated connection. Production email, scheduler, billing, OAuth, provider QA and legal/content
  sign-off remain outstanding; release preflight correctly exits 1.
- No production/hosted test deployment, paid request, migration, APK/OTA update, commit/push or store submission.
  See FUNCTIONAL_TEST_REPORT.md for actual cases, RCA, evidence and limitations. Earlier checkpoints below are historical.

## Detailed coaching reviews — 2026-10-24 (previous checkpoint)

- Implemented the founder's requested narrative feedback format: summary, quoted opening, seven-area scorecard,
  evidence-linked strengths, at most two practical improvement priorities and a clearly labelled illustrative rewrite.
- Versioned module rubrics to version 2 and require the detailed contract for new AI output. Every assessed area needs
  exact independent-retry evidence; unassessable areas remain null. Overall estimates are calculated, not invented metrics.
- Preserved older saved reviews without fabricating missing details, owner isolation, transfer/mastery rules,
  feedback recovery, quotas, usage tracking and provider-disabled behavior.
- Added nullable JSONB migration `202610241200_coaching_review`; Prisma Client generation passed.
  Isolated migration/database verification is BLOCKED by Supabase tenant/user lookup failure, not marked as passing.
- Narrow-screen authored layout fixtures passed overflow/score-expansion checks. Full mobile web export passed.
  This is not live AI quality, native-phone acceptance or delivery to the installed APK.
- Typecheck PASS; 171/171 general and 150/150 regression tests PASS. No live paid requests, production/hosted test deployment,
  APK/OTA update, Git commit/push or store submission. Existing uncommitted work was preserved.
- Full before/after behavior, score limitations, migration boundary and remaining checks: COACHING_REVIEW.md.

## Launch hardening — 2026-10-10 (previous checkpoint)

- Implemented explicit feedback recovery with durable AssessmentRun leases and an owner-only retry endpoint.
  Both stores atomically commit verified feedback/state and fence expired workers; legacy partial commits reuse saved feedback.
- Added verified-email gates before paid feedback/voice, a default 10-run/account/UTC-day cap, three runs/conversation,
  run-scoped attempt uniqueness and pre-request nullable usage records. Ambiguous failures consume quota, not free retries.
- Foreground timeout reaches provider fetch; network failures are not automatically retried. Request IDs and unresolved-cost
  reporting support investigation; remote cancellation and provider billing reconciliation are not claimed as verified.
- Production/Vercel billing-off now resolves Free, not the development Executive grant. The dedicated isolated test exception
  requires paid assessment and voice disabled. Vercel runtime rejects non-production NODE_ENV.
- Learner answer timestamps now drive streaks, practice days and weekly activity. Voice minutes remain measured separately.
- Public scenario-library responses now exclude drafts/deprecated content; verified managers retain a full-catalog endpoint.
  Source content in this public repository is not confidential; this is a learner-publication boundary, not source secrecy.
- Mobile practice offers saved-response feedback retry and status refresh. Web export and API bundles compile;
  interactive browser/device acceptance is still pending. Installed APK and hosted services have not received these changes.
- Added migration `202610101600_assessment_recovery`; generated Prisma Client successfully and applied pending migrations
  only to `coach_verification` over strict TLS. The prior public-only ACL migration is a no-op there. No production upgrade.
- Added automated coverage for quotas/races, stale leases, legacy recovery, late usage, abort propagation, cached retries,
  production plan isolation and an HTTP learner journey using injected email/AI test doubles.
- Public release remains **BLOCKED**. The founder approved at most US$3 for assessment tests, but the local key is absent;
  no paid calls were made. Email domain and scheduler are not ready; Android is connected but locked; iOS is unavailable.
- See TESTING_STATUS.md for final measured results and PUBLIC_LAUNCH_READINESS.md for the before/after RCA and gate matrix.
  Older dated checkpoints below are historical, not a claim that their outstanding items describe the latest source.
- Final checks: typecheck PASS; 158/158 general, 137/137 regression and 14/14 isolated PostgreSQL tests PASS.
  Both API bundles and mobile web export PASS. Release preflight correctly exits 1 with outstanding configuration/manual gates.

## Approved Supabase public-access containment — 2026-10-10

- Applied only the new public-schema access migration at 09:40:08 UTC after explicit founder approval, with atomic rollback
  rehearsal, inventory/owner guards, lock timeouts, idempotence checks and no customer-data mutation.
- RLS now enabled on all 13 existing public tables; anon/authenticated table/column privileges are zero. Public-key User read
  changed from HTTP 200 to HTTP 401/42501. Owner zero-row read/write succeeds; actual postgres future-table defaults deny access.
- Added five separately invoked read-only live integration checks. Restricted test schemas are unchanged; 31 hosted
  test-backend smoke requests pass. Both API health endpoints retain HTTP 200; full authenticated production QA is not claimed.
- Only direct containment SQL ran; no unrelated feature migrations or manually inserted migration-ledger entries.
- Platform-owned supabase_admin defaults cannot be edited by postgres. Future alternate-creator objects require review;
  current postgres-created application table/sequence defaults are hardened. See SUPABASE_ACCESS_AUDIT.md.
- Feedback recovery, paid-call abuse limits and production development-plan isolation remain found, not fixed.
- No commit/push, APK/OTA, deployment, production email/scheduler activation or paid-provider call occurred.

## Live Supabase security audit — 2026-10-10

- Confirmed critical public Data API exposure: all 13 existing public tables have disabled RLS and effective read/write
  privileges for anon/authenticated. A public-key-only, zero-row User request returned HTTP 200.
- The two isolated coach schemas deny schema access to those roles. No customer records were fetched or live settings changed.
- Root cause, role/default-grant cautions and remaining source gaps are recorded in SUPABASE_ACCESS_AUDIT.md.
- At this audit checkpoint remediation awaited approval; the later approved containment is recorded above.
  Existing green unit tests alone do not verify live ACLs.
- No application code, migrations, paid-provider activation, commit/push, production deployment or APK changes in this audit.

## Phase 10 planning — 2026-10-10

- Added the role-aware, every-function/every-career-stage specification to CODEX_PLAN.md; HR is not the whole product.
- Defines 12 context packs, seven career lenses, reviewed offline drafts, role snapshots, counterpart-aware voice and contextual feedback.
- Keeps career seniority separate from the existing five communication-mastery levels and preserves all release/provider gates.
- Specification only: no Phase 10 application code, migrations, content generation/publication, Git push or APK/deployment change.
- Verification of the unchanged application: typecheck PASS, general tests 138/138, regression tests 117/117.
  These results do not verify planned Phase 10 functionality; no new behavior tests were added for this documentation increment.

## Isolated test APK refresh — 2026-10-10

- Approved new test APK d66eca5b-8d55-4f71-aeca-79210ef5056d finished from the GitHub-published theme source.
- Refreshed only communication-coach-test-api and applied all 20 migrations in coach_apk_test, preserving its existing account.
- Hosted smoke checks pass 31/31, including explicit independent-retry advancement and measured text/voice progress.
- Repeated actual local checks: typecheck PASS, general tests 138/138, regression tests 117/117.
- APK download/CRC, embedded test API and Android package/channel checks pass. adb install -r reports Success;
  launch returns Status: ok and the app process remains running without sampled startup error matches.
- Phone lock prevents interactive theme verification; that and full native QA remain pending. Real provider/billing
  features remain disabled and production is unchanged.
  See TEST_APK.md for exact release identifiers, scope and limitations.

## Light/Dark-only appearance — 2026-10-10

- Removed System from Settings and the theme-mode type; only Light and Dark remain.
- New installs default to Light. Saved System/missing/invalid preferences migrate to persisted Light;
  existing explicit Light/Dark preferences are preserved. Appearance no longer follows the device theme.
- Colour palettes, voice accents and device reduced-motion support are unchanged.
- Actual checks: typecheck PASS, general tests 138/138, regression tests 117/117, targeted theme tests 3/3.
- Source-only change prepared for the requested GitHub publication; APK/OTA and production remain unchanged.
  Physical-device QA has not been performed for this theme change.

## Source publication checkpoint — 2026-10-10

The founder requested a GitHub push and production deployment, then explicitly chose to keep production gated until
email delivery and scheduler prerequisites are ready. Automatic Vercel Git deployment for main is disabled and EAS
updates are manual-only, preventing a source push from migrating production or updating the installed APK.
Latest checks: typecheck PASS, 135/135 general tests, 114/114 regression tests; prior isolated database verification 9/9.
PRODUCTION_RELEASE.md records the intended project, inspected production commit and outstanding configuration.
No production deployment or APK update is claimed by a Git commit or push.

## Remaining-phase continuation — 2026-10-10

- Phase 6: structured, versioned AI feedback, owner-only review, bounded validation retry and usage ledger implemented.
  The provider remains disabled by default. No paid provider call, deployment or APK change was made.
  Cost reporting preserves unknown prices as null; voice monetary costs require provider billing reconciliation.
- Phase 6 checkpoint: typecheck PASS; general tests 118/118; regression tests 97/97.
- Phase 7: server-owned primary/retry phase, atomic advance and phase-specific live instructions implemented.
  The app explicitly advances after saving the primary answer; transcript writes are awaited before stopping voice.
  Historical checkpoint: typecheck PASS; general tests 119/119; regression tests 98/98. PostgreSQL was subsequently verified below; native checks remain pending.
- Phase 8: explicit template tagging and 20 HR/manager drafts implemented; draft exclusion is enforced in core recommendations.
  Checkpoint: typecheck PASS; general tests 121/121; regression tests 100/100. Human content approval remains outstanding.
- Phase 9: authenticated serverless cleanup, persistent shared rate limits, measured voice-time progress and batched evidence reads implemented.
  PostgreSQL tests verify cross-instance rate counters, phase transitions, expiry settlement and a single-query evidence read.
- Final phase verification: typecheck PASS; general tests 133/133; regression tests 112/112; isolated PostgreSQL tests 9/9.
  Production/test API bundles and Expo web export pass locally. Twenty migrations are applied only in coach_verification;
  fixture inspection found zero residual test accounts. Public and coach_apk_test schemas are unchanged.
- Phases 6–9 are implemented locally, not release-approved. Live email/OAuth, paid provider quality/cost checks, store billing,
  physical Android/iOS QA, privacy/content approval and an approved every-minute scheduler remain outstanding.
  Release preflight exits 1 with explicit blockers. No deployment, Git push, paid request, APK/OTA or store update was made.
  See REMAINING_PHASES.md for before/after details and TESTING_STATUS.md for actual command results and repaired failures.

## OAuth activation hardening continuation — 2026-10-10

- Fixed the runtime environment parser: the string false no longer enables memory storage, paid voice or billing.
  All four feature flags, including Supabase OAuth, accept only true/false strings and default to disabled.
- Prepared the isolated test handler for optional Supabase Google activation. The approved project URL and public-key
  type are checked before activation; existing dedicated Vercel project, database-role/schema and strict TLS guards remain.
- No environment activation, hosted deployment, Git push or APK update was performed. Browser sign-in is still unverified.
  A hosted test-backend/browser-preview approval has been requested; production and the installed APK remain unchanged.
- Actual checks: full typecheck PASS, general tests 111/111, regression tests 90/90 and local test API build PASS.
  No database test was rerun for this configuration-only increment; previous isolated PostgreSQL verification passed 8/8.

## Supabase Google OAuth checkpoint (2026-10-10)

- Google OAuth client created with founder approval; Google provider enabled in Supabase project `nrrmhftccqsofjvoaffm`.
- Google consent remains External / Testing, with the approved founder account registered as a test user.
- Mobile PKCE/S256 browser flow and server-verified Supabase identity exchange are implemented, preserving existing app accounts,
  password login, profiles, practice history and revocable app sessions. Microsoft remains deferred.
- Local configuration contains only the public project URL/publishable key; activation flags remain disabled until controlled deployment.
  The Google client secret is stored in Supabase, not source, Git or the APK.
- Continuation: implemented the four missing Phase 6 Store methods in both repositories. Completion claiming is atomic;
  feedback and attempt-ledger writes enforce ownership, uniqueness, valid counters and two-attempt limits. Memory deletion
  now cascades assessment data and returns isolated copies. These are storage foundations, not the full AI assessment feature.
- Latest automated results: full typecheck PASS; 105/105 general tests, 83/83 regression tests and 8/8 isolated PostgreSQL tests pass.
  Test API bundle build passes locally. Final disposable assessment-fixture inspection found zero residual fixtures.
  Earlier mobile typecheck, web export and Android JavaScript export passed (Android required a workspace-local TEMP retry).
- Prisma client regenerated. The existing `202610101200_assessment_feedback` migration was applied only to
  `coach_verification` (now 18 migrations); public and `coach_apk_test` schemas were not migrated.
  Earlier failed typecheck and “Phase 6 has not started” statements below describe historical checkpoints.
- No deployment, Git push or APK update was performed for OAuth. Real Google account sign-in on the phone
  and Supabase Auth user deletion/retention integration remain release gates. See SUPABASE_OAUTH.md and TESTING_STATUS.md.
- Browser-only continuation was attempted, but browser URL policy and failed independent localhost probes prevented
  interactive verification. Temporary servers were stopped; a working preview or real Google login is not claimed.

## Implemented

- TypeScript npm monorepo with Expo Router mobile app, Fastify API, Next.js portal and shared core package.
- Sign-up/login/logout endpoints; scrypt passwords, seven-day opaque sessions and native SecureStore integration.
- Phase 5 email verification/recovery, safe OAuth linking, Microsoft ID-token verification and timing-safe secret checks; see ACCOUNT_SECURITY.md.
- Private profile storage through a Prisma PostgreSQL repository. Profile owner is derived only from the authenticated session.
- Three-step onboarding and edit form: role/function/career level, audience, goal/challenges, language, practice length, timezone and reduced-motion preference.
- Six versioned, role-specific scenario previews spanning three modules; goal/function recommendation logic.
- Five server-configured plans: Free (2 lifetime sessions), Essential ₹299/15 sessions monthly, Professional ₹399/20, Executive ₹699/40, and Extended ₹799/60; paid sessions are capped at seven minutes each.
- Native audio-check code for explicit consent, microphone permission, recording, playback, deletion and app-background interruption.
- Session state-machine contract and evidence-quote validation, with automated tests.
- Responsive portal scenario explorer; no private employee data.
- PostgreSQL migration, Docker Compose, EAS profiles, CI and setup documentation.
- Server-side voice usage tracking: profile-timezone monthly session counts, seven-minute reservation caps, atomic plan capacity checks, and monthly usage display in the app.
- Persisted owner-scoped conversation records with scenario authorization, private retrieval, and an explicit `CREATED` state. The live provider path is disabled by default.
- Mobile scenario cards can create an owner-authorized `CREATED` practice record; the UI stops before provider access and labels the local-audio fallback.
- Practice detail supports an owner-scoped text response fallback; only learner turns can be saved, with no generated assistant feedback.
- Learners can finish a text fallback after saving a primary response and independent retry; it records `COMPLETED` and a transparent local evidence signal without claiming audio assessment.
- Provider-independent lifecycle coordinator with reservation-before-connect, explicit state transitions, and fail-safe settlement on provider errors.
- Optional server-only OpenAI Realtime client-secret creation is wired through the lifecycle coordinator; the native app remains gated until WebRTC and disconnect settlement are verified.
- Configured voice sessions are persisted with owner-scoped stop and consumed-second settlement; bound WebRTC calls can now be terminated server-side, with a persisted retry sweep for failed expiry cleanup. Realtime input and output transcript events are persisted against the authenticated conversation, while the readiness endpoint distinguishes server/provider configuration from native WebRTC development-build readiness. Physical QA and provider-backed assessment remain release blockers.
- Native `expo-iap` purchase and restore flows are wired to server-created purchase intents and a fail-closed purchase verification endpoint; server-side Apple and Google purchase adapters are wired behind environment credentials, and verified Apple Server Notifications v2 plus Google Pub/Sub OIDC-authenticated notifications update renewal/refund state with stale-event protection. Sandbox evidence and production store credentials remain required before charging users.
- Authenticated voice capability contract that distinguishes web preview, missing native development build, missing provider configuration, and ready state.
- Authenticated sign-out-all endpoint and mobile action revoke every session for the current account.
- Authenticated data export returns only the account profile, practice records, and learner turns; credentials and session tokens are excluded. Account deletion cascades private data and revokes sessions.
- 146-scenario catalog across three modules and five levels, including 20 unpublished HR/manager drafts, with mastery-gated recommendations and manager-authored scenario persistence.
- Manager-authored scenarios retain owner/reviewer metadata, enter the library as drafts, and require explicit publication before learner recommendations can use them. Production Manager Studio hides the development key and requires an approved manager session; production startup rejects malformed manager email allowlists and non-HTTPS origins.
- New conversations persist their scenario snapshot, protecting active/history records from later manager content changes.
- Manager Studio now exposes revision history and draft-only rollback; rollback never republishes content automatically.
- Production Google OAuth audience allowlisting is enforced server-side through `GOOGLE_OAUTH_CLIENT_IDS`; unrecognized Google application audiences are rejected before account linking.

## Remaining implementation and release work

Realtime and provider-backed assessment code is implemented but disabled by default and not live/native verified. Remaining work includes diagnostic profiles, validated history-driven skill profiles, live email delivery/native recovery verification, production store credentials/sandbox verification, operational cost reconciliation, worker queues, organizations/tenant administration and final release assets. Content, privacy and physical-device acceptance are not replaced by automated tests.

The live voice endpoint remains feature-flagged and returns 503 until provider configuration and native transport prerequisites are present. Active plan module access and voice-session allowances are enforced server-side. Billing-disabled development uses `DEV_PLAN_ID` (default `executive`); billing-enabled accounts use verified paid entitlements or the two-session free tier.

The mobile app now includes local theme selection, device-local display-picture links, social follow shortcuts, plan/progress settings, practice-activity engagement levels, and mastery-gated scenario levels. Mastery requires minimum practice days, completed scenarios, successful independent retries and evidence checks; it is not a validated communication skill score.

## Verification and blockers

See TESTING_STATUS for executed checks. Supabase PostgreSQL verification now succeeds against the isolated `coach_verification` schema; Docker CLI is installed but its daemon is unavailable. No Android/iOS devices or native build toolchains were verified in this remediation checkout. No provider credentials were configured and no paid usage was authorized. Store accounts and product IDs are not configured.

Current verification: TypeScript checks, 77 automated tests, 56 regression/content/security tests and two PostgreSQL integration tests pass. Phase 5 mobile web export passes. Earlier portal production build and Android/iOS JavaScript exports passed. Expo dependency compatibility passed. Phase 5 browser interaction and native recovery remain unverified.

The regression suite runs independently through `npm run test:regression` with 56 regression, core-content and security tests and is also included in the general `npm test` glob.

Phase 1 verification (2026-10-09): all three required commands pass. Generated API and core bundles are ignored and untracked; the Vercel build still regenerates the API bundle paths. The plan-reported malformed regression-test line was already syntactically valid in this checkout, so its intent was left unchanged.

Phase 2 verification (2026-10-09): extracted Fastify routes into nine focused modules (`health`, `auth`, `profile`, `scenarios`, `manager`, `conversations`, `progress`, `voice`, `billing`) with `register(app, deps)` entry points. Shared auth/session, error, time/day-boundary and learner-evidence helpers now live under `apps/api/src/lib`. Both progress endpoints use the shared learner evidence calculation. `apps/api/src/app.ts` is 59 lines and remains the app/dependency composition entry point. Existing API contracts and route behavior were preserved; typecheck, all 54 tests, all 35 regression/content tests and whitespace validation passed.

Phase 3 verification (2026-10-09): voice stop charges server-measured elapsed seconds, expiry charges through the session deadline, and the client receives and displays the server-settled seconds. The client duration is only a diagnostic hint. Per-user/day reservation uses a PostgreSQL transaction advisory lock and an equivalent per-key memory-store queue. Only one active voice session per user is permitted, enforced by the route, memory store and a partial unique PostgreSQL index. Start failures settle reservations on the server. PostgreSQL integration was attempted but could not run because no isolated `DATABASE_URL` or `apps/api/.env` is available; the migration has not been applied locally.

Phase 4 verification (2026-10-09): implemented the founder-confirmed five plan prices, monthly session limits and seven-minute maximum; a two-session lifetime free tier; server-authoritative plan/module filtering; monthly usage and rollover in the profile timezone; the authenticated voice-usage endpoint; session-slot reservation/release and elapsed-second settlement; and server-selected Realtime model delivery to mobile. Home, plans, payment and Settings now show monthly/lifetime session information. Billing-disabled plan choice uses `DEV_PLAN_ID` (default Executive); editing the profile plan alone does not change server authorization. Verification: typecheck passed; `npm test` passed 60/60; `npm run test:regression` passed 39/39. Database integration and migration application remain unverified without PostgreSQL credentials.

Supabase verification update (2026-10-10): the corrected credentials authenticate successfully with strict TLS and the official Supabase CA. All 16 migrations, including the Phase 3 active-session index and Phase 4 monthly usage migration, were applied successfully in the isolated `coach_verification` schema. Existing public application tables were not migrated or used for test records. Schema access was revoked from PUBLIC, anon and authenticated roles. The PostgreSQL integration test passes, covering persistence, daily/monthly reservation races, lifetime free limits across months, one active voice session, repeated-stop charge protection, manager revisions/rollback and cascading cleanup. Verification exposed and fixed an invalid Prisma reservation write that spread the transport-only `seconds` field into database input. The test now uses authenticated manager access instead of a hard-coded development key and a fixed clock. The ignored `.env` contains a separate `DATABASE_TEST_URL` for safe repeat runs. Phase 5 and the final APK remain untouched.

## Next task

Phase 5 source implementation and automated verification are complete; live email delivery and native testing are release gates, not verified features. See ACCOUNT_SECURITY.md for contracts, root causes, before/after details, changed files and remaining founder inputs. Phase 6 has not started. Production still needs an existing-data migration review, Supabase Data API hardening, email/provider/store configuration and device verification. Do not rebuild the final APK until requested.

## Git checkpoint

The founder subsequently approved the isolated test backend. `communication-coach-test-api` is deployed with all 17 migrations in a new `coach_apk_test` schema and a restricted database login; existing public application tables remain untouched. The new API serves the current prices/monthly-session contract and passed 30 hosted HTTP checks. Test grants enable Executive workshops only; real email, OAuth, AI and paid billing are intentionally not configured. EAS test APK build `77c4fe50-c92a-43d9-9812-0e40f8a35e4e` finished successfully on its separate `test-preview` channel. The actual APK's API hostname/channel and ZIP integrity were verified, then it installed and launched on the authorized Android phone; the Settings screen rendered without a sampled startup crash. See TEST_APK.md for the download, environment isolation, actual verification and remaining native/provider tests. Production validation was not relaxed and main was not pushed.

2026-10-10 release retry: the existing local author identity is configured. The founder has requested a Git commit and a new test APK. Terminal push still fails when Git Credential Manager starts (`NtCreateDirectoryObject`); the GitHub connector authenticates as the repository owner. Source changes are staged without private environment files or temporary Android exports.

The hosted API health/readiness endpoints return HTTP 200, but its catalog still serves Essential at ₹199 and Professional at ₹299 with the old daily-minute allowances; live voice is disabled. This is not a compatible backend verification for the new monthly-session and account-security features. Its deployment configuration automatically runs migrations, so publishing to main must not silently upgrade existing application data. Approval for an isolated test backend has been requested. A preview APK is for testing, not a store-ready release; real email, AI, billing and physical-device checks remain outstanding.
