# Functional verification — 2026-10-24

## Verdict

The real Expo web app was exercised in the Codex in-app browser against the real Fastify routes and a disposable memory
store. The learner journey reaches detailed feedback, explicit failure recovery, a follow-up exercise and measured progress.
Four reproducible presentation/accessibility defects were fixed and the affected screens were retested after rebuilding.

This is **not public-launch sign-off**. PostgreSQL access is blocked, the emulator did not become usable, and external
email/AI/OAuth/voice/store services were not validated. No APK, hosted backend, production or Git remote was updated.

## Test environment and integrity

- Browser: actual Expo app export, not the earlier standalone feedback component preview; local URL `http://127.0.0.1:4311/`.
- API: real Fastify app on loopback port 4310; the browser's `/api` requests are proxied to it. Business routes are not replaced.
- Data: disposable memory store; dedicated example.com test account. Browser reload intentionally loses its ephemeral token;
  signing in again restores records while the test server runs. This does not demonstrate PostgreSQL durability.
- Email sender and assessment provider are explicit injected test doubles. The first assessment deliberately throws,
  then a structurally valid authored report tests recovery. Sample scores are not live AI judgments or quality evidence.
- Executive development grant exposes all workshops. Payment confirmation is explicitly simulated; no purchase is made.
- The page carries a persistent local-functional-test notice. Live voice stays disabled and no microphone was recorded.
- `scripts/functional-preview.mts` requires `COACH_FUNCTIONAL_PREVIEW=true`, binds only to loopback, and rejects production
  or Vercel execution. It loads no `.env` automatically and never uses a real AI/email provider.
- The built API bundle was checked: it does not contain the injected functional-provider marker.

## Browser functional results

| Case | Actual result |
|---|---|
| Empty registration | Rejected with visible validation and HTTP 400 |
| Disposable registration | HTTP 201; navigates to onboarding |
| Onboarding validation | Missing name/title and missing audience are blocked with specific messages |
| Three-step profile save | Work context, goal and preferences save; selected Executive package is reviewed |
| Package preview | INR 699 / 40 monthly / seven-minute maximum displayed; simulated confirmation reaches home |
| Email proof | Stub sender captures a code; code plus current password verifies the account; home banner disappears |
| Workshop separation | Daily, Professional/Business and Leadership route to distinct exercises |
| Programme restrictions | Programme 1 selected; higher programmes visibly locked for a Level 1 account |
| More examples | Daily workshop toggle reveals eight additional examples and can hide them |
| Primary response | Saved through the real turn route; independent-situation action becomes available |
| Independent retry | Advance changes the prompt; retry saves separately; Finish appears only after it is saved |
| Interrupted assessment | Deliberate provider failure returns 503; both responses survive and Try feedback again appears |
| Feedback recovery | Explicit retry returns 200 and navigates to the evidence-linked report |
| Detailed feedback | Title, opening quote, seven areas, strengths, focused improvement and illustrative rewrite render |
| Evidence disclosure | Score row reveals exact saved retry text; `aria-expanded=true` after the accessibility fix |
| Follow-up exercise | Practice this next creates a different eligible conversation; Executive grant permits its module |
| Progress | One completed text practice, one practice day/comparison, zero measured voice minutes/calls |
| Transfer/mastery | Partial fixture result does not become a demonstrated retry; Level 1 remains |
| Pricing catalog | Free 2 lifetime; Essential 299/15; Professional 399/20; Executive 699/40; Extended 799/60 |
| Plan review navigation | Reviewing Essential shows Essential / INR 299 / 15, not the current Executive package |
| Theme | Light/Dark change actual rendered colors; System is absent; preference survives browser reload |
| Accessible selection | Active theme exposes checked=true, inactive checked=false; previously both attributes were absent |
| Narrow layouts | Home overflow reproduced at 320px; zero overflowing elements after correction; feedback passes at 320/360px |
| Saved sessions | Reopening unfinished and completed conversations preserves their state; completed practice links to feedback |
| Wrong password | HTTP 401 with a visible neutral error; valid password subsequently succeeds |
| Sign out all | HTTP 204, returns to sign-in; later login restores saved records in the same test server |
| Recovery request | Stub reset request returns the neutral response; no browser password change or real email delivery claimed |
| Audio readiness | WEB PREVIEW ONLY; recording requires consent and starts disabled; live coach fails closed |
| Legal navigation | Lucky Kiran attribution and explicitly draft legal/privacy placeholders are visible |
| Console | Final rebuilt browser pass reports no captured console errors |

These are agent-driven browser checks with captured state, not a claim that every possible device or edge case was tested.
The backend automated suites separately cover ownership, quotas, assessment validation, account recovery and entitlement gates.

## Defects fixed and RCA

