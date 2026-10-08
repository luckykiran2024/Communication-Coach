# Voice POC: implemented boundary and test plan

## Current implementation

Mobile /voice makes an authenticated request to /v1/voice/readiness. This verifies application-server reachability only.
It requests native microphone permission after explicit local-recording consent, records for up to 60 seconds, allows playback and deletion, and stops on backgrounding.
No bytes leave the device. It does not transcribe, assess, synthesize speech or connect to an AI provider.
The API also exposes authenticated `/v1/voice/capabilities?platform=web|android|ios`, which reports the client boundary and will only report readiness when the native module, development build, and provider configuration are all present. The mobile client passes its runtime platform so native builds are reported as `DEV_CLIENT_REQUIRED` rather than incorrectly appearing to be web previews. Provider sessions are persisted and can be stopped through an owner-scoped API route that settles consumed seconds.
Mobile scenario cards can create an authenticated `CREATED` conversation record before practice. Android/iOS development builds now include `react-native-webrtc`; the practice screen can exchange a server-issued ephemeral key for a Realtime WebRTC call and settle the authenticated voice session on stop. The path remains gated from Expo Go and has not passed physical-device QA.

## Official documentation checked on 2026-09-24

- Expo SDK compatibility: https://docs.expo.dev/versions/latest/
- Expo Audio recording/playback: https://docs.expo.dev/versions/latest/sdk/audio/
- Expo Router installation: https://docs.expo.dev/router/installation/
- Native WebRTC lifecycle: https://react-native-webrtc.github.io/handbook/guides/basic-usage.html
- Provider WebRTC guide: https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime

Expo Audio supports native recording/playback; it is not a realtime duplex AI transport.
A browser WebRTC example does not prove compatibility with Expo development builds.
Do not enable external billing based on documentation alone.

The React Native WebRTC guidance confirms that its native module is unavailable in Expo Go and requires an Expo development build plus a config plugin. The installed plugin accepts Expo 56+ and the app now includes it for Expo SDK 57; compatibility still needs verification in a development build on real Android and iOS hardware. The provider guidance uses server-created ephemeral client secrets while keeping the standard API key on the trusted server. The returned WebRTC call identifier is now bound to the authenticated voice session for server-side hangup.

## Required next POC

Build the native development client on Android and iOS and verify config plugin/new-architecture compatibility with the pinned Expo SDK. Then exercise the authenticated backend authorization and provider call lifecycle. Keep provider credentials server-side; short-lived client credentials alone do not enforce duration.

Test permission denied, silence/thinking pauses, AI interruption, user barge-in, Bluetooth change, incoming call, backgrounding, network loss, server timeout and forced termination. Assert recording retention stays off by default.
The server must still end billable sessions even if the client is disconnected or malicious; explicit stop and expiry recovery now settle the reservation, failed provider hangups remain retryable, and authenticated Realtime input/output transcripts are persisted against the conversation.

## Accounts and authorization

A provider account and API credentials stored in a local/server secret manager are needed for the live test. ChatGPT Plus development access is not runtime API credit. Paid API tests require the founder's explicit approval. Device and EAS/store accounts may also be needed; no paid actions were taken in this increment.

## Provider adapter progress

The API now contains a tested server-only Realtime client-secret adapter in `apps/api/src/realtime-provider.ts` and a feature-flagged `RealtimeVoiceProvider` in `apps/api/src/realtime-voice-provider.ts`. The provider path uses the existing reservation/state machine and returns only a short-lived client secret to an authenticated session request; the standard API key stays server-side. The mobile development build now contains the WebRTC offer/answer client, persists provider transcript events and binds the provider call ID for server-side hangup, but physical-device QA, provider-backed assessment and explicit provider-cost approval are still required before production enablement.
