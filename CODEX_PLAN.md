# Communication Coach: Codex remediation plan

> Put this file at the repository root. Then tell Codex: **"Read CODEX_PLAN.md and do Phase N."**
> Run **one phase per Codex task** and review the diff before you start the next phase.

---

## 0. Decisions the founder must confirm (edit these before Phase 4)

| Setting | Default for now | Notes |
|---|---|---|
| Realtime voice model | `gpt-realtime-2.1-mini` | Costs about a third of `gpt-realtime-2.1` |
| Maximum length of one voice session | 7 minutes | Sets the cost per session |
| Plans (INR/month → voice sessions/month → modules) | Essential 199 → 12 → daily · Professional 299 → 20 → daily+management · Executive 699 → 40 → all · Extended 799 → 60 → all | Text practice is unlimited on every plan |
| Model for the feedback pass | `gpt-5-mini` (any cheap text model with structured output) | Set by env var `ASSESSMENT_MODEL` |
| Free tier | 2 voice sessions per lifetime + unlimited text | |

Codex must not invent other prices or allowances. Use exactly the values above.

---

## 1. Standing rules (apply to every phase)

You are working on an existing TypeScript npm monorepo:
- `apps/api`: Fastify + Prisma/PostgreSQL
- `apps/mobile`: Expo Router + React Native
- `apps/portal`: Next.js, a reference surface only
- `packages/core`: shared Zod contracts, scenario content and domain logic

1. **Read first:** `README.md`, `docs/ARCHITECTURE.md`, `docs/KNOWN_ISSUES.md`, `apps/api/src/app.ts`, `apps/api/src/store.ts`, `packages/core/src/index.ts`.
2. **Keep the architecture.** Every route goes through the `Store` interface, and you implement each new store method in **both** `prisma-store.ts` and `memory-store.ts`. Schema changes ship as a new folder under `apps/api/prisma/migrations/` (naming pattern `2026MMDDhhmm_description`). Never edit old migrations.
3. **The server is authoritative.** Never trust client-supplied durations, roles, phases, prices, plan IDs or user IDs. Ownership always comes from the authenticated session.
4. **Fail closed.** If a provider or credential is missing, return 503 with a clear message. Never return fake AI output.
5. **No fabricated data.** Never show the learner a metric that wasn't measured.
6. **Readable code.** No line longer than 140 characters. Prefer small named functions over long one-liners. Don't add new dependencies unless a phase says so.
7. **Tests.** Every behaviour change gets a test in `apps/api/test/` or `packages/core/test/`. Before you finish, run all of these and paste the real output in your summary:
   ```
   npm run typecheck
   npm test
   npm run test:regression
   ```
   If a command can't run in your environment, say so. Never claim it passed.
8. **Docs stay honest.** Update `docs/IMPLEMENTATION_STATUS.md`, `docs/TESTING_STATUS.md` and `docs/KNOWN_ISSUES.md` with what actually changed and the **real** test counts.
9. **Scope.** Do only the phase you were asked for. If you notice another problem, list it under "Found, not fixed" in your summary.
10. **Finish with a summary** covering: files changed, migrations added, tests added, command output, and anything that needs a founder decision.

---

## Phase 1: Make the test suite and typecheck green

**Problem:** line 52 of `apps/api/test/regression.test.ts` contains literal `\n` escape sequences instead of real newlines. The file doesn't parse, so its ~24 tests never run and `npm run typecheck` fails. `docs/TESTING_STATUS.md` claims 51 tests pass.

Tasks:
1. Rewrite line 52 as properly formatted multi-line test code, keeping the tests' intent exactly. Search the whole repo for any other file containing literal `\n` sequences inside source code (excluding strings where that's intended) and fix those too.
2. Get `npm run typecheck`, `npm test` and `npm run test:regression` passing. If a revived test now fails, fix the **code** when the test describes correct behaviour; fix the test only when it is clearly wrong, and explain why.
3. Add generated bundles to `.gitignore` and `git rm --cached` them: `apps/api/api/index.js`, `apps/api/api/[...path].js` and `packages/core/dist/`. `build:vercel` already regenerates them at deploy time; confirm that `apps/api/vercel.json` still points at the generated paths.
4. Correct the test counts in the docs.

**Done when:** all three commands pass, and the docs report the real numbers.

---

## Phase 2: Split `app.ts` without changing behaviour

