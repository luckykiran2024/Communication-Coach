import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Redirect, router } from "expo-router";
import { brand, modules } from "@coach/core";
import { request, type ProgressSnapshot, type Recommendations, type VoiceUsage } from "../src/api";
import { useAuth } from "../src/auth";
import { EmailVerificationBanner } from "../src/email-verification-banner";
import { Action, Card, Copy, Disclosure, Heading, Icon, IconButton, PillTag, ProgressBar, Screen, SkeletonCard, usePreferences, useTheme } from "../src/ui";
import { SpringbokLogo } from "../src/springbok-logo";
import { trackEvent } from "../src/telemetry";

type RecentPractice = { conversation: { id: string; state: string; createdAt: string }; scenario: { title: string; module: "daily" | "management" | "leadership" } };

export default function Home() {
  const auth = useAuth();
  const theme = useTheme();
  const { avatarUri } = usePreferences();
  const [usage, setUsage] = useState<VoiceUsage | null>(null);
  const [recent, setRecent] = useState<RecentPractice[]>([]);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [currentUsage, recentResponse, progressSnapshot, currentRecommendations] = await Promise.all([
        request<VoiceUsage>("/v1/me/voice-usage", auth.token),
        request<{ conversations: RecentPractice[] }>("/v1/me/conversations", auth.token),
        request<ProgressSnapshot>("/v1/me/progress", auth.token),
        request<Recommendations>("/v1/me/scenarios", auth.token),
      ]);
      setUsage(currentUsage);
      setRecent(recentResponse.conversations);
      setProgress(progressSnapshot);
      setRecommendations(currentRecommendations);
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (auth.me?.profile) void load();
  }, [auth.token, auth.me?.profile]);

  if (auth.loading) {
    return (
      <Screen>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
  }

  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me) {
    return (
      <Screen>
        <Copy error>{auth.error || "Profile unavailable."}</Copy>
        <Action title="Retry connection" onPress={() => auth.refresh().catch(failure => setError(failure.message))} />
        <Copy error>{error}</Copy>
      </Screen>
    );
  }
  if (!auth.me.profile) return <Redirect href="/onboarding" />;
  if (loading) return <Screen><Copy>Loading your practice and progress…</Copy><SkeletonCard /><SkeletonCard /></Screen>;
  if (!usage || !progress || !recommendations) return <Screen><Copy error>{error || "Practice data is unavailable."}</Copy><Action title="Retry" onPress={() => void load()} /></Screen>;

  const profile = auth.me.profile;
  const topScenario = recommendations?.scenarios[0];
  const activeUnfinished = recent.find(item => ["CREATED", "CONNECTING", "LIVE", "INTERRUPTED", "ASSESSING", "FAILED"].includes(item.conversation.state));

  async function startRecommended() {
    if (!auth.token || !topScenario || starting) return;
    setStarting(true);
    try {
      trackEvent({ name: "exercise_started", scenarioId: topScenario.id, module: topScenario.module });
      const result = await request<{ conversation: { id: string } }>("/v1/me/conversations", auth.token, "POST", { scenarioId: topScenario.id });
      router.push(`/practice/${result.conversation.id}`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center" }}><SpringbokLogo size={76} repeat /></View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {avatarUri ? (
          <Image accessibilityLabel="Your display picture" source={{ uri: avatarUri }} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.border }} />
        ) : (
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: theme.accentSurface, alignItems: "center", justifyContent: "center" }}>
            <Icon name="person" size={26} color={theme.accent} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "600", letterSpacing: 0.5 }}>WELCOME BACK</Text>
          <Heading>{profile.displayName}</Heading>
        </View>
        <PillTag label={usage.planTitle} tone="accent" />
      </View>

      <EmailVerificationBanner />

      {activeUnfinished && (
        <Card tone="accent">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="clock" size={22} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Heading eyebrow="In-Progress Practice">{displayScenarioTitle(activeUnfinished.scenario.title)}</Heading>
              <Copy>You have an unfinished session ready to resume.</Copy>
            </View>
          </View>
          <Action title="Resume practice" icon="play" onPress={() => router.push(`/practice/${activeUnfinished.conversation.id}`)} />
        </Card>
      )}

      {topScenario ? (
        <Card tone="accent">
          <View style={{ gap: 8 }}>
            <PillTag label={`Recommended · Level ${topScenario.level}`} tone="positive" />
            <Heading>{displayScenarioTitle(topScenario.title)}</Heading>
            <Copy>{topScenario.context}</Copy>
          </View>

          <Disclosure summary="7-minute session · Targets clarity, structure, and executive delivery.">
            <Copy>You will deliver an initial response, receive immediate follow-up coaching feedback, and practice an independent retry under an altered scenario.</Copy>
          </Disclosure>

          <Action title="Start Today's Session" icon="play" busy={starting} onPress={() => void startRecommended()} />
        </Card>
      ) : (
        <Card tone="accent">
          <Heading eyebrow="Today's Practice">Explore your workshops</Heading>
          <Copy>Choose a practice module from the Practice tab to begin your deliberate speaking exercises.</Copy>
          <Action title="Open Practice Library" icon="play" onPress={() => router.push("/workshop/daily")} />
        </Card>
      )}

      {usage && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Heading eyebrow="Plan usage">{usage.sessionsRemaining} sessions left</Heading>
              <Copy>{usage.lifetimeFreeLimit ? "Free account tier" : `${usage.planTitle} · Resets ${new Date(usage.monthResetsAt).toLocaleDateString()}`}</Copy>
            </View>
            <IconButton name="mic" label="AI Coach Status" onPress={() => router.push("/voice")} />
          </View>
          <ProgressBar value={Math.round(((usage.sessionsAllowed - usage.sessionsRemaining) / Math.max(1, usage.sessionsAllowed)) * 100)} color={theme.accent} />
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="progress" size={26} color={theme.positive} />
          <View style={{ flex: 1 }}>
            <Heading eyebrow={`Streak · ${progress?.practiceDays ?? 1} day`}>{progress?.mastery.title ?? "Foundation"}</Heading>
            <Copy>{progress?.mastery.successfulRetries ?? 0} retries completed · Level {progress?.mastery.level ?? 1}</Copy>
          </View>
        </View>
        <ProgressBar value={progress?.mastery.progressPercent ?? 0} color={theme.positive} />
        <Action title="View detailed progress" secondary icon="progress" onPress={() => router.push("/progress")} />
      </Card>

      {Boolean(error) && (
        <Card>
          <Copy error>{error}</Copy>
          <Action title="Retry" secondary onPress={() => void load()} />
        </Card>
      )}
    </Screen>
  );
}

function Text(props: any) {
  const theme = useTheme();
  return <Copy {...props} style={[{ color: theme.ink }, props.style]}>{props.children}</Copy>;
}

function displayScenarioTitle(title: string) {
  return title.replace(/\s*·\s*(?:Clarity foundation|Structured message|Evidence and trade-offs|Audience adaptation|Leadership transfer)$/i, "");
}
