# Testing status

## Account-creation legal consent — 2026-10-24

- `npm run db:generate`: PASS. `npm run typecheck`: PASS in all four workspaces.
- `npm test`: PASS, 201/201. `npm run test:regression`: PASS, 179/179. `git -c core.whitespace=cr-at-eol diff --check`: PASS.
- New API tests verify rejected missing/false/stale acceptance, a persisted server-dated receipt, unchanged returning login,
  and first-time Supabase/direct OAuth rejection without acceptance followed by accepted account creation.
- Expo web export: PASS. In the Codex in-app browser, Sign in has no consent switch; Create account shows the legal link
  and an unchecked switch with account/Google creation disabled; the link opens the C2Coach policy and returns to signup.
- No real account was created during browser testing. Hosted database migration, native screen review, deployed OAuth,
  public policy/contact configuration, and APK verification remain NOT RUN. Existing APKs are unchanged.

## Supabase Google sign-in activation — 2026-10-24

- Supabase dashboard: Google provider enabled; allowed redirects include `communicationcoach://oauth` and
  `http://localhost:8092/oauth`. Google consent remains in External/Testing mode.
- Local web export with OAuth enabled: PASS. In a browser, the approved Google sign-in returned through Supabase PKCE;
  `POST /v1/auth/supabase` and `GET /v1/me` both returned HTTP 200, and the app navigated to onboarding. The API used a
  temporary in-memory test store; no application record was written to the production database. A fake token returned 401.
- Isolated Vercel test API: redeploy `dpl_AP9JAv5fcQu6SgLkJxwqTHsVgfVR` READY after adding the pinned public
  Supabase URL/key and OAuth flag. A fake, sufficiently long token returned HTTP 401 from the verifier. This proves
  activation and invalid-token rejection, not a real-token hosted sign-in. The public production API was not changed.
- Expo preview environment now contains the public Supabase URL/key. `test-preview` enables OAuth; regular `preview`
  does not. The profile-isolation assertion passed. The older installed APK was not rebuilt and cannot gain these
  build-time settings automatically.
- `npm run typecheck`: PASS across API, mobile, portal and core. `npm test`: PASS 200/200. `npm run test:regression`:
  PASS 179/179. `git -c core.whitespace=cr-at-eol diff --check`: PASS. Expo web export with OAuth enabled: PASS.
- Not verified: native Android/iOS callback, existing-account linking with a real account, logout/relogin on a device,
  or a real-token exchange against the isolated hosted test API. No physical device was tested; ADB was not found at
  the default Android SDK path in this run.
  Google consent publication, production email recovery and Supabase Auth user deletion remain public-launch gates.
- Local screenshots: ignored `artifacts/supabase-google-local-onboarding.png` and
  `artifacts/expo-preview-oauth-config.png`. The temporary memory API and web server were stopped after validation.

## Emerald Studio visual checks — 2026-10-24

- `npm run typecheck`: PASS in all workspaces, exit 0.
- `npm test`: PASS, 200/200, zero failed/skipped/cancelled/todo; exit 0; duration_ms 12283.2193.
- `npm run test:regression`: PASS, 179/179, zero failed/skipped/cancelled/todo; exit 0; duration_ms 33731.9348.
- Expo web export: PASS; the 1.2 KB bundled gradient asset was included. No native build was run.
- Added three palette tests: saved-preference fallback, all palette/mode text and action contrast, and control-outline contrast.
- Codex browser on the real exported app: all eight palette/mode combinations selected correctly at 320 px;
  no document overflow. Dark persisted on reload, sign-in reached Home, and Settings opened the appearance screen.
- Screenshots: ignored local `artifacts/emerald-light.png` and `artifacts/emerald-dark.png`.
- Preview uses the existing disposable memory fixture and simulated providers. No APK, store purchase, physical-phone or
  production appearance verification was performed. Logs: ignored local `artifacts/emerald-*.log`.

## Native billing preparation — 2026-10-24 (latest checkpoint)

- npm run typecheck: PASS, all four workspaces, exit 0.
- npm test: PASS 197/197, zero failed/skipped/cancelled/todo, exit 0; duration_ms 16689.7718.
- npm run test:regression: PASS 176/176, exit 0; duration_ms 11410.5597.
- Twenty-one added tests cover provider-selected monthly offers and account binding, pending/verification/finish ordering,
  restore product selection, inactive access, canonical Google orders, HTTP ownership/replay, Android-only configuration,
  disabled Apple routes, native SDK base-offer normalization and a non-simulated sandbox build profile.
  They use fixtures, not live store transactions.
- API bundle and actual mobile web export PASS. First export failed with generated-asset EPERM; scoped write grant and
  rerun succeeded. Whitespace and added-source line checks PASS.
- Guarded strict-TLS migration deployment in coach_verification PASS: 202610241200_coaching_review applied, 23 migrations total.
  Existing PostgreSQL integration suite PASS 16/16, zero skipped/failed, exit 0; duration_ms 195226.4584.
  This closes the previous isolated DB blocker, not production migration, billing-provider QA or public-access re-audit.
- Browser Essential preview/explicit simulation confirmation PASS. New view returns to practice without claiming paid access.
  It retains the labelled Executive memory-fixture grant and is not a store entitlement test.
- Live Google/Apple sandbox testing BLOCKED: Play Console identity/phone tasks still required, Create app disabled;
  no Apple enrollment/iPhone, no physical Android listed and emulator offline. Upgrade/downgrade/proration not completed.
- Release preflight expected BLOCKED, exit 1. No provider activation, real charge, new APK/OTA, hosted deployment or Git push.
  See STORE_BILLING_TEST_PLAN.md for exact evidence, lifecycle matrix and owner prerequisites.

## Browser functional verification — 2026-10-24 (previous checkpoint)

- Real Expo app + real Fastify routes exercised in the in-app browser, with a disposable memory store and clearly labelled
  injected email/assessment fixtures. This is not the previous component-only preview, PostgreSQL durability or live AI quality.
- Browser journey and corrected cases PASS: registration/profile validation, onboarding/package preview, email proof,
  distinct workshops/programme restrictions/examples, primary/independent retry, saved-answer failure recovery, detailed
  feedback and follow-up practice, truthful text/voice progress, themes, pricing/package review, account access and legal pages.
