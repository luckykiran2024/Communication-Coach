# Known issues and limits

## Release blockers

- The founder explicitly kept production gated during the Git publication request. Main Git deployments and automatic
  OTA publishing are disabled; see PRODUCTION_RELEASE.md. Latest release-gate checks pass 135 general/114 regression tests.
- Phases 6–9 are implemented locally, including assessment, feedback UI, independent voice retries, draft content,
  shared PostgreSQL rate limits and measured progress. See REMAINING_PHASES.md for evidence and remaining acceptance gates.
  Provider-backed assessment is disabled by default and has not been tested with a paid request or on the phone.
- The every-minute cron in apps/api/vercel.json needs a hosting plan that supports that cadence. Vercel Hobby is daily-only.
  Provision a strong CRON_SECRET and verify scheduling before serverless voice activation; no deployment was performed.
- Voice monetary averages require operator-supplied provider billing evidence. Missing cost data remains null, never zero.
- Final local verification passes 133 general tests, 112 regression tests and 9 isolated PostgreSQL tests; typecheck,
  API bundles and web export pass. Release preflight still exits 1 with configuration/manual acceptance gates.
- Legacy conversations without a snapshot can lose their catalog scenario. AI completion now rejects that case before
  claiming completion or calling the provider, preserving the learner's editable responses; restoring missing content is manual.
- Found, not fixed: practice-day/streak grouping still dates completed conversations by their creation day rather than
  every answer's activity day. Measured voice minutes do not use that inferred date or duration.
- Supabase Google OAuth is configured at the provider and implemented in source, not activated in the installed APK or hosted API.
  Google consent is still Testing; only the approved test account is registered. Native callback and real-account sign-in remain unverified.
- Supabase Auth user records are separate from custom application accounts. Existing app deletion does not delete that external
  identity record; complete the deletion/retention design and privacy disclosure before public OAuth release.

- Live AI voice is wired for a native development build with server-controlled phase and expiry settlement. The initial
  Realtime GA response payload is corrected and the mocked two-call loop passes. Real microphone/speaker behaviour,
  final transcript timing, native interruption handling and paid entitlement/provider evaluation remain unverified.
- Social buttons use `EXPO_PUBLIC_TWITTER_URL`, `EXPO_PUBLIC_FACEBOOK_URL`, `EXPO_PUBLIC_INSTAGRAM_URL` and `EXPO_PUBLIC_REDDIT_URL`; they fall back to platform landing URLs until the final branded profile handles are supplied.
- Display pictures can be selected from the native gallery or supplied as an image URL and remain on the device; server-backed profile media is not yet included.
- Payment has a development preview and a native `expo-iap` purchase/restore lifecycle. Server-side Apple and Google purchase adapters are implemented, but the API intentionally fails closed until both credential sets are configured. Server-created purchase intents, the authenticated entitlement webhook boundary, Apple Server Notifications v2 verification, Google Pub/Sub OIDC notification re-verification, lifecycle lookup, stale-event protection and server-authoritative product-to-plan allowance enforcement are implemented; sandbox evidence and production store credentials remain before charging users.
- Native recording/playback code is untested on actual Android/iOS devices.
- Docker's daemon remains unavailable. Hosted Supabase verification uses strict TLS in coach_verification;
  twenty migrations are applied there. Public and coach_apk_test were not migrated in this continuation.
