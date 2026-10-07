# Implementation status — first development increment

## Implemented

- TypeScript npm monorepo with Expo Router mobile app, Fastify API, Next.js portal and shared core package.
- Sign-up/login/logout endpoints; scrypt passwords, seven-day opaque sessions and native SecureStore integration.
- Private profile storage through a Prisma PostgreSQL repository. Profile owner is derived only from the authenticated session.
- Three-step onboarding and edit form: role/function/career level, audience, goal/challenges, language, practice length, timezone and reduced-motion preference.
- Six versioned, role-specific scenario previews spanning three modules; goal/function recommendation logic.
- Four server-configured plan previews at target prices 199/299/699/799 INR and 20/20/20/40 daily minutes.
- Native audio-check code for explicit consent, microphone permission, recording, playback, deletion and app-background interruption.
- Session state-machine contract and evidence-quote validation, with automated tests.
- Responsive portal scenario explorer; no private employee data.
- PostgreSQL migration, Docker Compose, EAS profiles, CI and setup documentation.
- Server-side usage reservation foundation: profile-timezone day keys, atomic capacity checks, settlement of unused seconds, usage endpoint and mobile allowance display.
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

Realtime AI, provider-backed communication assessment, diagnostic profiles, history-driven skill profiles, account verification/recovery, production store credentials/sandbox verification, worker queues, provider costs, organizations/tenant administration and release assets.

The live voice endpoint remains feature-flagged and returns 503 until provider configuration and native transport prerequisites are present. Paid entitlement allowances are enforced server-side when billing is enabled; development mode uses the configured development allowance.

The mobile app now includes local theme selection, device-local display-picture links, social follow shortcuts, plan/progress settings, practice-activity engagement levels, and mastery-gated scenario levels. Mastery requires minimum practice days, completed scenarios, successful independent retries and evidence checks; it is not a validated communication skill score.

## Verification and blockers

See TESTING_STATUS for executed checks. No PostgreSQL service or Docker is available locally. No Android/iOS devices or native build toolchains were verified. No provider credentials were configured and no paid usage was authorized. Store accounts and product IDs are not configured.

TypeScript checks, 51 automated tests, portal production build and Android/iOS JavaScript exports passed. Expo dependency compatibility passed. Portal module filtering, scenario expansion and the live 126-scenario count were checked in the browser.

The regression suite now runs independently through `npm run test:regression` with 32 focused regression and core-content tests and is also included in the general `npm test` glob.

## Next task

Run the real PostgreSQL-backed mobile onboarding flow and resolve failures. Then implement the native AI voice POC with server-controlled session expiry.

## Git checkpoint

Git repository initialized and source files staged. The first commit was blocked because this environment has no Git author name/email configured. No identity was invented and no global Git configuration was changed.
