# Testing status

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
