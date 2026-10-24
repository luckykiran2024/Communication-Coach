import { Linking } from "react-native";
import { router } from "expo-router";
import { legalVersion } from "@coach/core";
import { Action, Card, Copy, Heading, Screen } from "../src/ui";

const privacyEmail = process.env.EXPO_PUBLIC_PRIVACY_EMAIL;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL;

export default function Legal() {
  return <Screen>
    <Heading eyebrow={`C2Coach · India · effective ${legalVersion}`}>Terms of Service & Privacy Policy</Heading>
    <Copy>Please read these documents before creating an account. Creating an account requires your agreement to the Terms of Service and acknowledgement of the Privacy Policy. Returning users do not need to accept them again at sign-in.</Copy>

    <Card>
      <Heading eyebrow="Terms of Service">Using C2Coach</Heading>
      <Copy>C2Coach operates from India and provides educational communication practice. Exercises, scores, and AI-generated feedback are learning aids, not legal, medical, employment, financial, or other professional advice. You decide what to say or do in real situations.</Copy>
      <Copy>Use an account you control, keep your sign-in credentials secure, and provide accurate registration details. Do not impersonate others, misuse the service, harass anyone, or submit material you lack permission to share.</Copy>
      <Copy>Do not enter confidential employer or client information, passwords, payment details, or sensitive personal information into practice prompts. You retain responsibility for your responses; C2Coach may process them to provide practice, feedback, progress, and support.</Copy>
      <Copy>Some features may be unavailable during testing. If paid plans are offered, the applicable app store will show the price, renewal period, and cancellation terms before purchase. Manage or cancel a store subscription in that store; deleting the app does not cancel it.</Copy>
      <Copy>You can stop using the service and request account deletion in Settings. C2Coach may restrict access for misuse, security risks, or service changes. We may update these terms; a material change to the account-creation terms will require a new version and a separate review before release.</Copy>
    </Card>

    <Card>
      <Heading eyebrow="Privacy Policy">How your information is used</Heading>
      <Copy>C2Coach processes your email and sign-in identity, practice profile, written responses, exercise history, progress, session records, and—when a paid plan is available—store purchase identifiers. These records operate the account, tailor practice, measure progress, protect the service, and provide support.</Copy>
      <Copy>Google sign-in uses Google and Supabase Authentication. The app backend and account data use Vercel and Supabase. If you use AI assessment or live voice when enabled, the relevant practice text, transcript, or audio is sent to the configured AI provider to produce coaching. Store purchases are processed by Google Play or Apple; C2Coach does not receive your full card details.</Copy>
      <Copy>The microphone check records only on your device for playback and is not uploaded. Live voice practice, when enabled, is a separate feature that may transmit audio and transcripts. Avoid sharing third-party or workplace secrets in either mode.</Copy>
      <Copy>We keep account and practice data while your account is active, then delete application records when you use the account-deletion action, subject to records we must retain for security, transactions, or law. Google/Supabase authentication records require separate deletion handling; that process must be verified before public release.</Copy>
      <Copy>We do not sell your practice responses for advertising. You can request an account export, sign out, or delete your account in Settings. The app may use service logs to diagnose failures and prevent abuse.</Copy>
      {privacyEmail ? <Copy>Privacy and support contact: {privacyEmail}.</Copy>
        : <Copy>Privacy and support contact is not configured in this test build; public release remains blocked until one is published.</Copy>}
      {privacyUrl && <Action title="Open published Privacy Policy" secondary onPress={() => void Linking.openURL(privacyUrl)} />}
    </Card>

    <Action title="Back" secondary onPress={() => router.back()} />
  </Screen>;
}
