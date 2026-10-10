# Phase 5 account security

Supabase Google OAuth extension (2026-10-10): see SUPABASE_OAUTH.md for the live provider setup, PKCE client flow,
`POST /v1/auth/supabase` server verification and activation gates. It supplements, not replaces, password login.
An unverified existing account requires its correct password plus a verified Google identity before linking;
verified-email and already-linked accounts retain their existing app user ID. Google uses email/profile access only.
Google client secrets never belong in the mobile bundle or repository. App deletion currently covers custom app data,
not the new external Supabase Auth user record; provider deletion/retention must be resolved before public release.

Implemented on 2026-10-10. This is source and isolated-database verification, not a production release.

## Before and after

| Boundary | Before | Now |
| --- | --- | --- |
| Password accounts | No email proof | Nullable verified timestamp, banner and authenticated confirmation |
| Email links | Missing | 256-bit random codes, SHA-256-only persistence, 30-minute expiry, single use |
| Verification requests | Missing | Three per rolling hour per account, serialized across API instances |
| Password recovery | Missing | Generic request response, password change, all app sessions revoked atomically |
| Outstanding recovery links | Missing | Every outstanding account email token invalidated on reset |
| OAuth email collision | Matching email silently linked | Unverified existing account returns the specified HTTP 409 |
| New Google account | No stored verification state | Verified Google email recorded on account creation |
| Microsoft | Microsoft Graph access token accepted | Signed RS256 ID token, Microsoft JWKS, audience, tenant issuer, expiry and oid/tid checks |
| Microsoft email claims | Email used as account authority | Email never authorizes automatic cross-account linking |
| Manager email allowlist | Unverified signup could gain manager access | Email proof required; explicitly persisted manager roles still work |
| Webhook/development manager secrets | Ordinary string comparison | SHA-256 plus timingSafeEqual; malformed/empty values rejected |
| Reset/login race | A stale password check could issue a new session | Session creation checks the password hash under the same account lock |

## API contracts

- POST /v1/auth/verify-email/request: authenticated, no body; three requests/hour/account.
- POST /v1/auth/verify-email/confirm: authenticated; token and current password. Token must belong to that account.
- POST /v1/auth/password-reset/request: email; same response for an existing, missing or account-throttled address.
- POST /v1/auth/password-reset/confirm: token and new password of 12–128 characters.
- POST /v1/auth/oauth: Google uses provider/accessToken; Microsoft uses provider/idToken. Graph access tokens are rejected.
- GET /v1/me and issued-session user objects now include emailVerifiedAt (ISO timestamp or null), never password hashes.

Confirmation deliberately requires the current password and signed-in owner: opening an unsolicited verification link alone
must not confirm a password account pre-registered by someone else. Recovery proves mailbox ownership, verifies the email and
revokes all app sessions. Recovery of a previously unverified account also removes its provider links, preventing a malicious
pre-registration provider from retaining access. Previously verified accounts retain their established provider identities.
Already-connected provider voice calls are not claimed to be revoked by password reset.

## Microsoft limitations

Microsoft email claims are not proof of ownership, even if a tenant supplies an email_verified custom claim.
This follows Microsoft's [ID token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).
Returning users authenticate by the signed tenant/object identity, not an email match.
A new Microsoft identity may create an unverified account; email proof requires password recovery to set a password.
Recovering that previously unverified account removes its provider link; subsequently use password sign-in.
Explicit authenticated Microsoft account linking is not implemented in this phase. Existing email collisions are refused.
Legacy Graph-id-only identities are not silently migrated to tenant/object subjects.
Without MICROSOFT_OAUTH_CLIENT_IDS, Microsoft sign-in returns 503.

## Configuration and release gates

Development defaults to ConsoleEmailSender; links appear only in the development terminal.
ConsoleEmailSender refuses to log or send in production.

Production requires:

- EMAIL_PROVIDER=resend
- RESEND_API_KEY, supplied privately through the ignored environment file or deployment secrets
- EMAIL_FROM, a verified sender email address
- ACCOUNT_EMAIL_LINK_BASE_URL, the HTTPS origin/path serving the mobile web recovery routes or an approved app-link landing page
- MICROSOFT_OAUTH_CLIENT_IDS, comma-separated approved application UUIDs, when Microsoft sign-in is enabled
- Matching EXPO_PUBLIC_MICROSOFT_CLIENT_ID and a Microsoft public-client authorization-code/PKCE redirect registration

Resend delivery uses its HTTPS API with a ten-second timeout and no new email SDK dependency.
The adapter follows Resend's [Send Email API](https://resend.com/docs/api-reference/emails/send-email).
Production startup rejects missing email delivery configuration. Delivery failures do not expose provider details or account
existence in password-reset responses. The app supports manually pasting the email code if link routing is unavailable.
Real Resend delivery, sender-domain verification, HTTPS landing-page deployment, Android/iOS app links and native OAuth
redirects have not been tested. Do not expose these screens as production-ready until those checks pass.

## Migration and files

New migration: apps/api/prisma/migrations/202610100001_account_security/migration.sql.
It adds User.emailVerifiedAt and EmailVerificationToken, with purpose/expiry checks, indexes and cascading account deletion.
Existing account timestamps remain null; no historical email ownership was invented.
All 17 migrations were applied only in the isolated coach_verification schema; public application tables were not migrated.

- API: routes/account-security.ts, email-sender.ts, lib/oauth.ts, lib/safe-equal.ts and auth/profile/billing route changes.
- Storage: schema.prisma, store.ts, memory-store.ts and prisma-store.ts; no route writes Prisma directly.
- Composition/configuration: app.ts, lib/create-route-dependencies.ts, routes/context.ts, config.ts, runtime.ts and .env.example.
- Mobile: verify-email.tsx, password-reset.tsx, email-verification-banner.tsx, welcome/auth/API/navigation and onboarding/home integration.
- Shared contract: packages/core/src/index.ts OAuth request schema.
- Tests: account-security.test.ts, database.integration.ts, existing auth/config regression updates and scripts/run-regression.mjs.
- Dependency: jose, authorized by Phase 5; lockfile updated.

## Root causes and remaining risks

The old account-linking logic treated email equality as ownership; Microsoft Graph tokens did not bind login to this app.
Missing recovery tokens/session revocation prevented safe mailbox-owner recovery. Manager allowlisting had the same unverified
email trust problem. The new proof boundaries and transaction locks address these paths.

Not fixed here: existing public Supabase Data API/RLS grants, upstream dependency advisories, retention cleanup and device/session
listing. Existing runtime z.coerce.boolean parsing treats nonempty strings such as "false" as true; review and repair that
pre-existing deployment configuration issue before production. No final APK, production deployment, commit or push occurred.
Founder inputs still needed before release: a verified sender/domain, Resend credential in private configuration, HTTPS link
destination and Microsoft app registration if Microsoft login is wanted. No secrets should be pasted into chat.
