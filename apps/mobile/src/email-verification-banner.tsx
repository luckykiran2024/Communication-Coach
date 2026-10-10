import { router } from "expo-router";
import { useAuth } from "./auth";
import { Action, Card, Copy, Heading } from "./ui";

export function EmailVerificationBanner() {
  const { me } = useAuth();
  if (!me || me.user.emailVerifiedAt) return null;
  return (
    <Card>
      <Heading eyebrow="Account security">Confirm your email.</Heading>
      <Copy>Verify your address to safely link sign-in providers and recover your account.</Copy>
      <Action title="Verify my email" secondary onPress={() => router.push("/verify-email")} />
    </Card>
  );
}