- Four fixes were reproduced/retested: one practice header, capability-aware feedback copy, zero home overflow at 320px,
  and explicit radio/disclosure web state. Feedback also has zero overflow at 320/360px; no System theme option is present.
- `npm run typecheck`: PASS, exit 0 across API/mobile/portal/core.
- `npm test`: PASS 176/176, zero failed/skipped/cancelled/todo, exit 0; duration_ms 14987.1481.
- `npm run test:regression`: PASS 155/155, zero failed/skipped/cancelled/todo, exit 0; duration_ms 9009.617.
- Standalone harness typecheck, API production bundle and real mobile web export: PASS, exit 0.
  The API bundle does not contain the injected functional-provider marker. Whitespace/140-character added-line audit PASS.
- `npm run release:preflight`: EXPECTED BLOCKED, exit 1. The database URL check means configured, not connected.
- ADB runs, but emulator acceleration reports code 6; software launch remains offline and sys.boot_completed is unavailable.
  No emulator APK install/launch or native microphone/voice/billing acceptance pass is claimed; no physical phone/iOS listed.
- Guarded Supabase probe again returns tenant/user not found; no new migration or PostgreSQL integration run completed.
- Two test-provider calls exercise deliberate failure then success; reopening feedback does not increase the count.
  Two test emails are captured locally. No real email, provider request, purchase or microphone recording was performed.
- Evidence and full case matrix: FUNCTIONAL_TEST_REPORT.md; local traces/screenshots under artifacts/functional-* (ignored).
  No APK/OTA, production/hosted test deployment, Git push or public launch. Prior dated counts below are historical.

## Detailed coaching reviews — 2026-10-24 (previous checkpoint)

- `npm run db:generate`: PASS, exit 0; Prisma Client 6.19.2 includes the nullable coaching report field.
- `npm run typecheck`: PASS across API, mobile, portal and core, exit 0 after correcting literal types in a new legacy fixture.
- `npm test`: PASS, 171/171, zero failed/skipped/cancelled/todo, exit 0; duration_ms 10404.4973.
- `npm run test:regression`: PASS, 150/150, zero failed/skipped/cancelled/todo, exit 0; duration_ms 8412.2545.
- Whitespace audit: PASS using `git -c core.whitespace=cr-at-eol diff --check`; no new/changed source line exceeds 140 characters.
- New tests cover score/area constraints, explicit unassessable areas, deterministic overall, strict provider schema,
  exact retry-only report evidence, actual opening position, no invented legacy scores and owner-scoped HTTP delivery.
  Shared store tests cover nested report persistence, atomic completion, caller mutation isolation and account exports.
- Isolated migration attempt: BLOCKED, exit 1; Prisma reports a schema-engine error. Read-only Prisma connection probe
  returns `FATAL: (ENOTFOUND) tenant/user postgres.nrrmhftccqsofjvoaffm not found`. No migration applied by this run.
  Guarded PostgreSQL tests did not run; historical 14/14 results below do not validate the new JSONB field.
- `npm run build:vercel -w @coach/api`: PASS, exit 0. Expo mobile web export: PASS, exit 0, artifacts/coaching-web.
- Browser fixture checks: real feedback component at 320px Light, 360px Dark and 320px enlarged text; zero horizontally
  overflowing elements in all three frames. Expanding a score row exposed the expected rationale and exact quote.
  This is a manually authored fixture with unused native-import stubs, not paid model output or a full app/device test.
- Local evidence: artifacts/coaching-{typecheck,tests,regression,migration,api-build,web-export}.log;
  artifacts/coaching-review-preview.jpg and artifacts/coaching-review-light.jpg. These local files are ignored by Git.
- No paid AI call, production data write/migration, hosted test deployment, APK/OTA change, Git push or store submission.
- See COACHING_REVIEW.md for format, compatibility, score calibration limitations and deployment prerequisites.

## Launch hardening — 2026-10-10 (previous checkpoint)

- `npm run db:generate`: PASS after a scoped node_modules filesystem permission resolved an initial Prisma EPERM.
- Isolated migration deployment: PASS, exit 0; 22 migrations now recorded in coach_verification. Applied the public-only ACL
  no-op and `202610101600_assessment_recovery` there with strict TLS. No production/hosted-APK schema migration occurred.
- `npm run typecheck`: PASS across API, mobile, portal and core; exit 0.
- `npm test`: PASS, 158/158; zero failed/skipped/cancelled/todo; exit 0; duration_ms 9108.774.
- `npm run test:regression`: PASS, 137/137; zero failed/skipped/cancelled/todo; exit 0; duration_ms 7365.6225.
- `npm run test:database`: PASS, 14/14; zero failed/skipped/cancelled/todo; exit 0; duration_ms 200399.1046.
  Includes actual PostgreSQL lease recovery, account-wide quota races, atomic completion, legacy partial commits,
  ownership, attempt uniqueness, persistence and cleanup. All test accounts are deleted by fixture cleanup.
- Public-library regression now rejects drafts before publication and after rollback; a verified-manager catalog preserves
  review access. General/regression counts increased from 138/117 to 158/137; isolated database counts from 9 to 14.
- Whitespace validation: PASS using `git -c core.whitespace=cr-at-eol diff --check` to preserve the existing CRLF mobile file.
  Added/changed TypeScript source-line audit: zero added lines over 140 characters.
- Assessment-only HTTP suite: 16/16 PASS at that checkpoint, including the full learner journey with injected email and AI;
  subsequent required suites additionally include fetch-abort propagation and legacy partial-commit recovery.
- API production/test bundles: PASS, exit 0 for both. Mobile web export: PASS, exit 0, saved to artifacts/launch-web.
  These are build checks, not interactive browser or real-device acceptance.
- `npm run release:preflight`: EXPECTED BLOCKED, exit 1. Account email, assessment, scheduler, voice, billing, OAuth and
  manager configuration remain blocked; device QA and content/release are manual. A configured database URL is not live-product proof.
- Paid-provider checks: NOT RUN; no local OPENAI_API_KEY is configured. US$0 spent of the founder-approved US$3 cap.
- Android: ADB recognizes the authorized Samsung SM-S908E, Android 16, but dumpsys reports an active lock screen.
  No interactive microphone, interruption, transcript/retry, purchase or app journey testing was performed. No iOS device.