`apps/api/src/app.ts` is one 52 KB function. Split it mechanically:
- `src/routes/`: `health.ts`, `auth.ts`, `profile.ts`, `scenarios.ts`, `manager.ts`, `conversations.ts`, `progress.ts`, `voice.ts`, `billing.ts`
- `src/lib/`: `time.ts` (`dayKey`, `nextReset`), `auth-context.ts` (`authenticate`, `issueSession`, `requireManager`), `errors.ts` (`ApiError`), `progress.ts` (one shared `learnerEvidence()`)

Rules:
- `buildApp()` keeps its exact signature and options. Each route module exports `register(app, deps)`.
- Remove the duplicate primary/retry evidence code in `learnerScenarioProgress` and `/v1/me/progress`, so both use `learnerEvidence()`.
- Change zero routes, status codes or response shapes. The existing test suite is your proof.

**Done when:** every test passes unchanged, and `app.ts` is under 150 lines.

---

## Phase 3: Make voice usage server-authoritative and race-safe

**Problems:**
1. `POST /v1/voice/sessions/:id/stop` trusts the client's `consumedSeconds`, so a client can send 0 and get unlimited AI time.
2. `reserveUsage` in `prisma-store.ts` aggregates and then inserts under READ COMMITTED, so concurrent starts can both pass the allowance check.

Tasks:
1. At stop, the server computes consumed seconds as `clamp(ceil((now - session.startedAt)/1000), 0, reservation.reservedSeconds)`. Keep the `consumedSeconds` body field, but use it only as an optional lower-bound hint for logging; it must never reduce the charge. Apply the same calculation in the expiry sweep (`expireVoiceSessions`), which charges for the time up to `expiresAt`.
2. In `reserveUsage`, take `SELECT pg_advisory_xact_lock(hashtext($userId || ':' || $dayKey))` through `transaction.$executeRaw` at the start of the transaction. Make the memory store equivalent with a per-key promise lock.
3. Each user may have **only one active voice session**. Reject a second start with 409.
4. When a voice session fails to start, the server settles usage itself. The client can't settle a session it doesn't own, and settling an already-ended session is a no-op that returns 409.
5. Tests:
   - stop with `consumedSeconds: 0` after a simulated 120 s still charges 120 s;
   - 10 parallel starts never exceed the allowance (memory store, plus `database.integration.ts`);
   - a second concurrent session is rejected;
   - the expiry sweep charges for the elapsed time.
6. Mobile (`apps/mobile/app/practice/[id].tsx`): keep sending `consumedSeconds`, and show the server's returned value.

---

## Phase 4: Plans enforce modules and session counts (needs Section 0 confirmed)

**Problems:** `plans.json` lists modules per plan, but nothing enforces them, and allowances are 20–40 min/day, which is unaffordable.

Tasks:
1. Change the plan schema in `packages/core` to `{ id, title, targetPriceInr, voiceSessionsPerMonth, maxSessionSeconds, modules }` and update `apps/api/config/plans.json` with the Section 0 values. Add a `free` plan.
2. Track usage **per billing month** (in the profile timezone) as a count of voice sessions, plus the seconds consumed for cost reporting. Add a migration; keep the reservation table for seconds.
3. `recommendScenarios` and `POST /v1/me/conversations` filter scenarios by the modules of the user's active plan. When billing is disabled in development, use the plan named by a new env var `DEV_PLAN_ID` (default `executive`).
4. Voice session length = `min(profile.practiceMinutes*60, plan.maxSessionSeconds)`.
5. The realtime model comes from `OPENAI_REALTIME_MODEL`, defaulting to `gpt-realtime-2.1-mini` on both the server and the mobile app (`src/realtime.ts`). The mobile app must use the model the server returns in the session response, not a hard-coded one.
6. Update `/v1/me/voice-usage` and the mobile plans and settings screens to show "sessions left this month".
7. Tests: an Essential user can't create a leadership conversation (403), the session count is enforced, the month rolls over in Asia/Kolkata, and the free tier gets exactly 2 lifetime sessions.

---

## Phase 5: Close account-takeover paths

**Problems:**
- Password sign-up has no email verification.
- `/v1/auth/oauth` auto-links to any existing account with a matching email, so an attacker can pre-register a victim's email.
- Microsoft sign-in accepts any Graph token: there is no audience or verified-email check.
- Webhook secrets are compared with `!==`.

