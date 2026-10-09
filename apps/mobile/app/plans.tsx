import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import type { Plan } from "@coach/core";
import { View } from "react-native";
import { request, type Catalog } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Heading, Icon, Screen, useTheme } from "../src/ui";
export default function Plans() {
  const auth = useAuth();
  const theme = useTheme();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState(""); const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  async function load() { try { setCatalog(await request<Catalog>("/v1/catalog")); setError(""); } catch (failure) { setError((failure as Error).message); } }
  useEffect(() => { void load(); }, []);
  if (auth.loading) return <Screen><Copy>Loading plans…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const profile = auth.me.profile;
  const currentPlanId = savedPlanId ?? profile.planId;
  async function selectPlan(plan: Plan) {
    setBusy(plan.id); setError(""); setMessage("");
    try { const result = await request<{ profile: typeof profile }>("/v1/me/profile", auth.token, "PUT", { ...profile, planId: plan.id }); setSavedPlanId(result.profile.planId); await auth.refresh(); setMessage(`${plan.title} is saved as your selected practice plan.`); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(null); }
  }
  return <Screen><Heading eyebrow="Practice 20 minutes a day">Choose space to practise.</Heading><Copy>Your current plan is {catalog?.plans.find(plan => plan.id === currentPlanId)?.title ?? currentPlanId}. Select another plan to save the change to your profile. Store billing is not enabled in this preview.</Copy><Copy>One 20-minute practice day equals 600 minutes across a 30-day month. Choose a plan to shape your available practice space.</Copy>
    <Card tone="accent"><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="clock" size={26} color={theme.ink} /><View style={{ flex: 1 }}><Heading eyebrow="The habit">20 minutes a day</Heading><Copy>Small, repeatable conversations build clearer communication.</Copy></View></View></Card>
    {!catalog && !error && <Copy>Loading plans…</Copy>}
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Retry" onPress={load} /></>}
    {catalog?.plans.map(plan => { const monthlyMinutes = plan.dailySeconds / 60 * 30; const twentyMinuteEquivalent = plan.targetPriceInr / (monthlyMinutes / 20); const selected = currentPlanId === plan.id; return <Card key={plan.id}><Heading eyebrow={selected ? `${plan.title} · current plan` : plan.title}>₹{plan.targetPriceInr} / month</Heading><Copy>{plan.dailySeconds / 60} voice minutes per day · {monthlyMinutes} minutes in a 30-day month.</Copy><Copy>20-minute practice equivalent: ₹{twentyMinuteEquivalent.toFixed(2)}.</Copy><Copy>Includes: {plan.modules.map(moduleId => moduleId === "management" ? "Professional & Business Communication" : moduleId === "leadership" ? "Leadership" : "Daily Communication").join(" · ")}</Copy><Action title={selected ? "Current plan" : "Select this plan"} secondary={selected} disabled={selected} busy={busy === plan.id} onPress={() => void selectPlan(plan)} /></Card>; })}
    {Boolean(message) && <Copy>{message}</Copy>}
    <Copy>{catalog?.priceNotice ?? "Actual storefront pricing will be configured before release."}</Copy>
  </Screen>;
}
