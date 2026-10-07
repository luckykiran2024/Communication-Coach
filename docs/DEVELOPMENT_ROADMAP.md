# Development roadmap

## Session 1: foundation (this increment)

Objective: establish mobile/API/portal workspaces and an authenticated profile-to-scenario flow.
Acceptance: isolated profile API, versioned scenario content, local native audio check, buildable portal/mobile bundles, repeatable test commands.
Result: implementation and automated tests exist; PostgreSQL execution and real native audio behavior remain unverified in this environment.

## Session 2: persisted practice sessions and regression coverage

Objective: establish a real, owner-scoped practice record without pretending that live AI is connected.
Acceptance: scenario authorization, persisted `CREATED`/`COMPLETED` states, learner-turn persistence, recent-session retrieval, private access, schema migration, and regression coverage.
Result: implemented and verified with the in-memory API suite; PostgreSQL execution remains pending.

## Next focused session

Bring up an isolated PostgreSQL instance, execute test:database, then verify sign-up → onboarding → profile reload → scenario preview in the mobile development build. Include invalid forms, server loss, expired token and sign-out. Resolve dependency advisories before exposing the API publicly.

## Subsequent milestones

1. Harden authentication: email verification, recovery, deletion, session management and audit trail.
2. Verify native live voice: provider selection, platform versions, Android/iOS microphone/route/interrupt tests; require explicit approval before paid API use.
3. Complete server reservations and provider termination before opening live voice access. Free diagnostic allowance also needs an explicit configuration.
4. Deliver the real voice learning loop: role question, spoken response/follow-up, transcript, independent evaluator, evidence-backed feedback and transfer retry.
5. Add repeated-observation skill profiles and history-driven practice, then progress/achievements tied to real activity.
6. Integrate store billing, server validation, signed/idempotent webhooks, expiration/restoration and cross-device entitlements.
7. Implement tenant isolation, cohort assignments, consent boundaries and minimum-size aggregate enterprise reports.
8. Complete accessibility/security review, human-reviewed coaching evaluations and store release preparation.

No promise of autonomous work between sessions. The working voice-first MVP is not complete.