Tasks:
1. Add `User.emailVerifiedAt DateTime?` and an `EmailVerificationToken` table (store a hash of the token, expire it after 30 min, single use). Add a migration.
2. Endpoints:
   - `POST /v1/auth/verify-email/request`, rate-limited to 3 per hour per account;
   - `POST /v1/auth/verify-email/confirm`;
   - `POST /v1/auth/password-reset/request`;
   - `POST /v1/auth/password-reset/confirm`.

   On password reset, revoke all sessions. The reset-request endpoint returns the same response whether or not the email exists.
3. Put email sending behind an `EmailSender` interface:
   - `ConsoleEmailSender` for development, which logs the link and never logs it in production;
   - `ResendEmailSender` (or SMTP) enabled by env vars;
   - production config validation fails when no sender is configured.
4. OAuth linking rules:
   - If an existing account's email is **unverified**, never link to it. Return 409 with "Verify this email with your password first, or reset your password."
   - A Google sign-in that creates a new account marks the email verified.
5. Microsoft: verify the **ID token** (JWT) against Microsoft's JWKS. You may add `jose` as a dependency for this. Check `aud` against a new `MICROSOFT_OAUTH_CLIENT_IDS` env var and use `oid`+`tid` as the subject. Until this is configured, Microsoft sign-in returns 503.
6. Replace every secret comparison with a `safeEqual()` helper built on `crypto.timingSafeEqual`.
7. Mobile: add a "verify your email" banner, plus reset-password screens.
8. Tests:
   - pre-registered unverified account + Google sign-in with the same email → 409;
   - a verified account links;
   - expired or reused tokens are rejected;
   - password reset revokes sessions;
   - a Microsoft token with the wrong audience is rejected.

---

## Phase 6: Real AI feedback (the core product)

**Problem:** `assessCommunicationEvidence` scores answers by length and keywords, and nothing generates coaching. `validateAssessment` and `assessmentSchema` exist in core but aren't used.

Tasks:
1. Add an `Assessment` table: `id`, `conversationId` (unique), `rubricVersion`, `modelVersion`, `priorities` (Json), `transferResult` (`demonstrated` | `partial` | `not_yet`), `inputTokens`, `outputTokens`, `costMicros`, `createdAt`. Add a migration.
2. Create `apps/api/src/assessment-service.ts`, behind an `AssessmentProvider` interface (same pattern as `VoiceProvider`), with:
   - an OpenAI Responses API implementation using **structured outputs** (JSON schema generated from a Zod schema that extends `assessmentSchema` with `transferResult`);
   - a model set by `ASSESSMENT_MODEL`, and the whole feature flagged by `ASSESSMENT_ENABLED`.
3. Prompt design, kept in `packages/core/src/rubrics/` as versioned data, not inline strings:
   - one rubric per framework: TASC (daily), DIMA/CLEAR (management), MESSAGE (leadership), each with 4–6 observable criteria;
   - the input is the scenario, the rubric and the learner's turns with their IDs (primary + independent retry);
   - the output is **at most 2 priorities**. Each one has an `observation`, an **exact quote** from a learner turn, the `turnId`, a `nextExercise` and a `confidence`, plus a `transferResult` comparing the retry with the primary;
   - instructions: be specific and kind, never diagnose personality or psychology, never judge accent or grammar unless it blocks meaning, and never invent quotes.
4. Flow: `POST /complete` → state `COMPLETED` → `ASSESSING` → run the assessment → `validateAssessment(result, turns)`.
   - If validation fails, retry once. If it fails again, set `FAILED`, return a clear error, and leave the learner's turns intact.
   - On success, set `FEEDBACK_READY`.
   - Run it synchronously with a 30 s timeout (this fits Vercel `maxDuration`).
5. Mastery uses `Assessment.transferResult === "demonstrated"` as a successful retry. Keep `assessCommunicationEvidence` only as a fallback when `ASSESSMENT_ENABLED=false`, and label it in the API response as `"evidenceSource": "local_check"`.
6. Add `GET /v1/me/conversations/:id/feedback` (owner only).
7. Mobile: a feedback screen showing up to 2 cards (each with its quote, observation and next exercise), the transfer result, and a "Practice this next" button that starts the recommended follow-up scenario.
8. Log token usage and cost per assessment. Add `scripts/cost-report.ts`, which prints the average voice and assessment cost per session.
9. Tests: inject a fake `AssessmentProvider` to check that a valid result reaches `FEEDBACK_READY`, a hallucinated quote leads to retry then `FAILED`, more than 2 priorities is rejected, ownership is enforced, and a disabled flag falls back to the local check.

