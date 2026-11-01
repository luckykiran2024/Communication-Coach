import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Switch, View } from "react-native";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../src/auth";
import { request, type VoiceCapabilities, type Recommendations } from "../src/api";
import { Action, Card, Copy, Disclosure, Heading, Icon, PillTag, Screen, usePreferences, useTheme, VoiceWave } from "../src/ui";
import { trackEvent } from "../src/telemetry";

type CoachState = "idle" | "listening" | "speaking" | "reconnecting";

export default function AICoachScreen() {
  const auth = useAuth();
  const theme = useTheme();
  const { voiceAccent } = usePreferences();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);

  const [coachState, setCoachState] = useState<CoachState>("idle");
  const [consent, setConsent] = useState(true);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(420); // 7 minutes = 420 seconds
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);

  const active = useRef(false);
  const alive = useRef(true);
  const file = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const [readiness, setReadiness] = useState("Connecting to AI voice engine…");
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);

  async function removeFile() {
    player.pause();
    if (file.current && Platform.OS !== "web") await FileSystem.deleteAsync(file.current, { idempotent: true });
    file.current = null;
    if (alive.current) setUri(null);
  }

  async function stopAudio() {
    if (!active.current) return;
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
    file.current = recorder.uri;
    if (alive.current) {
      setUri(recorder.uri);
      setCoachState("idle");
    }
  }

  useEffect(() => {
    alive.current = true;
    trackEvent({ name: "ai_coach_connected", transport: Platform.OS === "web" ? "web_preview" : "native_webrtc" });

    const loadCapabilities = async () => {
      if (Platform.OS === "web") return { nativeModuleAvailable: false, developmentBuild: false };
      try {
        const nativeWebRtc = await import("react-native-webrtc");
        return { nativeModuleAvailable: typeof nativeWebRtc.RTCPeerConnection === "function", developmentBuild: Constants.appOwnership !== "expo" };
      } catch {
        return { nativeModuleAvailable: false, developmentBuild: false };
      }
    };

    void Promise.all([
      request<{ message: string }>("/v1/voice/readiness", auth.token),
      request<Recommendations>("/v1/me/scenarios", auth.token).catch(() => null),
      loadCapabilities(),
    ]).then(async ([result, recs, detected]) => {
      if (recs) setRecommendations(recs);
      const query = new URLSearchParams({
        platform: Platform.OS,
        nativeModuleAvailable: String(detected.nativeModuleAvailable),
        developmentBuild: String(detected.developmentBuild),
      });
      const currentCapabilities = await request<VoiceCapabilities>(`/v1/voice/capabilities?${query.toString()}`, auth.token);
      if (alive.current) {
        setReadiness(result.message);
        setCapabilities(currentCapabilities);
      }
    }).catch(failure => {
      if (alive.current) {
        setError(failure.message);
        setCoachState("reconnecting");
      }
    });

    const subscription = AppState.addEventListener("change", next => {
      if (next !== "active") {
        player.pause();
        void stopAudio().catch(() => {
          if (alive.current) setError("Voice session interrupted.");
        });
      }
    });

    return () => {
      alive.current = false;
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      void (async () => {
        try {
          await stopAudio();
          await removeFile();
        } catch {}
      })();
    };
  }, [auth.token]);

  if (auth.loading) return <Screen><Copy>Connecting to coach…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;

  async function startQuickCheck() {
    setBusy(true);
    setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Microphone permission was denied. Please allow microphone access in device settings.");
        return;
      }
      if (!alive.current || AppState.currentState !== "active") return;
      await removeFile();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!alive.current || AppState.currentState !== "active") {
        await recorder.stop();
        file.current = recorder.uri;
        await removeFile();
        return;
      }
      recorder.record();
      active.current = true;
      setCoachState("listening");
      setSecondsRemaining(420);

      countdownInterval.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            void stopAudio();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      timer.current = setTimeout(() => {
        void stopAudio().catch(failure => setError(failure.message));
      }, 60000);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function startFullPracticeSession() {
    const topScenario = recommendations?.scenarios[0];
    if (!topScenario) {
      router.push("/workshop/daily");
      return;
    }
    setBusy(true);
    try {
      trackEvent({ name: "exercise_started", scenarioId: topScenario.id, module: topScenario.module });
      const result = await request<{ conversation: { id: string } }>("/v1/me/conversations", auth.token, "POST", { scenarioId: topScenario.id });
      router.push(`/practice/${result.conversation.id}`);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const isWeb = Platform.OS === "web";
  const stateLabel = coachState === "listening" ? "Listening to your voice" : coachState === "speaking" ? "Coach speaking" : coachState === "reconnecting" ? "Reconnecting…" : "Ready for practice";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Heading eyebrow="AI Live Coach">Deliberate Voice Practice</Heading>
        <PillTag label={capabilities?.liveVoiceAvailable ? "ONLINE" : isWeb ? "WEB PREVIEW" : "STANDBY"} tone={capabilities?.liveVoiceAvailable ? "positive" : "accent"} />
      </View>

      <Card tone="accent">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Copy>{stateLabel}</Copy>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="clock" size={20} color={theme.accent} />
              <Heading eyebrow="Session Timer">{formatTime(secondsRemaining)}</Heading>
            </View>
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.surface }}>
            <Copy>{voiceAccent}</Copy>
          </View>
        </View>

        <VoiceWave active={recorderState.isRecording} color={recorderState.isRecording ? theme.positive : theme.accent} />

        {recorderState.isRecording ? (
          <View style={{ gap: 10 }}>
            <Action title="Stop recording & listen" icon="recording" onPress={() => void stopAudio()} />
            <Action title="Interrupt Coach" secondary onPress={() => { player.pause(); setCoachState("listening"); }} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Action title="Start 7-Minute AI Practice" icon="play" busy={busy} onPress={() => void startFullPracticeSession()} />
            <Action title="Quick Microphone & Accent Check" secondary icon="mic" busy={busy} onPress={() => void startQuickCheck()} />
          </View>
        )}

        {uri && !recorderState.isRecording && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Action title="Play back my voice check" secondary onPress={() => { player.replace(uri); player.play(); }} />
            <Action title="Delete audio sample" secondary onPress={() => void removeFile()} />
          </View>
        )}
      </Card>

      <Card>
        <Heading eyebrow="Live Voice Architecture">Low-Latency Bidirectional Audio</Heading>
        <Disclosure summary="OpenAI Realtime gpt-realtime-2.1 with native WebRTC stream.">
          <Copy>Audio is streamed over WebRTC Opus at 24kHz with adaptive echo cancellation. The AI coach detects your pauses naturally and adjusts tone to your specified accent.</Copy>
          <Copy>In native Android builds, speech connects directly to live sockets. In web preview mode, recording stays local on your machine.</Copy>
        </Disclosure>
      </Card>

      {Boolean(error) && (
        <Card>
          <Copy error>{error}</Copy>
          <Action title="Retry Connection" secondary onPress={() => { setError(""); setCoachState("idle"); }} />
        </Card>
      )}
    </Screen>
  );
}
