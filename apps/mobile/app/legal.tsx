import { Linking } from "react-native";
import { router } from "expo-router";
import { brand } from "@coach/core";
import { Action, Card, Copy, Heading, Screen } from "../src/ui";

const privacyContact = process.env.EXPO_PUBLIC_PRIVACY_EMAIL ?? "Add a privacy contact before public release";

export default function Legal() {
  return <Screen>
    <Heading eyebrow="About this app">{brand.name}</Heading>
    <Copy>Created by Lucky Kiran. This development preview provides communication practice and learning prompts; it is not professional, legal, medical, or employment advice.</Copy>

    <Card tone="accent">
      <Heading eyebrow="Before public release">Legal draft placeholders</Heading>
      <Copy>These summaries are temporary product placeholders, not final legal terms. Replace them with reviewed Terms of Service and a Privacy Policy, including your organisation’s registered details, contact address, retention periods, subprocessors, and jurisdiction before publishing.</Copy>
    </Card>

    <Card>
      <Heading eyebrow="Terms of service · draft">Using the practice preview</Heading>
      <Copy>Use an account you control and provide accurate profile information. You are responsible for reviewing your practice responses before using them in real workplace conversations. Do not enter confidential, personal, or sensitive information into practice exercises.</Copy>
      <Copy>Practice plans and displayed prices are illustrative in this preview. No payment is taken here. Features may change while the product is being tested.</Copy>
      <Copy>Do not use the app to harass, impersonate, or unlawfully monitor another person. You may sign out or request account deletion from Settings. A final version must explain how requests are handled and how long data is retained.</Copy>
    </Card>

    <Card>
      <Heading eyebrow="Privacy notice · draft">Your data and recordings</Heading>
      <Copy>The service stores account details, your practice profile, written practice responses, and progress needed to operate the preview. Do not submit confidential employer or client information.</Copy>
      <Copy>Microphone checks are local recordings in this preview. Live AI voice is not available until the provider and native transport are configured. If enabled later, the final privacy notice must clearly explain audio processing, recipients, retention, and controls before recording begins.</Copy>
      <Copy>Privacy contact: {privacyContact}.</Copy>
    </Card>

    <Card>
      <Heading eyebrow="Product owner">Lucky Kiran</Heading>
      <Copy>Developer attribution is shown here as requested. Add the verified support and privacy contact details before release.</Copy>
      {process.env.EXPO_PUBLIC_PRIVACY_URL ? <Action title="Open privacy policy" secondary onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL as string)} /> : <Copy>Public privacy policy URL: to be added before store submission.</Copy>}
    </Card>

    <Action title="Back" secondary onPress={() => router.back()} />
  </Screen>;
}
