# Supabase Google OAuth integration

## Scope and verified setup — 2026-10-10

The founder authorized creating the Google client, storing its secret in the named Supabase project and enabling
Google sign-in with basic email/profile access. No Gmail, Drive, billing or Microsoft permissions were requested.

- Supabase project: `nrrmhftccqsofjvoaffm`, URL `https://nrrmhftccqsofjvoaffm.supabase.co`.
- Google Cloud project: Communication Coach / `grand-ability-511205-t9`.
- Web application client: Communication Coach Supabase Google.
- Public client ID: `288657147777-i3ua3sgpitqel7lhaabfiao70gvtitml.apps.googleusercontent.com`.
- Google's authorized callback: `https://nrrmhftccqsofjvoaffm.supabase.co/auth/v1/callback`.
- Supabase allowed app redirects: `communicationcoach://oauth` and `http://localhost:8092/oauth`.
- Google consent audience: External, Testing; `luckykiran2024@gmail.com` is the saved test user and approved contact.
- Google provider is enabled; nonce checks remain on and users without email remain disallowed.
- Client secret was entered only into Supabase provider settings. It was not downloaded, committed or embedded in mobile.
- Read-only HTTP checks returned settings 200 / Google enabled and authorization 302 to Google with the matching client,
  email/profile scopes and correct callback. No real account completed a Google login during this verification.

## Architecture and account preservation

1. Mobile creates a temporary Supabase SDK client with PKCE, no persisted session, no auto-refresh and no URL auto-detection.
2. Native secure Expo Crypto supplies randomness and SHA-256 when browser WebCrypto is unavailable. Plain PKCE is refused.
3. The system browser opens Google through Supabase. Callback protocol, host, path, code and optional SDK flow ID are validated.
4. The SDK exchanges the code using the in-memory verifier. Mobile sends only the resulting access token and optional
   existing-account password proof to `POST /v1/auth/supabase`.
5. API calls the configured project's `/auth/v1/user`, with a ten-second timeout and redirects refused. It trusts neither
   a client-decoded JWT nor editable `user_metadata`. A verified Google identity, stable `identity_data.sub`, email,
   matching identity owner and authenticated role are required.
6. Existing Google subjects reuse the current OAuthIdentity and app user. Verified existing email accounts link safely;
   an unverified existing password account requires its correct password before linking. Profile/history IDs stay unchanged.
7. API issues the existing opaque seven-day app session. Temporary Supabase state is cleared locally in every outcome.

Password login, app logout/logout-all and existing direct Google/Microsoft paths are retained. No schema migration is
required for this bridge. It does not replace the custom application database with Supabase Auth user IDs.

## Environment and activation

API variables:

```text
SUPABASE_OAUTH_ENABLED=true
SUPABASE_URL=https://nrrmhftccqsofjvoaffm.supabase.co
SUPABASE_PUBLISHABLE_KEY=<project public publishable key>
```

Mobile build/export variables:

```text
EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED=true
EXPO_PUBLIC_SUPABASE_URL=https://nrrmhftccqsofjvoaffm.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<same public publishable key>
```

Only modern `sb_publishable_` client keys and hosted HTTPS `*.supabase.co` project URLs are accepted. Custom domains and
legacy anonymous JWT keys are not supported by this implementation. Never use a service-role, admin or Google secret key here.

The ignored local `.env` files now enable Google OAuth for development. The local API was tested with an in-memory
store, so that verification did not write an application user to the production database. The isolated
`communication-coach-test-api` Vercel project now has the three API variables above in its preview/production
environments and was redeployed. A deliberately invalid, well-formed-length token receives HTTP 401 from its
Supabase verifier rather than the disabled-feature response. This is not the public production API.

Expo's `preview` environment has the public Supabase URL/key. Only the `test-preview` EAS build profile enables the
mobile Google button; the regular `preview` profile remains disabled. An existing installed APK cannot acquire these
build-time values retroactively. The test APK has not been rebuilt or tested on Android in this continuation.
Omitted or false flags stay disabled and malformed values fail validation.
Production startup's existing email/security gates remain enforced; Google OAuth does not remove those requirements.

The API runtime now parses all four boolean feature flags strictly: only the strings `true` and `false` are valid;
missing flags default to false. Earlier JavaScript truthiness coercion incorrectly interpreted the string `false` as true.
This source fix has not been deployed. No production credential, billing or email requirement was removed.

Before native release:

1. Review the combined working tree, including the `test-preview` build-profile flag, before any Git push.
2. Build a new `test-preview` APK from this checkout; the installed older APK still lacks these settings.
3. Sign in with the approved Google test account; verify browser return, existing-account linking, onboarding/home,
   cancellation, repeat login, logout and revoked app sessions on a physical device. Test web on the exact allowed localhost URL.
4. Add any additional testers explicitly in Google; before public release review consent publishing, branding/privacy URLs,
   production HTTPS redirects/Site URL and provider verification requirements. Supabase Site URL remains the pre-existing
   `http://localhost:3000`; no production wildcard redirects were added.
5. Resolve external Auth user deletion/retention and update privacy disclosures. An app-account deletion currently removes
   custom data/sessions only, not Supabase Auth's user. Scoped server-side admin cleanup needs separate design and credentials.

Rollback: disable the mobile feature and API flag; existing password accounts continue to work. Do not delete Google
identities, rotate credentials or revoke provider access without a separate explicit request.

## Email and Microsoft

Google OAuth does not require Resend. Custom password verification/recovery still uses the existing API mail-delivery
integration, not Supabase mail automatically. Production delivery needs an authorized sender/provider; Supabase's built-in
testing SMTP is not a replacement for unrestricted production delivery. Microsoft is intentionally deferred.

## Verification evidence

See TESTING_STATUS.md for actual command results and failures. The original integration checkpoint passed 105/105
general tests and 83/83 regression tests; the current full suites pass 201/201 and 179/179, respectively.
The original 20 tests include the installed SDK's actual S256 verifier/challenge behavior against a mock endpoint.
The original 2026-10-10 results were not an end-to-end real Google/phone sign-in result. On 2026-10-24, a local
Expo web export completed the real Google → Supabase PKCE → local API session → `/v1/me` flow, ending on onboarding.
The local API returned HTTP 200 for both the session exchange and profile request; a fake token returned HTTP 401.
The isolated hosted test API returned HTTP 401 for a fake token after redeployment. Neither an Android native callback
nor a real-token hosted exchange was verified. See TESTING_STATUS.md for exact scope and commands. In the earlier
checkpoint, the assessment migration was applied only to `coach_verification`; this OAuth continuation did not run
database migrations, push Git or build an APK. The only hosted change here was a redeploy of the isolated test API.

Official references: [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google),
[server user verification](https://supabase.com/docs/reference/javascript/auth-getuser),
[Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp).