- No source commit/push, APK/OTA update, deployment, public launch or store submission was performed.

Evidence (local, ignored): artifacts/launch-hardening-typecheck.log, artifacts/launch-hardening-tests.log,
artifacts/launch-hardening-regression.log, artifacts/launch-hardening-migration.log,
artifacts/launch-hardening-database-final.log, artifacts/launch-hardening-api-build.log,
artifacts/launch-hardening-production-build.log, artifacts/launch-hardening-web-export.log,
artifacts/launch-hardening-preflight.log. Do not claim these local logs were published in a source archive.

See PUBLIC_LAUNCH_READINESS.md for the before/after RCA, timeout/billing limits and remaining release gates.
Older dated results below are historical snapshots, not substitutes for live-provider/device acceptance.

## Approved public-access lockdown verification — 2026-10-10

- Live containment committed at 09:40:08 UTC: all 13 public tables have RLS, no effective API-role table/column privileges.
  Public-key zero-row User request now returns HTTP 401/42501, formerly HTTP 200; no customer rows were fetched.
- Rollback rehearsal: PASS, idempotent SQL, owner zero-row read/write and denied default grants on a new probe table.
  Probe/rehearsal rolled back. Commit applied only the approved security SQL, not pending feature migrations.
- `$env:DATABASE_ACCESS_AUDIT_CONFIRMED='true'; npm run test:database-access`: PASS, 5/5;
  zero failed/skipped/cancelled/todo; exit 0; duration_ms 31754.8909. Verifies all table ACL/RLS flags, 26 actual denied
  role/table zero-row reads, owner read/default grants and public-only migration no-op in both isolated schemas.
- Restricted test-backend hosted smoke: PASS, 31/31 expected HTTP responses; two disposable accounts cleaned up.
  Both production/test health endpoints remain HTTP 200. No full authenticated production QA or paid-provider QA claimed.
- `npm run typecheck`: PASS across all workspaces; exit 0. No Prisma model change/regeneration required for this ACL migration.
- `npm test`: PASS, 138/138; zero failed/skipped/cancelled/todo; exit 0; duration_ms 10556.0484.
- `npm run test:regression`: PASS, 117/117; zero failed/skipped/cancelled/todo; exit 0; duration_ms 12357.9518.
- The five live security checks are deliberately separate from ordinary unit/regression suites and require explicit opt-in.
- Residual: platform-owned supabase_admin defaults remain; alternate-creator objects need review. Existing public functions
  were not changed; no executable SECURITY DEFINER functions were found. Incident review and other source gaps remain open.

Evidence: artifacts/supabase-lockdown-receipt.json, artifacts/supabase-lockdown-tests.log,
artifacts/supabase-lockdown-hosted-smoke.log and artifacts/supabase-lockdown-{typecheck,tests,regression}.log.
See SUPABASE_ACCESS_AUDIT.md for before/after metadata, migration identity/hash, limitations and reproduction steps.

## Live Supabase access audit — 2026-10-10

- Read-only catalog audit confirmed 13 public tables with RLS disabled and effective read/write privileges for both
  anon and authenticated. Both isolated coach schemas deny schema USAGE to these roles.
- Public/anon-key GET /rest/v1/User?select=id&limit=0 returned HTTP 200 and an empty array. No customer rows requested.
- No live writes, ACL changes, incident-log review or post-remediation denial check was performed. Hardening remains pending approval.
- `npm run typecheck`: PASS across all workspaces; exit 0. Prisma client regeneration was not attempted in this audit.
- `npm test`: PASS, 138/138; zero failed/skipped/cancelled/todo; exit 0; duration_ms 10085.2923.
- `npm run test:regression`: PASS, 117/117; zero failed/skipped/cancelled/todo; exit 0; duration_ms 7414.5588.
- No application behavior, tests or migrations changed; these green suites do not certify the exposed database as secure.

Evidence: artifacts/supabase-access-audit.json, artifacts/supabase-rest-audit.json and
artifacts/security-audit-{typecheck,tests,regression}.log. See SUPABASE_ACCESS_AUDIT.md for the confirmed scope and source findings.

## Phase 10 specification checkpoint — 2026-10-10

Documentation only: CODEX_PLAN.md now defines role-aware scenarios, 12 function packs, seven career lenses, offline
draft generation/review, saved role context and voice/assessment acceptance criteria. No Phase 10 runtime behavior exists yet.
No application code, tests, migrations, generated content, provider activation, deployment or APK was changed in this increment.

- `npm run typecheck`: PASS, all workspaces; exit 0.
- `npm test`: PASS, 138/138, zero failed/skipped/cancelled/todo; exit 0; duration_ms 9742.544.
- `npm run test:regression`: PASS, 117/117, zero failed/skipped/cancelled/todo; exit 0; duration_ms 7012.2791.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS; exit 0; line-ending warnings only.
- These are existing application checks, not evidence that the planned role personalization is implemented or reviewed.

Logs: artifacts/phase10-plan-typecheck.log, artifacts/phase10-plan-tests.log and artifacts/phase10-plan-regression.log.

## Isolated APK refresh verification — 2026-10-10

- `npm run typecheck`: PASS across all workspaces; exit 0.
- `npm test`: PASS, 138/138, zero failed/skipped/cancelled/todo; exit 0; duration_ms 14523.4812.
- `npm run test:regression`: PASS, 117/117, zero failed/skipped/cancelled/todo; exit 0; duration_ms 6841.7216.
- Test-schema migration deploy: PASS, 20 finished migrations in coach_apk_test; one existing account preserved.
  Restricted login has zero accessible public tables and no Supabase anon/authenticated schema exposure.
- Local Prisma regeneration failed with EPERM on node_modules/@prisma/client; the existing generated client already has
  Assessment and RateLimitBucket. Local test API bundling passed and the hosted deployment is READY; no false regenerate PASS claimed.
- Hosted API smoke: PASS, 31 expected HTTP responses, both disposable accounts deleted. Includes registration/login,
  catalog/prices, all workshops, owner isolation, primary/advance/retry/completion, measured progress, export and logout.
  Missing AI/email/billing providers fail closed; they were not exercised as working live services.
