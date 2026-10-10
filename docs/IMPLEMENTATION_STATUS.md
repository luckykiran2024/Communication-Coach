# Implementation status — first development increment

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
- 126-scenario catalog across three modules and five levels, with mastery-gated recommendations and manager-authored scenario persistence.
- Manager-authored scenarios retain owner/reviewer metadata, enter the library as drafts, and require explicit publication before learner recommendations can use them. Production Manager Studio hides the development key and requires an approved manager session; production startup rejects malformed manager email allowlists and non-HTTPS origins.
- New conversations persist their scenario snapshot, protecting active/history records from later manager content changes.
- Manager Studio now exposes revision history and draft-only rollback; rollback never republishes content automatically.
- Production Google OAuth audience allowlisting is enforced server-side through `GOOGLE_OAUTH_CLIENT_IDS`; unrecognized Google application audiences are rejected before account linking.

## Not implemented

Realtime AI, provider-backed communication assessment, diagnostic profiles, history-driven skill profiles, live email delivery/native recovery verification, production store credentials/sandbox verification, worker queues, provider costs, organizations/tenant administration and release assets.

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
