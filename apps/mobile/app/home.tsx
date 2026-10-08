import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Redirect, router } from "expo-router";
import { brand, modules } from "@coach/core";
import { request, type ProgressSnapshot } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Heading, Icon, IconButton, ProgressBar, Screen, usePreferences, useTheme } from "../src/ui";
type RecentPractice = { conversation: { id: string; state: string; createdAt: string }; scenario: { title: string; module: "daily" | "management" | "leadership" } };
export default function Home() {
  const auth = useAuth(); const theme = useTheme(); const { avatarUri } = usePreferences(); const [usage, setUsage] = useState<{ remainingSeconds: number; allowanceSeconds: number; resetsAt: string } | null>(null); const [recent, setRecent] = useState<RecentPractice[]>([]); const [progress, setProgress] = useState<ProgressSnapshot | null>(null); const [error, setError] = useState("");
  async function load() { try { const [currentUsage, recentResponse, progressSnapshot] = await Promise.all([request<{ remainingSeconds: number; allowanceSeconds: number; resetsAt: string }>("/v1/me/voice-usage", auth.token), request<{ conversations: RecentPractice[] }>("/v1/me/conversations", auth.token), request<ProgressSnapshot>("/v1/me/progress", auth.token)]); setUsage(currentUsage); setRecent(recentResponse.conversations); setProgress(progressSnapshot); setError(""); } catch (failure) { setError((failure as Error).message); } }
  useEffect(() => { if (auth.me?.profile) void load(); }, [auth.token, auth.me?.profile]);
  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me) return <Screen><Copy error>{auth.error || "Profile unavailable."}</Copy><Action title="Retry connection" onPress={() => auth.refresh().catch(failure => setError(failure.message))} /><Copy error>{error}</Copy></Screen>;
  if (!auth.me.profile) return <Redirect href="/onboarding" />;
  const profile = auth.me.profile;
  return <Screen><View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>{avatarUri ? <Image accessibilityLabel="Your display picture" source={{ uri: avatarUri }} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: theme.border }} /> : <Icon name="person" size={30} color={theme.accent} />}<View style={{ flex: 1 }}><Heading eyebrow={brand.name}>A clearer message starts here, {profile.displayName}.</Heading></View><IconButton name="settings" label="Open settings" onPress={() => router.push("/settings")} /></View>
    <Card tone="accent"><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="spark" size={27} color={theme.ink} /><View style={{ flex: 1 }}><Heading eyebrow={`Level ${progress?.mastery.level ?? 1}`}>{progress?.mastery.title ?? "Getting started"}</Heading><Copy>Mastery grows through practice days, completed scenarios, independent retries, and saved-response evidence.</Copy></View></View><ProgressBar value={progress?.mastery.progressPercent ?? 0} color={theme.ink} /><Copy>{progress?.mastery.nextLevel ? `${progress.mastery.practiceDays} practice days · ${progress.mastery.successfulRetries} successful retries · next is Level ${progress.mastery.nextLevel}.` : "Top level reached. Keep your practice habit going."}</Copy><Action title="See my progress" secondary icon="progress" onPress={() => router.push("/progress")} /></Card>
    <Card><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="person" size={24} color={theme.accent} /><Heading eyebrow="Your chosen focus">{profile.goal}</Heading></View><Copy>{profile.practiceMinutes} minutes at your pace · {profile.function} · {profile.planId} plan</Copy><Action title="Check my microphone" icon="mic" onPress={() => router.push("/voice")} /><Copy>Live voice coaching is not connected yet. This check records and plays back your voice locally.</Copy></Card>
    {usage && <Card><Heading eyebrow="Today’s voice allowance">{Math.floor(usage.remainingSeconds / 60)} minutes remaining</Heading><Copy>{Math.floor(usage.allowanceSeconds / 60)} minutes configured per day. Resets around {new Date(usage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</Copy><Copy>Server reservations will protect this allowance when live coaching is enabled.</Copy></Card>}
    {recent.length > 0 && <><Heading eyebrow="Continue practice">Saved sessions</Heading>{recent.map(item => <Card key={item.conversation.id}><Heading eyebrow={modules.find(module => module.id === item.scenario.module)?.title}>{item.scenario.title}</Heading><Copy>{item.conversation.state} · {new Date(item.conversation.createdAt).toLocaleString()}</Copy><Action title="Open practice" secondary onPress={() => router.push(`/practice/${item.conversation.id}`)} /></Card>)}</>}
    <Heading eyebrow="Choose a workshop">What would you like to practice today?</Heading>
    {[
      { id: "daily" as const, title: "Daily Communication", description: "Everyday conversations, clear messages, and confident responses." },
      { id: "leadership" as const, title: "Leadership", description: "Present ideas, guide teams, and handle high-stakes conversations." },
      { id: "management" as const, title: "Professional Workshop", description: "Workplace communication, decisions, feedback, and business conversations." },
    ].map(path => <Card key={path.id}><Heading eyebrow="Practice path">{path.title}</Heading><Copy>{path.description}</Copy><Action title={`Start ${path.title}`} icon="play" onPress={() => router.push(`/workshop/${path.id}`)} /></Card>)}
    {Boolean(error) && <><Copy error>{error}</Copy><Action title="Retry" secondary onPress={load} /></>}
    <Card><Heading eyebrow="Progress">Your story starts with practice.</Heading><Copy>Track streaks, practice time, and communication skills as your sessions become assessable.</Copy><Action title="See my progress" secondary icon="progress" onPress={() => router.push("/progress")} /></Card>
  </Screen>;
}