- EAS initial Git archive upload failed because the sandboxed shallow Git clone returned 128. Retried with the supported
  no-VCS client pinned to this repository; existing gitignore rules exclude environment files/artifacts. Upload succeeded.
- EAS build d66eca5b-8d55-4f71-aeca-79210ef5056d FINISHED successfully; the APK was downloaded (151,089,531 bytes).
  ZIP/CRC, embedded isolated API, absent production API and absent legacy System-theme explanation checks pass.
  Android package/version, SDK 24/36 and test-preview update channel are verified; checksum is recorded in TEST_APK.md.
- Physical Samsung SM-S908E: adb install -r reports Success without clearing app data. Launch and Settings deep link
  return Status: ok. Process 27488 remains running; sampled PID-specific startup log has zero fatal/React Native error matches.
  The phone is locked; screenshots show its lock/charging screen, not the app. Theme switching and full native QA are NOT passed.
- The test-preview update channel has no OTA update groups. No OTA publication or production deployment/migration occurred.

Logs: artifacts/test-apk-typecheck.log, test-apk-tests.log, test-apk-regression.log, test-apk-refresh-migrations.log,
theme-apk-hosted-smoke.log, hosted-test-report.json, eas-theme-build-start.log, eas-theme-build-current.json,
theme-apk-receipt.json, theme-apk-integrity.json, theme-apk-badging.txt, theme-apk-manifest.txt,
theme-apk-install.log, theme-apk-launch.log and theme-apk-startup.log.

## Light/Dark-only appearance — 2026-10-10

- Targeted `scripts/theme-preferences.test.ts`: PASS, 3/3; choices, saved selections and legacy/default migration.
- `npm run typecheck`: PASS across all workspaces, exit 0.
- `npm test`: PASS, 138/138, zero failed/skipped/cancelled/todo; exit 0; duration_ms 8208.7373.
- `npm run test:regression`: PASS, 117/117, zero failed/skipped/cancelled/todo; exit 0; duration_ms 6480.7015.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS, exit 0.
- Settings uses the shared two-option list; theme rendering no longer subscribes to the device colour scheme.
  Legacy System values are replaced with Light in preference storage. Existing Light/Dark selections remain intact.
- React review: hooks remain unconditional, existing accessible radio choices are preserved and options are module-level.
- No physical-device/browser interaction, APK rebuild, OTA publication, database writes or production deployment performed.

Logs: artifacts/theme-typecheck.log, artifacts/theme-tests.log and artifacts/theme-regression.log.

## Source-push release gates — 2026-10-10

The founder requested Git and production publication, then explicitly chose to keep production gated because email
delivery and every-minute scheduling are not ready. No production migration, deployment or subscription change is approved.
Automatic Vercel Git deployments for main are disabled in the API config, and EAS OTA updates are manual-dispatch only.
Two additional regression tests enforce those gates while preserving the required cron cadence.

- `npm run typecheck`: PASS, exit 0, all workspaces.
- `npm test`: PASS, 135 tests, 135 passed, zero failed/skipped/cancelled/todo, exit 0; duration_ms 8773.7235.
- `npm run test:regression`: PASS, 114 tests, 114 passed, zero failed/skipped/cancelled/todo, exit 0; duration_ms 6580.5931.
- `git -c core.whitespace=cr-at-eol diff --check`: PASS, exit 0. Plain diff --check reports CRLF as trailing whitespace;
  the configured CR-at-EOL check distinguishes line endings from actual whitespace defects.
- Secret-pattern review flagged only two literal database fixture URLs; both passwords are the word fixture,
  not the configured database secrets. Local .env files, generated bundles and artifacts remain ignored.
- `git fetch` of the requested GitHub repository succeeded; remote main 04462c9 is an ancestor of this checkout.
- Previous 9/9 isolated PostgreSQL tests, API bundle and web-export results below remain valid historical evidence.
  This increment changes release configuration/tests/docs only; no database writes or native testing were performed.

Logs: artifacts/release-typecheck.log, release-tests.log, release-regression.log and release-diff-check.log.
See PRODUCTION_RELEASE.md for the production prerequisites and the explicit APK/OTA freeze.

## Final remaining-phase verification — 2026-10-10

Phases 6–9 are implemented locally. Checkpoints below this section are historical, not later failures or release approval.

| Executed command/check | Actual result |
| --- | --- |
| `npm run typecheck` | PASS across all workspaces; exit 0 |
| `npm test` | PASS: 133 tests, 133 passed, 0 failed/cancelled/skipped/todo; exit 0 |
| `npm run test:regression` | PASS: 112 tests, 112 passed, 0 failed/cancelled/skipped/todo; exit 0 |
| Guarded migration deploy and `npm run test:database` | PASS: 9/9 PostgreSQL tests, zero skips; exit 0; coach_verification only |
| Migration/fixture inspection | PASS: 20 finished migrations; zero residual disposable fixture accounts |
| `npm run build:vercel -w @coach/api` | PASS: production API function bundled locally; exit 0; not deployed |
| `npm run build:test-vercel -w @coach/api` | PASS: test API function bundled locally; exit 0; not deployed |
| `npm exec -w @coach/mobile -- expo export --platform web --output-dir .expo/remaining-web` | PASS: web bundle/assets exported; exit 0; not interactive browser or phone QA |
| `npm run content:hash` after rebuilding core | PASS: 146 scenarios; current hash recorded in CONTENT_RELEASE_REVIEW.md |
| Read-only cost-report CLI through guarded verification URL | PASS: zero fixture sessions/attempts; both cost averages null, not invented zero-dollar costs; exit 0 |
| `git -c core.whitespace=cr-at-eol diff --check` | PASS; exit 0; LF/CRLF normalization warnings only |
| `npm run release:preflight` | BLOCKED as expected; exit 1; not a successful release check |

Required test command output, retained verbatim in the ignored logs:

```text
npm test
ℹ tests 133
ℹ suites 0
ℹ pass 133
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8128.6701

npm run test:regression
ℹ tests 112
ℹ suites 0
ℹ pass 112
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7557.3258
```

