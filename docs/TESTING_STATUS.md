# Testing status

Executed locally on Windows with Node 24.14.1:

- npm test: 51 tests passed.
- npm run test:regression: 32 focused regression and core-content tests passed.
- npm run typecheck: passed across all four workspaces after correcting two typing errors.
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

Not executed locally:
- Real PostgreSQL integration test. Docker and psql are absent. CI provisions PostgreSQL, but that remote workflow has not been run.
- Local database test attempted on 2026-10-06: the command now reaches the database assertion and stops because an isolated `DATABASE_URL` is not available; Docker and `psql` are also absent in this environment.
- Native Android/iOS compilation, installation, microphone capture, playback, permission refusal, background interruption and route changes.
- Real AI/provider tests or subscription sandbox tests.
- Security audit clearance. Dependency audit currently reports upstream advisories; see KNOWN_ISSUES.

API tests use an explicitly test-only in-memory Store. They exercise real route/authentication code but do not prove Prisma/PostgreSQL behavior. Database test separately exercises persistence, concurrent timezone protection and cascading cleanup when PostgreSQL is available. Conversation regression coverage verifies scenario authorization, owner-only retrieval, provider success transitions, provider failure settlement and the explicit non-live session response. Voice capability tests verify the web/native/provider readiness boundary.
The in-memory API suite also exercises timezone rollover, reservation capacity and release of unused reserved seconds. PostgreSQL-backed usage concurrency remains pending until a database is available.
