import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { Redirect, router } from "expo-router";
import { careerLevels, functions, goals, planIds, practiceTimezones, profileSchema, type Profile } from "@coach/core";
import { request } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Choices, Copy, Field, Heading, Screen, usePreferences } from "../src/ui";
export default function Onboarding() {
  const auth = useAuth();
  const { setReducedMotion } = usePreferences();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(auth.me?.profile ?? {
    displayName: "", primaryLanguage: "English", coachingLanguage: "English", function: "Engineering", jobTitle: "", careerLevel: "Experienced individual contributor", industry: "", audience: "", situations: "", goal: "Explain ideas clearly", challenges: "", practiceMinutes: 10, planId: "professional", timezone: "Asia/Kolkata", reducedMotion: false,
  });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (auth.me?.profile) setReducedMotion(auth.me.profile.reducedMotion); }, [auth.me?.profile?.reducedMotion]);
  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  function change<Key extends keyof Profile>(key: Key, value: Profile[Key]) { setDraft(current => ({ ...current, [key]: value })); }
  async function save() {
    const checked = profileSchema.safeParse(draft);
    if (!checked.success) { setError(checked.error.issues.map(issue => issue.path.join(".") + ": " + issue.message).join("\n")); return; }
    setBusy(true); setError("");
    try { await request("/v1/me/profile", auth.token, "PUT", checked.data); await auth.refresh(); router.replace(auth.me?.profile ? "/home" : "/payment"); }
    catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  function nextStep() {
    if (step === 0 && (!draft.displayName.trim() || !draft.jobTitle.trim())) { setError("Add your preferred name and job title before continuing."); return; }
    if (step === 1 && !draft.audience.trim()) { setError("Tell us who you usually speak with so scenarios can feel relevant."); return; }
    setError(""); setStep(step + 1);
  }
  return <Screen><Heading eyebrow={"Your context · " + (step + 1) + " of 3"}>{["Tell us about your work.", "What would you like to change?", "Practice on your terms."][step]}</Heading>
    <Copy>Your role shapes the situations you practise. It does not determine your communication ability.</Copy>
    {step === 0 && <><Field label="Preferred name" value={draft.displayName} onChangeText={value => change("displayName", value)} />
      <Choices label="Professional function" options={functions} value={draft.function} onChange={value => change("function", value as Profile["function"])} />
      <Field label="Job title" value={draft.jobTitle} onChangeText={value => change("jobTitle", value)} />
      <Choices label="Career level" options={careerLevels} value={draft.careerLevel} onChange={value => change("careerLevel", value as Profile["careerLevel"])} />
      <Field label="Industry (optional)" value={draft.industry} onChangeText={value => change("industry", value)} />
    </>}
    {step === 1 && <><Field label="Who do you usually speak with?" placeholder="Colleagues, customers, leadership…" value={draft.audience} onChangeText={value => change("audience", value)} />
      <Choices label="Your first communication goal" options={goals} value={draft.goal} onChange={value => change("goal", value as Profile["goal"])} />
      <Field label="Common situations (optional)" value={draft.situations} onChangeText={value => change("situations", value)} />
      <Field label="What feels difficult? (optional)" multiline value={draft.challenges} onChangeText={value => change("challenges", value)} />
      <Copy>These are your self-reported experiences, not assessed learning needs.</Copy></>}
    {step === 2 && <><Field label="Primary language" value={draft.primaryLanguage} onChangeText={value => change("primaryLanguage", value)} />
      <Copy>Coaching language: English. More languages are planned.</Copy>
      <Choices label="Preferred practice length" options={["5", "10", "15", "20"]} value={String(draft.practiceMinutes)} onChange={value => change("practiceMinutes", Number(value))} />
      <Copy>5 minutes is a quick warm-up, 10 minutes is a balanced daily habit, 15 minutes allows deeper repetition, and 20 minutes is an extended session. This sets your preferred pace; live voice limits are enforced separately when enabled.</Copy>
      {!auth.me?.profile ? <Choices label="Practice timezone" options={practiceTimezones} value={draft.timezone} onChange={value => change("timezone", value)} /> : <><Field label="Practice timezone" editable={false} value={draft.timezone} /><Copy>Your timezone is locked after setup so daily practice allowances reset consistently. Contact support to change it.</Copy></>}
      <Copy>Your practice timezone controls when your daily allowance resets. It does not track your location or change your device clock.</Copy>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Copy>Reduce motion</Copy><Switch accessibilityLabel="Reduce motion" value={draft.reducedMotion} onValueChange={value => { change("reducedMotion", value); setReducedMotion(value); }} /></View><Copy>When enabled, the app avoids nonessential movement and transitions, keeping controls visually stable. It does not affect audio or recording.</Copy>
      <Choices label="Choose your practice plan" options={["Essential", "Professional", "Executive", "Extended Practice"]} value={checkedPlanLabel(draft.planId)} onChange={value => change("planId", planIds[["Essential", "Professional", "Executive", "Extended Practice"].indexOf(value)] as Profile["planId"])} />
      <Copy>We’ll confirm this package next and show the payment step before your first practice begins.</Copy>
      <Copy>Microphone access is requested only when you start an audio check. Optional recordings are not uploaded or retained by the server.</Copy></>}
    {Boolean(error) && <Copy error>{error}</Copy>}
    {step < 2 ? <Action title="Continue" onPress={nextStep} /> : <Action title="Save my profile" onPress={save} busy={busy} />}
    {step > 0 && <Action title="Back" secondary onPress={() => setStep(step - 1)} />}
  </Screen>;
}
function checkedPlanLabel(planId: Profile["planId"]) { return ({ essential: "Essential", professional: "Professional", executive: "Executive", extended: "Extended Practice" } as const)[planId]; }