Typecheck ran `tsc -p tsconfig.json` in API, mobile, portal and core and returned exit 0 without diagnostics.
The final PostgreSQL run returned 9 passed, 0 failed/skipped and duration_ms 115459.5314.
Hosted tests used strict TLS and the explicit DATABASE_TEST_URL; public and coach_apk_test were not migrated or tested.
The Phase 6 assessment migration plus Phase 7 current-phase and Phase 9 shared-rate-limit migrations are retained under
apps/api/prisma/migrations/202610101200_assessment_feedback, 202610101300_conversation_phase and 202610101400_shared_rate_limit.

New coverage includes exact learner evidence and strict provider schema, two-attempt validation/deadlines, atomic
completion/advance, ignored client phases, mocked primary-plus-retry voice calls, native initial-response protocol,
12-function management coverage, unpublished HR drafts, authenticated cron, shared persistent rate counters, measured
voice minutes/unknown durations and the one-SQL-query learning-record path. Tests exercise both Store implementations.

Intermediate failures were repaired, not hidden:
- A shared-store failure initially became HTTP 500 instead of the required 503. The limiter now uses ApiError(503);
  the fail-closed cross-instance test passes.
- A repeated PostgreSQL run initially passed 7/9: fixed-time fixtures reused persistent rate counters and received 429.
  Each test now uses an isolated namespace shared by its own API instances, and removes only its tracked fixture buckets.
  The final run passes 9/9 without weakening production rate limiting.
- The first cost-report execution failed because root tsx emitted CommonJS while the CLI used top-level await.
  An awaited async main with cleanup fixes the actual CLI; the read-only verification run now passes.
- Final review moved legacy scenario validation before the completion claim. A missing snapshot/catalog scenario now
  returns 404 without closing practice or calling the provider; the additional regression preserves both saved responses.

Logs: artifacts/final-phases-typecheck.log, final-phases-tests.log, final-phases-regression.log,
final-api-build.log, final-test-api-build.log, remaining-web-export.log, oauth-continuation-migration.log,
oauth-continuation-database.log, final-schema-cost-report.log, final-diff-check.log and final-phases-preflight.log.
These logs are local ignored artifacts, not uploaded secrets or public CI evidence.

Release preflight reports BLOCKED for AI assessment, the serverless scheduler, voice provider, store billing, OAuth and
manager authentication; PostgreSQL configuration passes, while native QA and content approval require manual evidence.
No paid AI call, deployment, Git commit/push, native build, APK/OTA update, store submission or live email/login test ran.
See REMAINING_PHASES.md for the before/after implementation summary and outstanding founder/release decisions.

## Phase 8 checkpoint — 2026-10-10

- `npm run typecheck`: PASS; `npm test`: PASS 121/121; `npm run test:regression`: PASS 100/100; all exit 0.
- `npm run content:hash`: PASS; 146 scenarios; SHA-256 recorded in CONTENT_RELEASE_REVIEW.md.
- Logs: ignored `artifacts/phase8-*.log`. New tests cover 12-function management coverage, stable semantic goals,
  scenario-specific questions, 20 concrete/distinct drafts and exclusion of those drafts from recommendations.
- This verifies structure and publication boundaries, not human editorial approval.

## Phase 7 checkpoint — 2026-10-10

- `npm run typecheck`: PASS, exit 0; `npm test`: PASS 119/119; `npm run test:regression`: PASS 98/98.
- Logs: ignored `artifacts/phase7-*.log`. Primary/retry client hints are ignored; advance requires primary user evidence,
  ownership and no active voice call; concurrent advances permit one winner; closed conversations reject late turns.
- Prisma client regenerated; Phase 7 migration not yet applied remotely. Native two-call playback remains unverified.

## Phase 6 checkpoint — 2026-10-10

- `npm run typecheck`: PASS, exit 0.
- `npm test`: PASS, 118/118, zero failures/skips, exit 0.
- `npm run test:regression`: PASS, 97/97, zero failures/skips, exit 0.
- Logs: ignored `artifacts/phase6-*.log`. These results precede the subsequent Phase 7–9 changes.
- Fake-provider tests cover grounded quotes, invalid-output retry, ownership, concurrency, deadline and disabled fallback.
  Real provider quality, monetary voice billing and native feedback-screen QA are not verified.

## OAuth activation hardening — 2026-10-10

| Executed command | Actual result |
| --- | --- |
| `npm run typecheck` | PASS across all workspaces; exit 0 |
| `npm test` | PASS: 111/111, zero failures/skips; exit 0 |
| `npm run test:regression` | PASS: 90/90, zero failures/skips; exit 0 |
| `npm run build:test-vercel -w @coach/api` | PASS: local test function bundles; exit 0, not deployed |
| `git -c core.whitespace=cr-at-eol diff --check` | PASS; LF/CRLF normalization warnings only |

Actual outputs are saved in ignored `artifacts/oauth-activation-*.log` files.

The runtime schema now rejects malformed boolean flags rather than treating every nonempty string as true. Four new
tests exercise all four flags, their disabled defaults, exact true/false values, invalid inputs, preservation of provider
settings and existing production security gates. Two new isolated-backend tests cover disabled-by-default OAuth,
explicit activation, the approved Supabase URL and refusal of admin/secret keys and malformed flags.
The isolated test-handler wiring is prepared in source only; no remote configuration or deployment was performed.
Targeted runtime/test-backend checks passed 7/7, including the existing project/schema/TLS guard test.
PostgreSQL behavior was not changed in this continuation; the previous completed 8/8 isolated database result remains
historical evidence, not a new database run. Real Google login, browser callback and phone testing remain unverified.

## Latest OAuth verification — 2026-10-10

This checkpoint predates the activation-hardening continuation above; its results remain historical evidence.

