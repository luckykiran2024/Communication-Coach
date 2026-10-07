# Known issues and limits

## Release blockers

- Live AI voice is wired for a native development build, and bound WebRTC calls can be terminated through the server-side provider control API with retryable expiry cleanup. Physical-device verification, paid entitlement validation and provider-backed assessment remain incomplete. Authenticated provider input/output transcripts are persisted against the conversation. Local evidence checks do not analyze audio or claim validated communication ability.
- Social buttons use `EXPO_PUBLIC_TWITTER_URL`, `EXPO_PUBLIC_FACEBOOK_URL`, `EXPO_PUBLIC_INSTAGRAM_URL` and `EXPO_PUBLIC_REDDIT_URL`; they fall back to platform landing URLs until the final branded profile handles are supplied.
- Display pictures can be selected from the native gallery or supplied as an image URL and remain on the device; server-backed profile media is not yet included.
- Payment has a development preview and a native `expo-iap` purchase/restore lifecycle. Server-side Apple and Google purchase adapters are implemented, but the API intentionally fails closed until both credential sets are configured. Server-created purchase intents, the authenticated entitlement webhook boundary, Apple Server Notifications v2 verification, Google Pub/Sub OIDC notification re-verification, lifecycle lookup, stale-event protection and server-authoritative product-to-plan allowance enforcement are implemented; sandbox evidence and production store credentials remain before charging users.
- Native recording/playback code is untested on actual Android/iOS devices.
- Docker/PostgreSQL is absent locally. Prisma client generation succeeded; runtime integration test remains pending.
- Email verification, password recovery, retention jobs and session/device listing are missing. Account deletion, sign-out-all and authenticated data export are available, but do not use real personal data or expose this preview as a public service.
- No tenant administration exists; enterprise screen is a public content preview.
- Dependency audit on 2026-09-24 reported 17 affected packages (4 high, 13 moderate), cascading from effect/deepmerge-ts in Prisma configuration and decode-uri-component/uuid in Expo tooling. No automatic forced downgrade was applied. Review upstream patches, remediate compatibly, rerun audit and all checks before release.
- No human trainer review or scientific validation of diagnostic content.
- The scenario library is seeded with structured practice content. Manager Studio now supports draft/publish/deprecate review status, persisted manager roles, production email allowlisting, scenario snapshots for learner history, revision history, and draft-only rollback. Full manager SSO remains pending; configure manager roles or `MANAGER_EMAILS` and review content before exposing it to a team.

## Development limitations

- Free diagnostic allowance is not yet defined or enabled. No paid allowance can be consumed because live voice is disabled.
- Text fallback stores primary and independent-retry responses, requires both before completion, and calculates a transparent local evidence signal. It does not generate AI coaching, transcription or audio feedback.
- Browser preview uses Web Speech API and Android/iOS use Expo Speech for spoken prompts. A rebuilt native runtime is required after dependency changes; accessibility announcement remains the fallback if device speech cannot start.
- Local microphone POC has no AI connection, VAD, barge-in, network recovery or persisted history.
- Audio cache files are deleted on normal screen exit; forced process termination may leave OS cache files. Add startup cleanup and verify all interruption paths before production.
- Mobile web tokens are memory-only; refreshing requires sign-in. Native uses SecureStore.
- Profile timezone is locked after first save; a support change workflow is not yet implemented.
- Supported functions are selectable but only HR, engineering, finance, product and entrepreneurship have specialist scenario packs; others get the generic Daily scenario.
- Branding uses placeholder iconography. Final logos/store artwork and company/domain identity are not supplied.
- Light/dark mobile tokens are implemented; extensive animation and full accessibility/device review remain pending.
