# Known issues and limits

## Release blockers

- Live AI voice is wired for a native development build, and bound WebRTC calls can be terminated through the server-side provider control API with retryable expiry cleanup. Physical-device verification, paid entitlement validation and provider-backed assessment remain incomplete. Authenticated provider input/output transcripts are persisted against the conversation. Local evidence checks do not analyze audio or claim validated communication ability.
- Social buttons use `EXPO_PUBLIC_TWITTER_URL`, `EXPO_PUBLIC_FACEBOOK_URL`, `EXPO_PUBLIC_INSTAGRAM_URL` and `EXPO_PUBLIC_REDDIT_URL`; they fall back to platform landing URLs until the final branded profile handles are supplied.
- Display pictures can be selected from the native gallery or supplied as an image URL and remain on the device; server-backed profile media is not yet included.
- Payment has a development preview and a native `expo-iap` purchase/restore lifecycle. Server-side Apple and Google purchase adapters are implemented, but the API intentionally fails closed until both credential sets are configured. Server-created purchase intents, the authenticated entitlement webhook boundary, Apple Server Notifications v2 verification, Google Pub/Sub OIDC notification re-verification, lifecycle lookup, stale-event protection and server-authoritative product-to-plan allowance enforcement are implemented; sandbox evidence and production store credentials remain before charging users.
- Native recording/playback code is untested on actual Android/iOS devices.
- Docker CLI is installed but its daemon is unavailable. Supabase Session pooler credentials and strict TLS were verified on 2026-10-10; all 17 migrations and both integration tests pass in `coach_verification`. Existing public application tables were not upgraded; production migration review and deployment remain separate release gates.
- The Supabase dashboard reports disabled RLS on existing public application tables, including User and AuthSession. Effective anonymous/authenticated Data API grants were not verified. Review and restrict that access before using real customer data; this diagnosis did not change existing tables or permissions.
- Email verification and password recovery are implemented and tested with mocked delivery and isolated PostgreSQL. Real sender credentials/domain, HTTPS recovery-link routing and native-device sign-off are still missing; production startup intentionally rejects absent delivery configuration. Retention jobs and session/device listing remain missing. Do not expose the preview as a public service.
- Microsoft now accepts signed ID tokens only, with configured audience allowlisting. It never trusts an email claim for automatic linking. Existing email collisions are refused; recovering a previously unverified Microsoft account removes its provider link, so use password login afterwards. Explicit authenticated linking and legacy Graph identity migration remain unsupported.
- Phase 5 web export passes, but Codex in-app browser requests to the local preview were refused/timed out. Screenshots and interactive UI verification were not obtained; temporary preview servers were stopped. A React Native DevTools fallback warning also occurred during Metro startup.
- Existing runtime z.coerce.boolean environment parsing treats the string "false" as true. This pre-existing deployment issue was identified but not changed in the account-security phase; repair it before production startup.
- No tenant administration exists; enterprise screen is a public content preview.
- Dependency audit on 2026-09-24 reported 17 affected packages (4 high, 13 moderate), cascading from effect/deepmerge-ts in Prisma configuration and decode-uri-component/uuid in Expo tooling. No automatic forced downgrade was applied. Review upstream patches, remediate compatibly, rerun audit and all checks before release.
- No human trainer review or scientific validation of diagnostic content.
- The scenario library is seeded with structured practice content. Manager Studio now supports draft/publish/deprecate review status, persisted manager roles, production email allowlisting, scenario snapshots for learner history, revision history, and draft-only rollback. Full manager SSO remains pending; configure manager roles or `MANAGER_EMAILS` and review content before exposing it to a team.

## Development limitations

- Phase 3 voice accounting and active-session guards pass memory-backed and PostgreSQL integration tests. Advisory locks, the partial unique index, monthly/lifetime caps and cascade cleanup were exercised against the isolated Supabase verification schema. This does not verify a paid provider call or native device behavior.

- Plan session allowances are defined and enforced: the free tier grants two lifetime voice sessions; paid tier counts reset monthly in the profile timezone, and each voice session is capped at seven minutes. Migration `202610090002_monthly_voice_usage` passed on the isolated schema; review existing production data before applying it to the live schema.
- Text fallback stores primary and independent-retry responses, requires both before completion, and calculates a transparent local evidence signal. It does not generate AI coaching, transcription or audio feedback.
- Browser preview uses Web Speech API and Android/iOS use Expo Speech for spoken prompts. A rebuilt native runtime is required after dependency changes; accessibility announcement remains the fallback if device speech cannot start.
- Local microphone POC has no AI connection, VAD, barge-in, network recovery or persisted history.
- Audio cache files are deleted on normal screen exit; forced process termination may leave OS cache files. Add startup cleanup and verify all interruption paths before production.
- Mobile web tokens are memory-only; refreshing requires sign-in. Native uses SecureStore.
- Profile timezone is locked after first save; a support change workflow is not yet implemented.
- Supported functions are selectable but only HR, engineering, finance, product and entrepreneurship have specialist scenario packs; others get the generic Daily scenario.
- Branding uses placeholder iconography. Final logos/store artwork and company/domain identity are not supplied.
- Light/dark mobile tokens are implemented; extensive animation and full accessibility/device review remain pending.
- The plan-reported malformed escaped-newline code in `apps/api/test/regression.test.ts` was not present in the current checkout. The source scan found only intentional newline escapes; no Phase 1 regression behavior needed changing.
# Isolated APK test environment update (2026-10-10)

The approved isolated test backend is deployed and its 30-request HTTP smoke flow passed. It deliberately uses an Executive workshop test grant; choosing a different plan is not a verified purchase/entitlement change. Email delivery, OAuth, AI live coaching and real store billing remain disabled. The test APK compiled, passed binary/configuration checks, installed and launched on the authorized Android phone. Native microphone/voice/theme/interruption/accessibility acceptance remains pending; see TEST_APK.md for the download and current evidence. The existing production database/API were not upgraded and main was not pushed.
