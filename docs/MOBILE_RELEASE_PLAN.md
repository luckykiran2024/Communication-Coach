# Mobile-only release plan

## Product direction

The customer product is Android and iOS only. There is no public web application requirement. The API and database still need public hosting because the mobile apps authenticate, store progress, enforce usage and coordinate future voice sessions.

Voice practice is sold as focused sessions of up to seven minutes, with monthly plan limits. This is a practice format, not a guarantee of a particular learning outcome.

## Distribution

- Android: build an Android App Bundle with EAS or a local Android toolchain, then distribute through Google Play Console.
- iOS: build an IPA with EAS or Xcode on macOS, then distribute through App Store Connect and TestFlight.
- Backend: host the Fastify API and PostgreSQL database as a private backend service. No browser frontend is needed for customer use.
- Testing: Expo Go is suitable for the current local preview. Native audio and live voice require a development build and physical Android/iOS testing before release.

## Publishing and build budget

These are launch-budget estimates, not a final invoice:

| Item | Budget | Notes |
| --- | ---: | --- |
| Google Play Console | US$25 one time | Developer registration |
| Apple Developer Program | US$99/year | Required for App Store distribution and TestFlight |
| EAS | US$0 for limited free usage, or paid plan as build volume grows | Use local builds where practical |
| API + PostgreSQL | Start with a managed free/low-cost pilot tier; budget a paid tier before public launch | Memory mode is development-only and loses data on restart |
| AI voice provider | Variable | Must be measured from real sessions before final pricing |

Store commissions, taxes, backend traffic, AI audio/text usage and support are separate from the subscription price.

## Current plan preview

| Plan | Monthly target | Voice sessions |
| --- | ---: | ---: |
| Free | ₹0 | 2 lifetime |
| Essential | ₹299 | 15/month |
| Professional | ₹399 | 20/month |
| Executive | ₹699 | 40/month |
| Extended | ₹799 | 60/month |

Each paid voice session lasts up to seven minutes. Storefront prices and entitlements remain subject to final product configuration and verification.

These are customer subscription allocations, not the actual AI provider cost. Actual cost per 20-minute session depends on transcription, realtime model, generated speech, infrastructure and failed/interrupted sessions. Instrument those costs before enabling paid voice.

## Visual system

- **Fonts:** use the native system font with a shared type scale, weights, line heights and letter spacing. This keeps Android and iOS fast while keeping headings, labels and body text consistent.
- **Color grading:** use one shared palette: deep navy for focus, lavender/blue for primary actions, teal for positive progress, and muted neutrals for supporting text. The same tokens drive cards, buttons, icons and progress bars in light and dark mode.
- **Vector imagery:** use platform vector symbols for people, client, microphone, recording and progress. The waveform is drawn as animated UI bars, so it remains sharp at every device density instead of using raster images.
- **Motion:** page transitions use a short fade. Voice activity uses a restrained waveform and press feedback; the reduce-motion setting should disable nonessential movement before release.

## Google and Microsoft sign-in

The mobile sign-in flow now uses native OAuth requests and the API verifies the resulting provider token. Before enabling the buttons for a real build:

1. Create Android and iOS OAuth clients for the final application identifiers.
2. Configure Google redirect URIs and Android signing fingerprints.
3. Register a Microsoft Entra public client and native redirect URIs.
4. Use the existing server-side identity-linking endpoint, which verifies provider tokens, maps the provider subject to an account, and issues the same short-lived app session used by email login.
5. Store provider secrets only on the API side and test account linking, cancellation, duplicate email and revoked-token cases.

## Production build configuration

Set these values through EAS environment variables; do not commit production values to the repository:

- `APP_VARIANT=production`
- `APP_IDENTIFIER=com.c2coach.app`
- `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`
- The Google client IDs and Microsoft client ID listed in `docs/OAUTH_SETUP.md`

The Expo config rejects production builds that use placeholder identifiers or a local/non-HTTPS API URL. After setting the EAS values, use the `production` profile:

```text
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

## Store billing development path

The mobile app uses `expo-iap` for Google Play / Apple subscription purchase and restoration, not Razorpay.
Development previews keep `EXPO_PUBLIC_PAYMENT_PREVIEW=true` and never grant paid access from simulated confirmation.
The `store-sandbox` EAS profile disables simulation, uses a separate update channel and produces an Android AAB;
it requires explicit final identifiers, staging HTTPS API and real store products/credentials before it can be used.
`BILLING_PROVIDERS=google` supports Android-first setup without enabling unconfigured Apple billing; the default remains both.
Android selects the configured monthly base-plan offer (`EXPO_PUBLIC_GOOGLE_BASE_PLAN_ID`, default `monthly`).
Purchases carry a server-owned account token, and access requires server verification before transaction finalization.
Pending transactions do not grant access. Store account verification, licensed test users and real-device lifecycle tests
are still required; source tests and preview screenshots do not establish working store payments.
Seamless upgrades/downgrades and proration remain outstanding; duplicate subscription creation is blocked rather than guessed.
See `STORE_BILLING_TEST_PLAN.md` for current results, exact setup order, owner tasks and sandbox acceptance matrix.

The repository retains Expo web tooling for development and automated bundle checks only. The customer release is Android/iOS; no web app is part of the product launch plan.