- The Supabase dashboard reports disabled RLS on existing public application tables, including User and AuthSession. Effective anonymous/authenticated Data API grants were not verified. Review and restrict that access before using real customer data; this diagnosis did not change existing tables or permissions.
- Email verification and password recovery are implemented and tested with mocked delivery and isolated PostgreSQL. Real sender credentials/domain, HTTPS recovery-link routing and native-device sign-off are still missing; production startup intentionally rejects absent delivery configuration. Retention jobs and session/device listing remain missing. Do not expose the preview as a public service.
- Microsoft now accepts signed ID tokens only, with configured audience allowlisting. It never trusts an email claim for automatic linking. Existing email collisions are refused; recovering a previously unverified Microsoft account removes its provider link, so use password login afterwards. Explicit authenticated linking and legacy Graph identity migration remain unsupported.
- Phase 5 web export passes, but Codex in-app browser requests to the local preview were refused/timed out. Screenshots and interactive UI verification were not obtained; temporary preview servers were stopped. A React Native DevTools fallback warning also occurred during Metro startup.
- Runtime boolean parsing has been repaired in source: only literal true/false strings are accepted, absent flags default
  to false, and malformed values fail startup. This prevents false from activating memory storage, voice or billing.
  Supabase activation uses the same strict parser. Deployment is still required before hosted runtimes use this fix.
- No tenant administration exists; enterprise screen is a public content preview.
- Dependency audit on 2026-09-24 reported 17 affected packages (4 high, 13 moderate), cascading from effect/deepmerge-ts in Prisma configuration and decode-uri-component/uuid in Expo tooling. No automatic forced downgrade was applied. Review upstream patches, remediate compatibly, rerun audit and all checks before release.
- No human trainer review or scientific validation of diagnostic content.
- The scenario library is seeded with structured practice content. Manager Studio now supports draft/publish/deprecate review status, persisted manager roles, production email allowlisting, scenario snapshots for learner history, revision history, and draft-only rollback. Full manager SSO remains pending; configure manager roles or `MANAGER_EMAILS` and review content before exposing it to a team.

## Development limitations

- Phase 3 voice accounting and active-session guards pass memory-backed and PostgreSQL integration tests. Advisory locks, the partial unique index, monthly/lifetime caps and cascade cleanup were exercised against the isolated Supabase verification schema. This does not verify a paid provider call or native device behavior.

- Plan session allowances are defined and enforced: the free tier grants two lifetime voice sessions; paid tier counts reset monthly in the profile timezone, and each voice session is capped at seven minutes. Migration `202610090002_monthly_voice_usage` passed on the isolated schema; review existing production data before applying it to the live schema.
- Text fallback uses server-owned phases and requires both responses. With assessment disabled it returns a labelled local
  heuristic. With assessment enabled it enters the validated AI review pipeline; neither path assesses audio or accent.
- Browser preview uses Web Speech API and Android/iOS use Expo Speech for spoken prompts. A rebuilt native runtime is required after dependency changes; accessibility announcement remains the fallback if device speech cannot start.
- Local microphone POC has no AI connection, VAD, barge-in, network recovery or persisted history.
- Audio cache files are deleted on normal screen exit; forced process termination may leave OS cache files. Add startup cleanup and verify all interruption paths before production.
- Mobile web tokens are memory-only; refreshing requires sign-in. Native uses SecureStore.
- Profile timezone is locked after first save; a support change workflow is not yet implemented.
- All twelve functions have management-library coverage, subject to plan/mastery gates. Twenty additional HR/manager
  scenarios remain unpublished drafts; no founder/trainer sign-off has been fabricated.
- Branding uses placeholder iconography. Final logos/store artwork and company/domain identity are not supplied.
- Light/dark mobile tokens are implemented; extensive animation and full accessibility/device review remain pending.
- The plan-reported malformed escaped-newline code in `apps/api/test/regression.test.ts` was not present in the current checkout. The source scan found only intentional newline escapes; no Phase 1 regression behavior needed changing.
# Isolated APK test environment update (2026-10-10)

The approved isolated test backend is deployed and its 30-request HTTP smoke flow passed. It deliberately uses an Executive workshop test grant; choosing a different plan is not a verified purchase/entitlement change. Email delivery, OAuth, AI live coaching and real store billing remain disabled. The test APK compiled, passed binary/configuration checks, installed and launched on the authorized Android phone. Native microphone/voice/theme/interruption/accessibility acceptance remains pending; see TEST_APK.md for the download and current evidence. The existing production database/API were not upgraded and main was not pushed.
