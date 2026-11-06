# Android device preview

The `preview` EAS profile creates a standalone APK, version 0.2.0, using `com.c2coach.app.preview`. It uses the isolated staging API and Supabase project and installs separately from the production app. Build numbers increment remotely. The staging API is reachable without a Vercel browser session; application authentication, ownership checks and rate limits remain enabled. No deployment bypass key is embedded in the app.

Expo Go cannot run the full app because its WebRTC and store-purchase modules require a custom native binary. Install the EAS preview APK instead. The preview channel supports compatible Expo updates; SDK/native-module changes require another APK because runtime compatibility uses the native fingerprint.

Staging uses a separate account database. Create a new staging account using email/password and acknowledge the terms yourself. Production accounts and learning history are not copied. Google sign-in, email verification/recovery delivery, AI assessment, live AI voice and real subscriptions have not passed staging acceptance and must not be assumed available. Local microphone recording/playback, navigation, text practice and available account flows can be exercised in this preview. A microphone check stays on the phone.

Check fresh install/sign-up, onboarding, Home/library/practice/progress/settings, short local recording/playback, denied microphone permission, app background/relaunch, offline sign-out and recovery, and export. Use disposable staging accounts for deletion. Report the screen, steps, expected/actual result and app version. Do not include passwords, access tokens or private transcripts in screenshots.

This preview is for controlled testing and is not a production release or a Play Store submission. Minute-level scheduling, provider setup, signed-device acceptance, backup restoration and monitoring remain release requirements.
