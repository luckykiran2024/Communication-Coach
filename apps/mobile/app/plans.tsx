import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { Platform, View } from "react-native";
import Constants from "expo-constants";
import { deepLinkToSubscriptions } from "expo-iap";
import { request, type Catalog, type Recommendations, type VoiceUsage } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Heading, Icon, Screen, useTheme } from "../src/ui";
export default function Plans() {
  const auth = useAuth();
  const theme = useTheme();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [usage, setUsage] = useState<VoiceUsage | null>(null); const [recommendations, setRecommendations] = useState<Recommendations | null>(null); const [error, setError] = useState("");
  async function load() { try { const [currentCatalog, currentUsage, currentRecommendations] = await Promise.all([request<Catalog>("/v1/catalog"), request<VoiceUsage>("/v1/me/voice-usage", auth.token), request<Recommendations>("/v1/me/scenarios", auth.token)]); setCatalog(currentCatalog); setUsage(currentUsage); setRecommendations(currentRecommendations); setError(""); } catch (failure) { setError((failure as Error).message); } }
  useEffect(() => { void load(); }, []);
  if (auth.loading) return <Screen><Copy>Loading plans…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const currentPlanId = usage?.planId ?? auth.me.profile.planId;
  const activeExerciseCount = recommendations?.scenarios.length ?? 0;
  async function manageCurrentSubscription() {
    setError("");
    try {
      const packageName = Constants.expoConfig?.android?.package;
      if (Platform.OS === "android" && !packageName) throw new Error("The Android application identifier is unavailable.");
      await deepLinkToSubscriptions(Platform.OS === "android" ? { packageNameAndroid: packageName } : {});
    } catch (failure) { setError((failure as Error).message); }
  }
  return <Screen><Heading eyebrow="Practice plans">Choose your practice space.</Heading><Copy>Your active plan is {catalog?.plans.find(plan => plan.id === currentPlanId)?.title ?? currentPlanId}. Each voice session lasts up to {Math.floor((usage?.maxSessionSeconds ?? 420) / 60)} minutes; your profile’s shorter practice preference still applies.</Copy><Copy>Package changes are scheduled for your next renewal date. Your active package cannot change in the middle of its billing month.</Copy><Copy>{usage?.lifetimeFreeLimit ? `${usage.sessionsRemaining} of ${usage.sessionsAllowed} free voice sessions remain (lifetime).` : `${usage?.sessionsRemaining ?? "—"} of ${usage?.sessionsAllowed ?? "—"} voice sessions remain this month.`}</Copy><Copy>{activeExerciseCount} active exercises are available across {usage?.modules.length ?? 0} included workshop{usage?.modules.length === 1 ? "" : "s"}.</Copy>
    <Card tone="accent"><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="clock" size={26} color={theme.ink} /><View style={{ flex: 1 }}><Heading eyebrow="The format">Up to seven focused minutes</Heading><Copy>Use your sessions when they suit you. No daily schedule is required.</Copy></View></View></Card>
    {!catalog && !error && <Copy>Loading plans…</Copy>}
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Retry" onPress={load} /></>}
    {catalog?.plans.map(plan => { const selected = currentPlanId === plan.id; const freeDowngrade = plan.id === "free" && !selected; return <Card key={plan.id}><Heading eyebrow={selected ? `${plan.title} · active plan` : plan.title}>{plan.targetPriceInr === 0 ? "Free" : `₹${plan.targetPriceInr} / month`}</Heading><Copy>{plan.voiceSessionsPerMonth} voice sessions per {plan.id === "free" ? "lifetime" : "month"} · up to {Math.floor(plan.maxSessionSeconds / 60)} minutes each.</Copy><Copy>Includes: {plan.modules.map(moduleId => moduleId === "management" ? "Professional & Business Communication" : moduleId === "leadership" ? "Leadership" : "Daily Communication").join(" · ")}</Copy>{freeDowngrade && <Copy>Cancel the paid subscription in your store. Free access begins after the paid billing period ends.</Copy>}<Action title={selected ? "Active plan" : freeDowngrade ? "Cancel paid plan in store" : "Review package"} secondary={selected || freeDowngrade} disabled={selected} onPress={() => freeDowngrade ? void manageCurrentSubscription() : router.push({ pathname: "/payment", params: { planId: plan.id } })} /></Card>; })}
    <Copy>Plan access is controlled by your verified store subscription. In development, the server’s DEV_PLAN_ID selects the active plan; profile selection alone does not change entitlements.</Copy>
    <Copy>{catalog?.priceNotice ?? "Actual storefront pricing will be configured before release."}</Copy>
  </Screen>;
}