| Check | Actual result |
| --- | --- |
| `npm test` | PASS: 105 tests, zero failures/skips |
| `npm run test:regression` | PASS: 83 tests, zero failures/skips |
| `npm run typecheck -w @coach/mobile` | PASS |
| `npm run typecheck` | PASS after completing the four missing Store methods and regenerating Prisma client |
| Expo web export to `.expo/supabase-oauth-web` | PASS |
| Initial Android JavaScript export | FAIL: Hermes cannot write `index.hbc` in sandbox TEMP |
| Android JavaScript export retry | PASS: workspace-local TEMP/TMP; Hermes bundle and metadata exported |
| `git -c core.whitespace=cr-at-eol diff --check` | PASS; LF/CRLF normalization warnings only |
| Live Supabase `/auth/v1/settings` | HTTP 200; Google enabled |
| Live Supabase Google authorization redirect | HTTP 302 to accounts.google.com; matching client ID, email/profile scopes and Supabase callback |
| Real account login / callback / API session on phone | NOT RUN |
| Prisma migration deploy | PASS: existing assessment migration applied only in coach_verification; now 18 migrations |
| `npm run test:database` | PASS: 8/8 PostgreSQL tests, zero failures/skips; isolated coach_verification only |
| `npm run build:test-vercel -w @coach/api` | PASS: test API bundle built locally; not deployed |
| Disposable assessment fixture cleanup | PASS: zero residual fixtures after the final run |
| Latest interactive OAuth browser attempt | BLOCKED: Codex browser URL policy refused access to the existing localhost error tab; no workaround attempted |

The earlier full typecheck failure derived from `claimConversationCompletion`, `assessment`, `saveAssessment` and
`recordAssessmentUsage` declared by existing Phase 6 work but not implemented in MemoryStore/PrismaStore.
The continuation implements those methods rather than removing the contract. Seven new memory-store tests cover ownership,
ten-way concurrent claims/writes, eligible states, duplicate keys, isolated copies, usage validation and cascading cleanup.
Six shared contract cases also run against real PostgreSQL in the isolated verification schema; see results below.

Final continuation commands returned exit code zero: `npm run typecheck`, `npm test`,
`npm run test:regression` and `npm run test:database` (database duration 122.4 seconds).
Earlier database runs exposed a double-delete in fixture cleanup and concurrent one-to-one relation conflicts.
Cleanup now checks whether its owned account still exists. Prisma writes use atomic nested owner-scoped connection;
duplicate assessment relation errors (P2014) and unique-key errors (P2002) both become the expected ConflictError.
One earlier existing email-rate-limit test received four rather than five expected HTTP 429 responses under remote load;
the precise underlying failure was not captured. Integration clients now have test-only 30-second transaction budgets;
assertions and production transaction defaults remain unchanged. The final complete run passed all eight cases.
This is not a production latency/load-test result.

A temporary, ignored memory-only API was started for browser-only OAuth verification with AI calls, billing and email
delivery disabled. The installed APK, hosted backend and saved activation flags were not changed. The browser tool refused
access to the existing localhost error tab under its URL security policy, so no rendered login screen, Google consent,
callback exchange or real app session was verified in this attempt. Automated/mock and HTTP redirect checks must not
be presented as an end-to-end Google login. No paid AI request was made in this continuation.
The temporary processes reported listening, but an independent connectivity probe received ECONNREFUSED on API port 4001
and ETIMEDOUT on preview port 8092. Both temporary sessions were stopped. There is no verified runnable browser preview
from this attempt; React Native DevTools also reported a sandbox cache-access failure and selected its fallback.

Initial `npm run db:generate` failed with Windows sandbox EPERM on native realpath; direct generation passed with a
process-local, ignored compatibility preload using Node's non-native realpath implementation. No filesystem ACL, TLS or
OS security setting was changed. Later full typecheck passed with the regenerated client and without that preload.

Added 12 API tests and eight mobile-flow tests: pinned trusted Supabase verification, invalid/expired/provider failures,
verified Google identity requirements, safe existing-account password proof, preserved account/profile/password access,
stable Google subject linking, strict bodies, throttling, exact callback validation, cancellation, cleanup, S256 enforcement,
native crypto delegation and an actual installed Supabase SDK PKCE verifier/challenge exchange against a mock token endpoint.
Mocks are not evidence of a completed Google login. Logs are ignored under `artifacts/supabase-oauth-*.log` and
`artifacts/oauth-continuation-*.log`.

Export commands: `npm exec -w @coach/mobile -- expo export --platform web --output-dir .expo/supabase-oauth-web`
and `npm exec -w @coach/mobile -- expo export --platform android --output-dir .expo/supabase-oauth-android`.
The Android retry set process-local TEMP and TMP to the existing workspace `artifacts/oauth-temp` directory;
no operating-system permission or security setting was changed. These exports used disabled activation flags and
are bundle validation, not an APK build or active Google login. Provider UI proof is saved locally at
`artifacts/supabase-google-enabled.jpg`; no credentials are visible.

Executed locally on Windows with Node 24.14.1:

- Latest Phase 5 verification (2026-10-10): npm test passed 77/77; npm run test:regression passed 56/56.
- npm run test:database passed 2/2 against the isolated coach_verification schema; public application data was not used.
- npm run typecheck passed across API, mobile, portal and core.
- npm run db:generate and isolated Prisma migrate deploy passed; all 17 migrations are applied in coach_verification.
- npm exec -w @coach/mobile -- expo export --platform web --output-dir .expo/phase5-web-export passed (958 modules).
- git -c core.whitespace=cr-at-eol diff --check passed; Git emitted only LF/CRLF normalization warnings.

## Phase 5 verification detail

- Added 17 account-security tests covering unverified-email Google collision, verified linking, new Google verification,
  wrong-password/owner verification refusal, exact expiry, replay, cross-purpose misuse, three-per-hour account throttling,
  non-enumerating reset responses including delivery failure, password changes/session revocation and stale-login refusal.
- Microsoft tests verify real locally signed JWTs through jose local JWKS: wrong audience, wrong signature, wrong issuer,
  malformed object ID and expired tokens fail; tenant/object subjects remain stable when email changes. Email claims,
  including a tenant-supplied email_verified claim, cannot authorize linking. Unverified-account recovery removes provider links.
- Email/secret tests cover production console refusal, missing production sender/link configuration, sanitized Resend failures
  and malformed/empty/different-length shared secrets. Existing billing webhook and manager regression tests remain passing.
- PostgreSQL security integration uses two API instances sharing the isolated database. Eight racing verification requests
  admit exactly three; racing confirmations consume a token once; a reset revokes both sessions and all outstanding links,
  removes unsafe unverified-account provider identities and refuses stale-password session creation. Cascade cleanup passes.