---

## Phase 7: Connect the voice flow to the learning loop

**Problem:** every voice transcript is saved with `phase: "primary"`. A voice user can never reach the independent retry without typing.

Tasks:
1. Add `Conversation.currentPhase` (`primary` | `independent_retry`, default `primary`) with a migration.
2. The server decides the phase for every turn, both text and voice, from `currentPhase`. Remove `phase` from the client request schemas; if a client still sends it, ignore it.
3. Add `POST /v1/me/conversations/:id/advance`, which moves to `independent_retry` and requires at least one primary user turn.
4. Voice session instructions depend on the phase:
   - primary: "set the scene, let the learner respond, ask at most 2 probing questions, give no feedback";
   - retry: "present this new situation: {independentQuestion}, then listen".
   - The coach never scores during the call.
5. Mobile: after a primary voice session, show a "Ready for the new situation" button (calls advance), then let the learner start a second voice session or type. "Finish" triggers Phase 6 feedback.
6. Tests: a transcript posted after advance is stored as a retry, a client-sent phase is ignored, and advance without a primary turn is rejected.

---

## Phase 8: Fix content tagging and add the HR/manager pack as drafts

**Problems:**
- `scenario-library.ts` assigns `goal` with `(templateIndex + level) % 5`, which is unrelated to the scenario.
- Management templates map to one function by index, so 4 functions get no management scenarios.

Tasks:
1. Give each template an explicit `goal` and an explicit `functions` list in the data. Remove the modulo logic. Every function in `functions` must have at least 3 management scenarios. Add a core test that enforces this coverage.
2. Make the generated `question` text scenario-specific: combine the template's own situation with the level skill, so it isn't a generic meta-instruction.
3. Add `packages/core/content/hr-manager-pack.json` with 20 scenarios: performance-review conversations, PIP conversations, compensation and promotion denial, resignation and counter-offer, an employee complaint, a team restructure announcement, a skip-level escalation, and giving feedback to a senior peer.
   - Each needs a concrete context (names, numbers, stakes), a question, a **different** independent-transfer question, a focus and a rubric version.
   - Set `reviewStatus: "draft"` on all of them. They must stay unpublished until the founder approves them through the existing content-release sign-off (`scripts/content-release.ts`). Do not mark them approved.
4. Update the content hash and release-review doc as the existing scripts require.

---

## Phase 9: Fit the backend to serverless hosting, and remove made-up metrics

Tasks:
1. Replace the `setInterval` voice reaper in `buildApp` with `POST /internal/cron/reap-voice-sessions`, protected by a `CRON_SECRET` header (compared with `safeEqual`). Add a Vercel cron entry (every minute) to `apps/api/vercel.json`. Keep the interval only when `RUNTIME=server` (the local `server.ts`).
2. Rate limiting: add a Postgres-backed store for `@fastify/rate-limit` (or document Upstash Redis as required). Production config validation fails if the in-memory limiter is used with `NODE_ENV=production` on Vercel.
3. `/v1/me/progress`:
   - remove `practiceMinutes = completed × profile.practiceMinutes`;
   - report **measured** voice minutes from `VoiceSession` consumed seconds, plus a separate count of text sessions;
   - recompute the engagement points from these measured values;
   - update the mobile progress screen labels.
4. Fix N+1 queries: add a store method that loads completed conversations together with their user turns (and assessments) in one query, and use it for progress and recommendations.
5. Tests: the cron route rejects requests without the secret, and progress minutes equal the sum of the consumed seconds.

---

## Out of scope for this plan
Enterprise tenant administration, multilingual support, cloud audio storage and marketing site changes. Do not start these.

## Current execution notes

The later user request authorizes completing the remaining phases, in sequence with verification.
The later pricing decision supersedes historical prices in this plan: Free 2 lifetime sessions;
Essential INR 299/15, Professional INR 399/20, Executive INR 699/40, Extended INR 799/60 monthly sessions.
Each paid voice call is capped at seven minutes. No APK update or production deployment is authorized by implementation alone.
See docs/REMAINING_PHASES.md for implementation evidence and external release gates.
