import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { request, type Catalog } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Heading, Icon, Screen, useTheme } from "../src/ui";
export default function Plans() {
  const auth = useAuth();
  const theme = useTheme();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [usage, setUsage] = useState<{ planId: string; sessionsRemaining: number; lifetimeFreeLimit: boolean } | null>(null); const [error, setError] = useState("");
  async function load() { try { const [currentCatalog, currentUsage] = await Promise.all([request<Catalog>("/v1/catalog"), request<{ planId: string; sessionsRemaining: number; lifetimeFreeLimit: boolean }>("/v1/me/voice-usage", auth.token)]); setCatalog(currentCatalog); setUsage(currentUsage); setError(""); } catch (failure) { setError((failure as Error).message); } }
  useEffect(() => { void load(); }, []);
  if (auth.loading) return <Screen><Copy>Loading plans…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const currentPlanId = usage?.planId ?? auth.me.profile.planId;
  return <Screen><Heading eyebrow="Practice plans">Choose your practice space.</Heading><Copy>Your active plan is {catalog?.plans.find(plan => plan.id === currentPlanId)?.title ?? currentPlanId}. Each voice session lasts up to 7 minutes; your profile’s shorter practice preference still applies.</Copy><Copy>{usage?.lifetimeFreeLimit ? `${usage.sessionsRemaining} free voice sessions remain (lifetime).` : `${usage?.sessionsRemaining ?? "—"} voice sessions remain this month.`}</Copy>
    <Card tone="accent"><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="clock" size={26} color={theme.ink} /><View style={{ flex: 1 }}><Heading eyebrow="The habit">Seven focused minutes</Heading><Copy>Short, deliberate conversations build clearer communication.</Copy></View></View></Card>
    {!catalog && !error && <Copy>Loading plans…</Copy>}
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Retry" onPress={load} /></>}
    {catalog?.plans.map(plan => { const selected = currentPlanId === plan.id; return <Card key={plan.id}><Heading eyebrow={selected ? `${plan.title} · active plan` : plan.title}>{plan.targetPriceInr === 0 ? "Free" : `₹${plan.targetPriceInr} / month`}</Heading><Copy>{plan.voiceSessionsPerMonth} voice sessions per {plan.id === "free" ? "lifetime" : "month"} · up to {Math.floor(plan.maxSessionSeconds / 60)} minutes each.</Copy><Copy>Includes: {plan.modules.map(moduleId => moduleId === "management" ? "Professional & Business Communication" : moduleId === "leadership" ? "Leadership" : "Daily Communication").join(" · ")}</Copy><Action title={selected ? "Active plan" : plan.id === "free" ? "Free access" : "Review package"} secondary={selected} disabled={selected || plan.id === "free"} onPress={() => router.push({ pathname: "/payment", params: { planId: plan.id } })} /></Card>; })}
    <Copy>Plan access is controlled by your verified store subscription. In development, the server’s DEV_PLAN_ID selects the active plan; profile selection alone does not change entitlements.</Copy>
    <Copy>{catalog?.priceNotice ?? "Actual storefront pricing will be configured before release."}</Copy>
  </Screen>;
}