- Initial typecheck found a test helper accepting unknown rather than Fastify's payload contract. Changed it to a typed record;
  subsequent full typechecks pass. No failing test or configuration result was reported as successful.
- Mobile recovery routes, confirmation fields, banner integration and Microsoft authorization-code/PKCE exchange compile.
  React component review checked unconditional hooks, accessible labels, busy-state actions and error/success rendering.
- Interactive browser verification was attempted with Metro and a compiled static preview. Codex browser navigation returned
  connection refused/timeouts on localhost/127.0.0.1; no screen interaction or screenshot was verified. Metro also reported a
  React Native DevTools download/cache access warning and used a fallback. Temporary preview servers were stopped.
- Real email sending, native OAuth redirects, HTTPS app-link routing and Android/iOS recovery flows were not executed.
- No production/public-schema migration, deployment, final APK rebuild, Git commit/push or Phase 6 work occurred.
- Post-test database inspection found zero users, email tokens, auth sessions, scenarios, voice sessions, monthly usage records
  and usage reservations remaining in the isolated verification schema.

## Earlier verification history
- Phase 1 verification (2026-10-09): the reported malformed escaped-newline regression test was already valid in this checkout. A source scan found only intentional newline escapes (including error formatting and PEM normalization).
- Phase 2 verification (2026-10-09): `npm run typecheck` passed; `npm test` passed (54/54); `npm run test:regression` passed (35/35); `git -c core.whitespace=cr-at-eol diff --check` passed. These checks were run after route extraction and dependency composition changes.
- Phase 2 structural check: `apps/api/src/app.ts` is 59 lines; nine route modules expose registration functions; shared learner-evidence computation is used by progress reporting and per-scenario progress.
- Phase 3 verification (2026-10-09): `npm run typecheck` passed; `npm test` passed (56/56); `npm run test:regression` passed (35/35); `git -c core.whitespace=cr-at-eol diff --check` passed. Added coverage verifies a zero client duration hint cannot reduce a 120-second server charge, expiry charges elapsed time, ten parallel memory reservations remain within allowance, only one concurrent memory voice session is created, and another active session gets HTTP 409.
- Phase 3 PostgreSQL integration: `npm run test:database` was attempted and did not run because `DATABASE_URL` is unset and `apps/api/.env` is absent. The integration test now covers ten parallel reservations and racing active-session inserts, but neither it nor the new migration was exercised against a live PostgreSQL database in this environment.
- Phase 1 generated-artifact cleanup: API bundles and the shared core bundle are ignored and removed from Git tracking. `apps/api/package.json` still regenerates the API bundles through `build:vercel`, and `apps/api/vercel.json` still points to those generated paths.
- Repository TypeScript commands use a small Node 24/Windows compatibility wrapper so `tsx` workers inherit the safe `os.userInfo` behavior.
- npm run db:generate: passed.
- Prisma migration SQL generated from the schema and checked into the initial migration.
- npm run build:portal: passed; home route statically prerendered.
- Browser: portal rendered; Management & Business selection showed four matching scenarios; opening a scenario displayed its question and independent transfer prompt.

- Expo SDK compatibility check: passed after aligning React Native to 0.86.3.
- Expo export: Android, iOS and web JavaScript bundles generated successfully. This is not a native binary build or a device test.
- Expo config resolved `expo-iap` 5.8.2 and the WebRTC config plugin; Android JavaScript export passed after adding the native purchase lifecycle.
- Voice regression coverage verifies browser-origin requests cannot receive a live provider client secret; native readiness is reported only when the provider, WebRTC module and development-build checks are present.
- Voice regression coverage also verifies a bound session can persist an authenticated provider transcript into its conversation.
- Production configuration tests cover memory-store, local-origin, manager, voice-secret and billing-secret fail-closed checks.
- OAuth regression coverage rejects Google tokens issued for an unrecognized application audience.
- Manager scenario regression coverage rejects blank or over-sized draft content before it enters the library.
- `npm run release:preflight` executes and correctly blocks on missing local PostgreSQL, provider/store/OAuth credentials, native device sign-off and human content-release approval.
- Store verifier adapters compile and are wired into the production API path; no live sandbox purchase was attempted because Apple/Google credentials are not present locally.
- Apple lifecycle regression coverage verifies signed-notification results update the matching entitlement, preserve its purchase token, and ignore stale events.
- Google Pub/Sub regression coverage verifies the shared push boundary and provider re-verification before entitlement updates.
- Production configuration now requires a concrete Google Pub/Sub OIDC audience when billing is enabled.
- Release preflight now rejects placeholder OAuth/database/manager values and validates billing product mappings, Apple root-certificate paths and Google verifier credentials before reporting a billing gate as ready.
- Portal responsive check: 390px viewport rendered stacked cards after reload. No console errors were captured during the portal interaction check.
- Mobile web welcome screen rendered in Browser. An empty-string conditional caused a React Native Web text-node warning; explicit boolean conditions fixed it. Reload showed the corrected form with no new occurrence of that warning.
- Native accessibility implementation now respects the system reduced-motion setting and the saved profile/Settings preference for navigation transitions, microphone press feedback and voice-wave animation; device-level verification is still pending.
- Native QA evidence validation now requires one Android and one iOS record with passing microphone, playback, interruption, screen-reader, text-scaling, reduced-motion and keyboard checks; no real device evidence has been supplied locally.
- Content release validation now requires human approval evidence bound to the current scenario catalog hash; no human sign-off has been supplied locally.

- Phase 4 verification (2026-10-09): `npm run typecheck` passed across API, mobile, portal and core; `npm test` passed (60/60); `npm run test:regression` passed (39/39). New coverage checks confirmed package prices/session caps, Essential module restrictions, Asia/Kolkata month rollover, exact two-session free-tier exhaustion, server-returned Realtime model and atomic in-memory monthly session reservations.
- Phase 4 PostgreSQL integration test was updated to verify concurrent monthly reservations and session charge accounting. `npm run test:database` was attempted and stopped at its explicit precondition because `DATABASE_URL` is unset and `apps/api/.env` is absent; no database connection or migration application occurred.

