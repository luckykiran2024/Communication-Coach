# Google and Microsoft sign-in setup

The app already contains the native authorization flow and the API token-verification endpoint. Provider credentials are intentionally not committed to the repository.

## Mobile environment

Copy the example file and fill in the platform client IDs:

```powershell
Copy-Item apps/mobile/.env.example apps/mobile/.env
notepad apps/mobile/.env
```

Set these values:

```text
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_MICROSOFT_CLIENT_ID=...
```

Set the corresponding server-side Google audience allowlist in `apps/api/.env`:

```text
GOOGLE_OAUTH_CLIENT_IDS=android-client-id,ios-client-id,web-client-id
```

Do not add provider client secrets to the mobile file. A client ID is public; a client secret is not.

## Google

1. Create a Google Cloud project and configure the OAuth consent screen.
2. Create an Android OAuth client for the final Android package and signing certificate fingerprint.
3. Create an iOS OAuth client for the final iOS bundle identifier.
4. Create a Web OAuth client for browser-based development only.
5. Put the resulting IDs in `apps/mobile/.env`.

## Microsoft

1. Register an app in Microsoft Entra ID.
2. Add the Android and iOS platform redirect settings for the final application identifiers.
3. Enable the public-client/native flow and request `openid`, `profile`, `email` and `User.Read`.
4. Put the application client ID in `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`.

The app uses the `communicationcoach` scheme and the `/oauth` path. Register the exact redirect URI shown by the Expo authentication request for the selected build type; Expo Go and a production build can use different redirect forms. The API rejects Google tokens whose verified audience is not in `GOOGLE_OAUTH_CLIENT_IDS`.

## Apply changes

Restart Expo after editing `.env`:

```powershell
npm exec -w @coach/mobile -- expo start --go --lan --port 8081 -c
```

Production client IDs and redirect settings require a new Android/iOS build. The production Expo config refuses to build until Google Android, Google iOS and Microsoft client IDs are present. The API verifies Google tokens through Google and Microsoft tokens through Microsoft Graph before creating or reusing the app session. It also stores the provider subject (`sub` for Google or `id` for Microsoft) and links future sign-ins by that stable subject instead of trusting a changed email claim.

## Manager publishing

Production manager publishing uses a normal API session plus an email allowlist. Set `MANAGER_EMAILS` on the API, sign in with that account in Manager Studio, and publish with the resulting session. The development `MANAGER_SCENARIO_KEY` is accepted only when `NODE_ENV` is not `production`.
