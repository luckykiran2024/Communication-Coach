# Isolated Android test release

## Scope

The founder approved a separate test backend on 2026-10-10. This is not a Play Store release or a production-data upgrade. Phase 6 has not started.

- Vercel project: `communication-coach-test-api` (`prj_3z5Lh2bWudlu3aPtmHaSRs4YMiBf`), under the existing owner team.
- API: https://communication-coach-test-api-luckykiran2024s-projects.vercel.app/api
- Database: separate `coach_apk_test` schema in the existing Supabase project; all 17 migrations applied only to this new schema.
- Runtime database login: a new restricted role with DML access only to test tables, no superuser/create-role/create-database privileges, and no accessible public application tables. `anon` and `authenticated` cannot use the test schema. The runtime cannot access its migration-history table.
- The existing `public` application tables and the separate `coach_verification` integration-test schema were not migrated or repurposed.
- Database passwords remain in ignored local files and Vercel Sensitive environment variables; they are not in Git or the APK.

## Available for testing

Email/password registration and login, onboarding/profile persistence, all three workshops, scenario selection, text response and independent retry, practice completion, saved sessions, progress, account export/deletion, local theme settings, and the native microphone/playback checks.

Native microphone, speech accent, appearance, interruption and accessibility still require actual phone testing. Passing backend HTTP checks does not verify these device features.

The catalog includes two lifetime free sessions and the requested paid prices/allocations: Essential ₹299/15 monthly sessions, Professional ₹399/20, Executive ₹699/40, Extended ₹799/60. Voice sessions are capped at seven minutes in the server contract.

## Deliberate test limitations

- The test backend grants Executive workshop access to test accounts so all three workshops can be explored. Changing the profile's plan selection does not purchase a subscription or change this server-side test grant. This APK is not evidence of a working paid-plan purchase/upgrade flow.
- AI live coaching is disabled: no provider API key is configured. Text practice and local audio checks remain available; no fake AI feedback or voice assessment is supplied.
- Email verification/reset delivery is disabled: no email provider is configured. These endpoints report HTTP 503 rather than pretending an email was sent.
- Google/Microsoft sign-in and store billing are disabled until their real credentials are configured. No paid calls or purchases were made.
- Progress reflects saved/completed practice; it is not a validated AI communication score.
- Existing accounts from the old backend are not copied. Create a separate test account in this build. Do not enter sensitive customer information.

## Build and update isolation

EAS build `77c4fe50-c92a-43d9-9812-0e40f8a35e4e` uses the `test-preview` profile/channel, the isolated API, a bundled JavaScript application, and internal APK distribution. It does not require Expo Go or a local Metro server. The application identifier is `com.example.communicationcoach.preview`, currently the same as earlier preview builds, so installing it may replace the old preview app. Do not uninstall an existing app merely to resolve a signing conflict without first confirming its data can be removed.

The `test-preview` update channel is separate from the existing GitHub `preview` OTA workflow. Pushing to main must not silently publish incompatible updates or trigger migrations against the old production backend. Production deployment and source push remain a separate release decision.

The test-only entry point refuses any project, database role/schema, TLS configuration or Node environment other than its pinned test configuration. Production startup validation was not relaxed. `npm run build:test-vercel -w @coach/api` prepares the ignored function bundles; `apps/api/vercel.test.json` records the tested deployment configuration, with no automatic database migrations. Verify the linked test project/team before any future deployment. Include the generated API bundles in the deployment upload so Vercel can discover the functions before its build starts; keep those bundles out of Git.

## Verification

- Typecheck: passed across the workspaces.
- Automated suite: 78/78 passed, including the isolated-backend guard test.
- Regression suite: 56/56 passed.
- PostgreSQL integration: 2/2 passed against `coach_verification`, not the APK schema.
- Hosted API smoke flow: 30 expected HTTP responses passed, including registration, login, profile, monthly usage, all three workshop recommendations, ownership isolation, save/retry/complete, progress, export, logout, missing-provider fail-closed responses and cleanup. Both temporary smoke accounts were deleted.
- Initial smoke failure: the test payload omitted the required `role: "user"` field; the API correctly rejected it with 400. The test was corrected without changing the API contract, then passed.
- Initial deployment failure: generated function bundles were absent from the deployment upload, so Vercel rejected unmatched function patterns. Uploading the locally generated test bundles resolved discovery; the server build regenerated them successfully.
- EAS Android compilation: FINISHED successfully. Downloaded APK ZIP/CRC integrity passed. Inspection found the isolated API hostname in the actual embedded JavaScript bundle and `test-preview` in the Android Expo Updates channel metadata. Package `com.example.communicationcoach.preview`, version `0.1.0` / code `1`, minimum Android SDK 24 and target SDK 36 were verified with `aapt`.
- Phone installation: `adb install -r` returned `Success` on the authorized Samsung Android phone, preserving existing app data. Launch returned `Status: ok`, `LaunchState: COLD`, and the app's activity became top-resumed. The app retained a running process; the sampled startup log contained zero fatal/React Native startup error matches. The Settings screen rendered on the phone and was captured locally as `artifacts/android-test-launch.png`.
- After launch, the isolated schema contained one account/profile and test-backend runtime logs showed registration, profile, home/catalog, monthly-usage and progress requests. This is user-driven phone activity, not an additional automated native sign-in test. That account was not deleted or inspected. The temporary automated smoke accounts had already been cleaned up.
- Native microphone/playback, Indian-English voice availability, theme switching, interruption, accessibility and real AI/email/purchase flows remain unverified. Successful compilation/launch is not a complete native acceptance sign-off.

## Downloaded artifact

- APK: https://expo.dev/artifacts/eas/xEvZkDUIiY7RJZXpOutovpzNEMS4V3_-AP0_7PJ7D_k.apk
- Local copy: `artifacts/communication-coach-test-77c4fe50.apk` (150,227,179 bytes).
- SHA-256: `BFBD981723CBC8EE0CCE34C3C7B43256CFB0C4E7B4C050F0EE6FBAE2E3D1A9E1`.
- Source/test-backend configuration was committed locally as `fc3ff34`; GitHub main was not pushed, and the existing production API/database were not upgraded.

Build page: https://expo.dev/accounts/luckysoma/projects/communication-platform/builds/77c4fe50-c92a-43d9-9812-0e40f8a35e4e