| Defect before | Root cause | Correction / retest |
|---|---|---|
| Two practice headers | Parent route group and nested Stack both rendered headers | Parent owns the titled header; nested header disabled; one Practice session header verified |
| Text says no AI feedback even when enabled | Static legacy copy ignored the API capability flag | Capability-aware primary/retry copy; enabled, disabled and legacy-unknown states tested |
| Home row content overflows at 320px | Row headings/action labels could not shrink | Shared wrapping/min-width styles; real home retest reports zero horizontal overflow |
| Radio/disclosure state missing in web accessibility | Native accessibilityState did not expose the expected web attributes | Explicit aria-checked/aria-expanded while retaining native state; browser attributes verified |

No content scores, plan allowances, learning evidence or existing provider gates were changed by these presentation fixes.
The long home-page information hierarchy remains a separate, acknowledged UX task; it was not silently redesigned here.

## Automated checks

| Command/check | Result |
|---|---|
| npm run typecheck | PASS, all four workspaces, exit 0 |
| npm test | PASS 176/176; zero failed/skipped/cancelled/todo; exit 0; duration_ms 14987.1481 |
| npm run test:regression | PASS 155/155; zero failed/skipped/cancelled/todo; exit 0; duration_ms 9009.617 |
| Functional harness standalone TypeScript check | PASS, exit 0 |
| API production bundle | PASS, exit 0; no functional fixture marker included |
| Actual mobile Expo web export | PASS, exit 0; artifacts/functional-web |
| Whitespace and new/changed source line audit | PASS; no added source line exceeds 140 characters |
| npm run release:preflight | EXPECTED BLOCKED, exit 1; configuration/manual release gates remain |

Five tests were added: local-fixture execution guard, flexible text, single-header configuration, capability-aware copy and
native/web radio selection state. General/regression totals increased from 171/150 to 176/155.

## Emulator and database blockers

- ADB initially could not start; scoped permission to `.android` allowed its foreground server to run.
- Existing AVD: `Medium_Phone_API_37.0`. Default launch reports that x86_64 acceleration is unavailable.
  `emulator -accel-check` returns code 6 and a Hyper-V/Windows Hypervisor Platform configuration message.
- A software/no-snapshot attempt was made without changing Windows features. ADB continued to show `emulator-5554 offline`;
  `getprop sys.boot_completed` returned device offline. No install/launch/native acceptance pass is claimed.
- The additional emulator wrapper reported an existing-AVD lock and was terminated; test launch sessions were interrupted
  during cleanup. The final observed ADB state before cleanup was offline, not a booted Android device.
- No physical phone was listed. Real Android microphone, interruptions, transcripts, speech accent and purchases remain pending;
  no iOS device was available. A browser run cannot substitute for these checks.
- The guarded read-only Supabase probe again returned `FATAL: (ENOTFOUND) tenant/user postgres.nrrmhftccqsofjvoaffm not found`.
  No migration or database integration run succeeded in this increment. Check connection/project state privately.
- The dashboard check redirected to Supabase sign-in, then the previously used GitHub sign-in. Human sign-in is required;
  no dashboard project status or cause such as pausing was verified. No credential or project configuration was changed.
- A configured DATABASE_URL preflight check is configuration evidence only, not a successful database connection.

## Release prerequisites still open

Restore isolated PostgreSQL connectivity, apply pending migrations and rerun guarded integration tests; provide a usable
emulator/physical Android device for native QA; perform bounded real-assessment quality/cost validation; verify production
email/recovery and OAuth; configure the scheduler; sign off store sandbox purchases/restores/refunds; replace legal/support
placeholders and obtain human content/release approval. Existing preflight gates were not weakened to manufacture readiness.

No paid AI request was made: US$0 spent. No public deployment, Git push, APK/OTA update or store submission occurred.

## Local evidence and reproduction

- `artifacts/functional-server.log`: actual method/path/status trace, including complete=503, feedback/retry=200,
  wrong-password login=401 and logout-all=204. Two injected assessment calls and two captured test emails were observed;
  reopening feedback did not trigger another assessment.
- `artifacts/functional-browser-evidence.json`: captured browser states for the checked learner journey and corrections.
- `artifacts/functional-feedback-final-320.jpg`, `functional-feedback.jpg`, `functional-settings-dark.jpg`: browser screenshots.
- `artifacts/functional-console-errors.json`: final captured console error list, empty.
- `artifacts/functional-{typecheck,tests,regression,harness-typecheck,api-build,web-export,preflight,database-probe}.log`.
- `artifacts/emulator-functional*.log` and `artifacts/functional-emulator-final.log`: native startup/ADB limitations.

The harness serves the exported app at port 4311 and uses the actual route implementation. To reproduce in a development
environment, export the web app with EXPO_PUBLIC_API_URL=/api, payment preview enabled and external OAuth disabled into
artifacts/functional-web, then run the harness with explicit local-only opt-in. Do not use real accounts or production data.
