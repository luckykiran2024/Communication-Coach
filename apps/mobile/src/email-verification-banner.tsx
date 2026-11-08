import { router } from "expo-router";
import { useEffect, useState } from "react";
import { request } from "./api";
import { useAuth } from "./auth";
import { Action, Card, Copy, Heading } from "./ui";

export function EmailVerificationBanner() {
  const { me } = useAuth();
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    request<{ capabilities?: { accountEmail?: boolean } }>("/ready")
      .then(result => { if (active) setDeliveryAvailable(result.capabilities?.accountEmail ?? null); })
      .catch(() => { if (active) setDeliveryAvailable(null); });
    return () => { active = false; };
  }, []);
  if (!me || me.user.emailVerifiedAt) return null;
  return (
    <Card>
      <Heading eyebrow="Account security">Confirm your email.</Heading>
      <Copy>{deliveryAvailable === false
        ? "Verification email delivery is not enabled on this server yet. Your account remains signed in; try again after the sender is configured."
        : "Verify your address to safely link sign-in providers and recover your account."}</Copy>
      {deliveryAvailable !== false && <Action title="Verify my email" secondary onPress={() => router.push("/verify-email")} />}
    </Card>
  );
}
