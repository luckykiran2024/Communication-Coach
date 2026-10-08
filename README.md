# Communication development platform

First focused development increment. This is a development foundation, **not a finished voice-coaching MVP**.

## What you can run

- Expo mobile app: sign-up/sign-in, three-step onboarding, saved profile editing, contextual scenario previews, plan catalog, consent-based local microphone/playback, and a native-development-build WebRTC voice path.
- Fastify API: real PostgreSQL persistence through Prisma, hashed passwords, revocable bearer sessions, private profile access, and scenario recommendations.
- Next.js portal: responsive learning workspace and interactive scenario library. Enterprise administration is not implemented.

No AI responses or learner statistics are fabricated. Live AI session creation remains gated until a native development build, configured provider, valid entitlement and usage metering are verified together.

## Requirements

Node 24 LTS (verified locally: 24.14.1), npm, and PostgreSQL 17 or Docker Desktop for durable persistence. A development-only in-memory API mode is also available for phone testing without PostgreSQL.
For Android: Android Studio/emulator or a physical device and an Expo development build.
For iOS: a Mac with Xcode or an EAS build and an Apple developer account as required by your distribution method.
No AI API key is needed for this increment. Do not paste secrets into chat.

## Local setup (PowerShell)

Run from the folder containing this README:

```powershell
npm ci
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Edit the local PostgreSQL password in both .env and apps/api/.env. Use a URL-encoded password in DATABASE_URL. Then:

```powershell
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev:api
```

### Fast physical-device test without PostgreSQL

For a disposable local test, create `apps/api/.env` with:

```text
DEV_MEMORY_STORE=true
HOST=0.0.0.0
PORT=4000
```

Set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4000` in `apps/mobile/.env`, keep the phone and computer on the same Wi-Fi, then run:

```powershell
npm run dev:api
npm exec -w @coach/mobile -- expo start --go --lan
```

Scan the QR code with Expo Go. Use a disposable account: the in-memory store resets whenever the API restarts. If the phone cannot connect, allow Node.js/private-network access through Windows Firewall and confirm the computer LAN IP with `ipconfig`.

Use separate terminals for:

```powershell
npm run dev:portal
npm run dev:mobile
```

Portal: http://localhost:3000. API health: http://localhost:4000/health. Database readiness: /ready.
A healthy /health response alone does not prove a database connection.

The release direction is mobile-only: Android and iOS are the customer products. The portal remains a development/reference surface and is not required for customer hosting. See `docs/MOBILE_RELEASE_PLAN.md` for publishing, pricing and OAuth preparation.

For an initial browser UI preview of the mobile app:

```powershell
npm run web -w @coach/mobile
```

For a local Android development build (requires Android SDK):

```powershell
npm exec -w @coach/mobile -- expo run:android
```

Use expo run:ios on macOS with Xcode. Alternatively configure your Expo project and use the EAS profiles in apps/mobile/eas.json; no cloud builds have been started.

### Device API addresses

- Browser/iOS simulator: http://localhost:4000
- Android emulator: set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
- Physical device: set EXPO_PUBLIC_API_URL to your computer's LAN IP, set API HOST=0.0.0.0, and permit only trusted local-network access.
- Use HTTPS for hosted environments. Restart Expo after changing environment variables.
- Mobile web sessions intentionally remain in memory; native sessions use SecureStore.
- Until email verification/recovery and deletion flows are implemented, use disposable test accounts only.

## Verification

```powershell
npm run typecheck
npm test
npm run test:regression
npm run test:database
npm run build:portal
npm exec -w @coach/mobile -- expo install --check
npm exec -w @coach/mobile -- expo export --platform all
```

test:database needs an isolated PostgreSQL database with migrations applied. It creates disposable accounts and removes them afterward. CI provisions PostgreSQL for this test; local database execution is currently blocked because PostgreSQL/Docker is absent.

`test:regression` is the focused release-gate suite. It covers malformed and expired credentials, duplicate-account handling, invalid profile rollback, private-profile isolation, timezone-bound usage, fail-closed voice behavior, security headers/CORS and database-readiness error handling.

## Structure

```
apps/mobile/       Expo Router app and native audio readiness screen
apps/api/          Fastify routes, Prisma schema/migration, API tests
apps/portal/       Next.js learning workspace preview
packages/core/     Shared contracts, design tokens, scenario content, domain tests
docs/              Product source, architecture, decisions and handoff
.github/workflows/ CI with isolated PostgreSQL
compose.yaml       Local PostgreSQL
```

Edit branding and design tokens in packages/core/src/index.ts. Native app name and identifiers also accept APP_NAME and APP_IDENTIFIER through app.config.ts. Production identifiers defaulting to com.example are rejected.
Plan targets and allowances live in apps/api/config/plans.json and are returned by the API; none unlock paid access.

See docs/IMPLEMENTATION_STATUS.md for honest feature status, docs/TESTING_STATUS.md for verification, and docs/KNOWN_ISSUES.md before considering deployment.