- Supabase connection diagnosis (2026-10-10): the supplied Session pooler URL resolves and its PostgreSQL port accepts connections. TLS initially failed with `SELF_SIGNED_CERT_IN_CHAIN`. Downloaded the official Supabase CA certificate and configured the ignored local `apps/api/.env` with required TLS, strict certificate acceptance and that CA. Prisma then reached authentication and reported invalid database credentials. Password verification, migrations and PostgreSQL integration remain blocked; no migrations or test records were created during this diagnosis. The tracked `.env.example` was restored to its safe template.

- PostgreSQL integration retry (2026-10-10): `npm run test:database` executed with the local Supabase URL and exited 1 (0 passed, 1 failed). Registration returned HTTP 500 instead of 201 while database authentication was failing, so persistence/concurrency assertions were not reached. This is a failed verification, not a passing database test. No migration command was run.

- Supabase verification completed (2026-10-10): updated credentials authenticate with required TLS, strict certificate acceptance and the official CA. `npm run db:migrate` exited 0 with all 16 migrations applied in the isolated `coach_verification` schema, including the active-session unique index and monthly voice usage table. Existing public application tables were not migrated or used for test records; verification schema access was revoked from PUBLIC, anon and authenticated roles.
- Actual database test failures found during verification: the initial connected run rejected every daily reservation because Prisma input included an unknown `seconds` field. The store now explicitly maps that field to `reservedSeconds`. The next run reached manager tests but failed with HTTP 401 because the test assumed a hard-coded development key despite local manager configuration; the test now uses the authenticated test account with a persisted manager role and a fixed clock. An added repeated-stop test was corrected to expect the existing ConflictError contract while confirming seconds are not charged twice.
- Final PostgreSQL integration: `npm run test:database` passed (1/1) against the isolated schema. It exercises ten concurrent daily reservations, racing active-session inserts, concurrent monthly session reservations, lifetime free limits spanning months, failed-slot release without negative counters, single-charge stop protection, profile/timezone persistence, manager revisions/rollback and cascading account cleanup. The ignored local `DATABASE_TEST_URL` makes repeat runs select this schema rather than public application tables.
- Final source checks (2026-10-10): `npm run typecheck` passed; `npm test` passed (60/60); `npm run test:regression` passed (39/39); `git -c core.whitespace=cr-at-eol diff --check` passed. The saved local test configuration also passed a second direct `npm run test:database` (1/1). A post-run query confirmed all 16 migrations completed, zero remaining test users/scenarios/voice sessions/monthly usage/reservations, and no schema USAGE for anon/authenticated roles. No final APK build, Phase 5 implementation, Git commit or push was performed.

## Isolated APK retry after founder approval (2026-10-10)

- Created the separate Vercel `communication-coach-test-api` project and `coach_apk_test` PostgreSQL schema; applied 17 migrations only there. Runtime uses a new restricted login, not the administrator password. Permission checks found zero public application tables accessible to that role and no anon/authenticated schema access.
- `/health`, `/ready` and `/v1/catalog` on the new backend return 200 with the founder's current prices/session allocations. The first cloud deployment failed function discovery because generated API bundles were absent from the upload; adding the generated test bundles fixed it without tracking generated output in Git. The test deployment build does not run migrations.
- 30 hosted HTTP checks passed, covering sign-up/login, incorrect-password rejection, profile persistence, monthly usage, recommendations for all three workshops, private conversation ownership, save/retry/completion, progress, history, export, logout, account cleanup and explicit 503 responses for unconfigured email/billing. An initial smoke script omitted the required learner role and correctly received 400; correcting the script made the flow pass, without changing the API contract. Test accounts were deleted.
- Source checks: typecheck passed, automated tests passed 78/78 (including the project/schema/role/TLS guard), regression suite passed 56/56, PostgreSQL integration passed 2/2 against the separate `coach_verification` schema. No paid provider or store calls were made.
- EAS build `77c4fe50-c92a-43d9-9812-0e40f8a35e4e` FINISHED successfully for Android using `test-preview`, the new HTTPS API and a bundled application (no Metro/Expo Go requirement). Downloaded APK ZIP/CRC integrity, actual embedded API hostname, Android package/version and update channel were verified. `adb install -r` returned Success; launch returned Status ok / COLD and the target activity was top-resumed. The Settings screen rendered and a screenshot was saved locally. The sampled app startup log had no fatal/React Native startup errors. User-driven registration/profile/home requests appeared on the isolated backend; that account was preserved. Native microphone/voice/theme/interruption/accessibility QA and real providers remain unverified. See TEST_APK.md for the artifact URL and checksum.

Not executed locally:
- 2026-10-10 APK retry: Expo CLI authenticates as `luckysoma`. The installed ADB executable runs, but `adb devices -l` shows no connected phone. Hosted API `/health`, `/ready` and `/v1/catalog` respond with HTTP 200; the catalog is still the old pricing/daily-minute contract and advertises live voice unavailable. These checks do not establish compatibility with the new app or a passing device test. GitHub connector authentication works; terminal push fails at Credential Manager startup. Source was committed locally as `722a66d`, with export/artifact exclusions in `9491c59`; main remains `04462c9`. Typecheck passed again, `npm test` passed 77/77 and the regression suite passed 56/56. APK preparation was stopped before a cloud build ID was returned because the new home screen requires the new voice-usage endpoint and a compatible backend. No APK was delivered, no OTA update published and no production migration/deployment performed. A separate test-backend approval is pending.
- Production/public-schema migration and existing-data upgrade validation. The successful database run was deliberately isolated and is not a production release approval.
- Native Android/iOS compilation, installation, microphone capture, playback, permission refusal, background interruption and route changes.
- Real AI/provider tests or subscription sandbox tests.
- Security audit clearance. Dependency audit currently reports upstream advisories; see KNOWN_ISSUES.

API tests use an explicitly test-only in-memory Store. They exercise real route/authentication code but do not prove Prisma/PostgreSQL behavior. Database test separately exercises persistence, concurrent timezone protection and cascading cleanup when PostgreSQL is available. Conversation regression coverage verifies scenario authorization, owner-only retrieval, provider success transitions, provider failure settlement and the explicit non-live session response. Voice capability tests verify the web/native/provider readiness boundary.
The in-memory API suite also exercises timezone rollover, reservation capacity and release of unused reserved seconds. PostgreSQL-backed usage concurrency passed against the isolated Supabase schema on 2026-10-10.
