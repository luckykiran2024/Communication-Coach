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

Ignored local `.env` files were prepared with the public URL/key, but both activation flags remain **false**.
The installed test APK and hosted API are unchanged. The deployed test handler still disables OAuth. The working-tree
handler now supports explicit opt-in activation, pinned to this Supabase project and a public publishable key; omitted
or false flags stay disabled and malformed values fail validation. It needs an intentional code/config deployment.
Production startup's existing email/security gates remain enforced; Google OAuth does not remove those requirements.

The API runtime now parses all four boolean feature flags strictly: only the strings `true` and `false` are valid;
missing flags default to false. Earlier JavaScript truthiness coercion incorrectly interpreted the string `false` as true.
This source fix has not been deployed. No production credential, billing or email requirement was removed.

Before activation:

1. The separate Phase 6 Store contract is now implemented and full typecheck passes; review the combined working tree.
2. Review the prepared test-handler opt-in, then explicitly enable and deploy only that environment with matching public values.
3. Export/build a matching test app with the intended API URL and enabled mobile flag. Do not rebuild the final APK without approval.
4. Sign in with the approved Google test account; verify browser return, existing-account linking, onboarding/home,
   cancellation, repeat login, logout and revoked app sessions on a physical device. Test web on the exact allowed localhost URL.
5. Add any additional testers explicitly in Google; before public release review consent publishing, branding/privacy URLs,
   production HTTPS redirects/Site URL and provider verification requirements. Supabase Site URL remains the pre-existing
   `http://localhost:3000`; no production wildcard redirects were added.
6. Resolve external Auth user deletion/retention and update privacy disclosures. An app-account deletion currently removes
   custom data/sessions only, not Supabase Auth's user. Scoped server-side admin cleanup needs separate design and credentials.

Rollback: disable the mobile feature and API flag; existing password accounts continue to work. Do not delete Google
identities, rotate credentials or revoke provider access without a separate explicit request.

## Email and Microsoft

Google OAuth does not require Resend. Custom password verification/recovery still uses the existing API mail-delivery
integration, not Supabase mail automatically. Production delivery needs an authorized sender/provider; Supabase's built-in
testing SMTP is not a replacement for unrestricted production delivery. Microsoft is intentionally deferred.

## Verification evidence

See TESTING_STATUS.md for actual command results and failures. General tests pass 105/105 and regression tests 83/83.
The 20 new tests include the installed SDK's actual S256 verifier/challenge behavior against a mock endpoint.
This is not an end-to-end real Google/phone sign-in result. In the continuation, the existing assessment migration was
applied only to `coach_verification`, not public or APK-test data. No production writes, Git push, deployment or APK
update was performed for this OAuth task.

Official references: [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google),
[server user verification](https://supabase.com/docs/reference/javascript/auth-getuser),
[Supabase SMTP limits](https://supabase.com/docs/guides/auth/auth-smtp).
