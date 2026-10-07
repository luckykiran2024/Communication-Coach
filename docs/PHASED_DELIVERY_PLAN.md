# Phased delivery plan

The development preview already includes the mobile learner flow, 126 scenarios, mastery-gated recommendations, manager-authored scenarios, local audio readiness, progress tracking and regression coverage. The remaining work is sequenced below so each phase has a testable exit condition.

## Phase 1 — Production data foundation

**Scope:** PostgreSQL, Prisma migrations, persistent custom scenarios, profile/conversation persistence, backups and environment secrets.

**Exit criteria:** `test:database` passes against an isolated database; migrations apply cleanly; readiness checks, cleanup and rollback procedures are documented.

**Current status:** Blocked locally because Docker, `psql` and a configured `DATABASE_URL` are unavailable. The Compose file and integration test are ready.

## Phase 2 — Identity and access

**Scope:** Production Google/Microsoft client IDs, verified OAuth tokens, email verification, password recovery, account deletion, session management and manager roles/SSO.

**Exit criteria:** Android and iOS sign-in works with production client configuration; manager APIs reject non-manager users; recovery and deletion flows are tested.

**Progress:** OAuth production-build preflight now requires Google Android, Google iOS and Microsoft client IDs, while the API also requires and enforces its server-side Google audience allowlist. The API verifies provider identities and persists stable Google/Microsoft subjects for account linking; authenticated users can permanently delete their account and cascaded private data; manager publishing accepts an authenticated bearer session for persisted manager roles or emails in `MANAGER_EMAILS`, while the development key is restricted to non-production environments. The API now fails fast in production when memory storage, local CORS, OAuth audiences, manager access or enabled provider secrets are misconfigured.

## Phase 3 — Live voice and assessment

**Scope:** Select the voice provider, native transport, microphone permissions, interruption recovery, server session expiry, transcription, provider-backed assessment and evidence-linked coaching.

**Exit criteria:** A real device can complete a 20-minute session within the configured allowance, terminate safely, persist the transcript and produce reviewable feedback without exposing provider secrets.

**Progress:** The server-only OpenAI Realtime client-secret adapter is wired behind configuration into the reservation/state machine, with the provider key remaining server-side. Input and output transcript events are now persisted against the authenticated conversation, while the app continues to treat input transcription as guidance rather than audio assessment. Persisted voice sessions now have authenticated stop and expiry-recovery paths that settle consumed seconds and interrupt or expire the conversation; the mobile WebRTC call ID is bound back to the server so authenticated stop and the retry sweep can invoke provider hangup. Browser-origin live-session requests are rejected before a client secret is issued. The mobile development build now includes the WebRTC offer/answer transport and live practice control, and the readiness endpoint reports server/provider status separately from the client-reported native module and development-build status. Physical-device QA and provider-backed assessment remain before production release.

## Phase 4 — Store billing and entitlements

**Scope:** Google Play and App Store products, checkout, server receipt validation, idempotent webhooks, renewals, cancellation, refunds, restoration and cross-device entitlement mapping.

**Exit criteria:** Sandbox purchase, restore, expiry and refund scenarios produce the correct server entitlement and allowance without trusting the client.

**Progress:** A server-created purchase-intent ledger now binds store events to an authenticated account, alongside the entitlement ledger, authenticated webhook boundary, idempotent transaction updates, owner-scoped lookup and server-authoritative product-to-plan allowance enforcement. Entitlements retain the provider purchase token and Apple original transaction ID so future renewal/refund notifications can map back to the account. The native app now includes `expo-iap` purchase and restore flows that finish transactions only after server verification. Server-side Apple transaction verification uses Apple’s signed-data library and Google verification queries the Play subscriptions v2 API; verified Apple Server Notifications v2 and Google Pub/Sub subscription notifications now reverify provider state, update matching entitlements, preserve purchase-token ownership, and ignore stale events. Production startup requires both verifier credential sets and a Google Pub/Sub OIDC audience when billing is enabled. Sandbox transaction evidence and production checkout remain before charging users.

## Phase 5 — Native quality and accessibility

**Scope:** Android/iOS development builds, microphone/playback routes, background interruptions, keyboard behavior, screen readers, reduced motion, contrast and performance.

**Exit criteria:** Device test matrix passes on supported OS versions; no critical accessibility or audio interruption defects remain; EAS release builds are reproducible.

**Progress:** Shared mobile screen primitives use keyboard-aware scrolling, labelled controls, minimum touch targets, accessible icons and contrast-aware theme tokens. Reduced motion now follows the OS accessibility setting and can be changed from onboarding or Settings; it disables nonessential navigation, press and voice-wave motion. Native exports pass, and the release gate now validates structured Android/iOS evidence for microphone, playback, interruptions, screen reader, text scaling, reduced motion and keyboard behavior. Physical-device execution and sign-off remain manual.

## Phase 6 — Content and manager governance

**Scope:** Human review of the 126 seed scenarios, manager publishing permissions, draft/review/published states, version history, deprecation and final social/brand assets.

**Exit criteria:** Every published scenario has an owner, rubric, level, review status and rollback path; manager content cannot silently change a learner’s active session.

**Progress:** The catalog now has an automated release gate covering uniqueness, complete prompts, independent-transfer prompts, rubric/focus fields and module/level coverage. A content review manifest must also match the current catalog hash before the release gate can pass. The shared scenario schema rejects blank or over-sized manager content before it enters the draft library. Manager-authored scenarios are retained in the library as drafts with owner/reviewer metadata and must be explicitly published before learner recommendations can use them. New conversations persist a scenario snapshot so later catalog review cannot silently rewrite learner history. Every manager change is now recorded in revision history, and rollback creates a fresh draft requiring review before it can return to learner recommendations.

## Phase 7 — Security and launch readiness

**Scope:** Dependency remediation, threat review, rate-limit tuning, monitoring, privacy/retention policy, support process, store metadata and controlled pilot launch.

**Exit criteria:** Security and privacy sign-off, production observability, incident runbook, approved store listings and a limited pilot with real-device evidence.

## Immediate next action

Provide either a local Docker/PostgreSQL installation or an isolated `DATABASE_URL`. Then run:

```text
npm run db:migrate
npm run test:database
```

After external credentials and device evidence are available, run `npm run release:preflight` to check all seven phase gates together.

Do not enable paid voice or billing until Phases 1–5 have passed their exit criteria.
