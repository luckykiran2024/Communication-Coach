import { useEffect, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { brand } from "@coach/core";
import { useAuth } from "../src/auth";
import { request, type Catalog } from "../src/api";
import { StorePurchaseActions } from "../src/store-purchase";
import { Action, Card, Copy, Heading, Icon, Screen, useTheme } from "../src/ui";

const planProficiency: Record<string, { level: string; summary: string; outcomes: string[] }> = {
  essential: { level: "Foundation proficiency", summary: "Build confidence in everyday workplace conversations.", outcomes: ["Start and sustain clear conversations", "Explain your work in a simple structure", "Practise daily communication habits"] },
  professional: { level: "Professional proficiency", summary: "Communicate clearly across routine work and business situations.", outcomes: ["Explain recommendations with context and evidence", "Handle questions and align people on next steps", "Practise daily communication plus management conversations"] },
  executive: { level: "Executive proficiency", summary: "Lead high-stakes conversations and communicate with influence.", outcomes: ["Shape concise messages for senior audiences", "Handle challenging questions with composure", "Practise daily, management, and leadership communication"] },
  extended: { level: "Executive proficiency · extended practice", summary: "Build the same leadership range with more monthly practice.", outcomes: ["Use the full executive communication pathway", "Repeat scenarios for stronger fluency and consistency", "Access 60 focused voice sessions each month"] },
};

export default function Payment() {
  const auth = useAuth();
  const theme = useTheme();
  const params = useLocalSearchParams<{ planId?: string }>();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const planId = params.planId ?? auth.me?.profile?.planId ?? "free";
  const previewPayment = process.env.EXPO_PUBLIC_PAYMENT_PREVIEW === "true" || (__DEV__ && process.env.EXPO_PUBLIC_PAYMENT_PREVIEW !== "false");
  async function loadPlans() {
    try { setCatalog(await request<Catalog>("/v1/catalog")); } catch (failure) { setError((failure as Error).message); }
  }
  useEffect(() => { if (auth.token) void loadPlans(); }, [auth.token]);
  if (auth.loading) return <Screen><Copy>Loading your plan…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const plan = (catalog?.plans ?? []).find(item => item.id === planId);
  const proficiency = planProficiency[planId] ?? planProficiency.professional;
  if (confirmed) return <Screen><Card tone="accent"><Icon name="spark" size={32} color={theme.accent} /><Heading eyebrow={brand.name}>Let’s start.</Heading><Copy>Your plan confirmation is complete for this development preview. Your practice space is ready.</Copy><Action title="Start today’s practice" onPress={() => router.replace("/home")} /></Card></Screen>;
  return <Screen><Heading eyebrow="One clear next step">Confirm your practice package.</Heading><Copy>Review your selected package before payment. The app will not start practice until payment is confirmed.</Copy>
    <Card tone="accent"><Heading eyebrow="Selected package">{plan?.title ?? planId}</Heading><Heading eyebrow={proficiency.level}>{proficiency.summary}</Heading><Copy>{plan ? `${plan.targetPriceInr === 0 ? "Free" : `₹${plan.targetPriceInr} / month`} · ${plan.voiceSessionsPerMonth} sessions ${plan.id === "free" ? "lifetime" : "per month"} · up to 7 minutes each` : "Loading package details…"}</Copy>{proficiency.outcomes.map(outcome => <Copy key={outcome}>• {outcome}</Copy>)}<Copy>Payment is not processed in this development preview.</Copy></Card>
    <Card><Heading eyebrow="What proficiency means">A guided communication range, not a test score.</Heading><Copy>Your package determines the situations and practice depth available to you. You can change packages later from Settings; your progress and profile remain yours.</Copy></Card>
    {previewPayment ? <Action title="Simulate payment confirmation" onPress={() => setConfirmed(true)} /> : Platform.OS === "web" ? <Action title="Mobile store payment only" disabled onPress={() => undefined} /> : <StorePurchaseActions token={auth.token} productId={process.env.EXPO_PUBLIC_STORE_PRODUCT_PREFIX ? `${process.env.EXPO_PUBLIC_STORE_PRODUCT_PREFIX}.${planId}.monthly` : `com.communicationcoach.${planId}.monthly`} onComplete={() => setConfirmed(true)} onError={setError} />}
    <Copy>{previewPayment ? "Development-only preview: no money moves and no entitlement is granted." : "A production payment provider must be configured before this step can be completed."}</Copy>
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Retry package load" secondary onPress={() => void loadPlans()} /></>}
    <Action title="Back to profile setup" secondary onPress={() => router.back()} />
  </Screen>;
}
