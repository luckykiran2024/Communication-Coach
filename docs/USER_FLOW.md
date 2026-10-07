# Communication Coach user flow

## Product flow

The mobile product has **11 primary screens/routes**, with onboarding presented as three steps inside one route. Vector icons identify the main intent: person for identity, spark for coaching, microphone for voice, clock for plans, chart for progress, and gear for settings.

1. **Welcome / Sign in** (`/`) — create an account, sign in, or use configured Google/Microsoft sign-in.
2. **Profile: work context** (`/onboarding`, step 1) — name, function, role and career context.
3. **Profile: communication goals** (`/onboarding`, step 2) — audience, goal, situations and challenges.
4. **Profile: practice terms** (`/onboarding`, step 3) — practice length, timezone, reduced motion and package selection.
5. **Confirm package / payment** (`/payment`) — review the selected package. In the development preview, payment can be simulated without charging or granting a real entitlement. Production must connect a store/payment provider before confirmation is enabled.
6. **Today / Home** (`/home`) — current level, practice plan, recommended scenarios, allowance and progress shortcut.
7. **Practice scenario** (`/practice/[id]`) — coach prompt, accent-aware speech playback, primary response, independent retry, microphone entry point and text fallback.
8. **Audio readiness** (`/voice`) — local microphone permission, recording, waveform, playback and deletion.
9. **Progress** (`/progress`) — streak, practice minutes, seven-day rhythm chart, four-gate mastery levels and saved-response evidence signal.
10. **Practice plans** (`/plans`) — compare plans and change the selected package; reachable from Settings only.
11. **Settings** (`/settings`) — profile editing, theme, coach accent, display picture, plans, progress, social links and sign-out.

## Navigation rules

- Home keeps practice and progress prominent; profile editing and plan changes live only under Settings.
- New users cannot enter Home from onboarding until the package confirmation step is completed.
- The development payment action is explicitly labelled as simulation. No payment or entitlement is implied.
- The default coach speech hint is Indian English (`en-IN`); British, American and Australian English are available in Settings. The actual installed device voice controls the final sound.
- Mastery levels require minimum practice days, distinct completed scenarios, successful independent retries and saved-response evidence checks. The local evidence signal never analyzes audio or claims validated communication ability.

## Release sequence

Welcome → three-step profile → package confirmation/payment → “Let’s start” → Home → scenario → prompt speech → local microphone check or future live voice → Progress. Settings is available from the Home gear icon and contains account/customisation controls.

## Scenario library and manager flow

The catalog starts with 126 scenarios: six curated seeds plus 120 structured scenarios across Daily, Management and Leadership, with five progressive practice levels. Learners see scenarios at or below their current mastery level; the next level unlocks only after its four evidence gates are met. Manager-authored scenarios enter the shared library as drafts and become learner recommendations only after an approved manager explicitly publishes them.

Managers use the portal’s **Manager studio** vector-add action to enter a title, module, function, goal, level, context, primary prompt and independent retry prompt. The portal posts the content to `POST /v1/manager/scenarios`; the API validates the scenario, persists it in the configured store, and returns it to the library. Development uses `development-manager-key`; production uses an authenticated session for an email listed in `MANAGER_EMAILS`.
