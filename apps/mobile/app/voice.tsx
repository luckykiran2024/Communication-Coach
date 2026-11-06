import { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../src/auth";
import { request, type VoiceCapabilities, type Recommendations } from "../src/api";
import { Action, Card, Copy, Disclosure, Heading, Icon, PillTag, Screen, usePreferences, useTheme, VoiceWave } from "../src/ui";
import { trackEvent } from "../src/telemetry";
import { withDeadline } from "../src/deadline";

type CoachState = "idle" | "listening" | "speaking" | "reconnecting";

export default function AICoachScreen() {
  const auth = useAuth();
  const theme = useTheme();
  const { voiceAccent } = usePreferences();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const [coachState, setCoachState] = useState<CoachState>("idle");
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);

  const active = useRef(false);
  const alive = useRef(true);
  const file = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCheck = useRef<AbortController | null>(null);
  const preparing = useRef(false);
  const [checkingMicrophone, setCheckingMicrophone] = useState(false);

  function cancelQuickCheck() {
    pendingCheck.current?.abort();
    pendingCheck.current = null;
    setCheckingMicrophone(false); setBusy(false);
  }

  const [readiness, setReadiness] = useState("Connecting to AI voice engine…");
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);

  async function removeFile() {
    player.pause();
    if (file.current && Platform.OS !== "web") await FileSystem.deleteAsync(file.current, { idempotent: true });
    if (file.current?.startsWith("blob:") && Platform.OS === "web") URL.revokeObjectURL(file.current);
    file.current = null;
    if (alive.current) setUri(null);
  }

  async function stopAudio() {
    if (!active.current) return;
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    try { await recorder.stop(); }
    catch { if (alive.current) setError("The audio check could not stop cleanly. Check microphone permissions before trying again."); }
    finally { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => undefined); }
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
      if (recs && alive.current) setRecommendations(recs);
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
        cancelQuickCheck();
        player.pause();
        void stopAudio().catch(() => {
          if (alive.current) setError("Voice session interrupted.");
        });
      }
    });

    return () => {
      alive.current = false;
      pendingCheck.current?.abort(); pendingCheck.current = null;
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
    if (preparing.current) { setError("The previous microphone request is still closing. Check browser permissions or reload this page before trying again."); return; }
    const operation = new AbortController();
    pendingCheck.current = operation;
    setCheckingMicrophone(true);
    setBusy(true);
    setError("");
    try {
      const permission = await withDeadline(AudioModule.requestRecordingPermissionsAsync(), 15000, operation.signal);
      if (!permission.granted) {
        setError("Microphone permission was denied. Please allow microphone access in device settings.");
        return;
      }
      if (!alive.current || operation.signal.aborted || AppState.currentState !== "active") return;
      await removeFile();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      if (operation.signal.aborted) return;
      preparing.current = true;
      const preparation = recorder.prepareToRecordAsync().then(async () => {
        if (operation.signal.aborted || !alive.current || AppState.currentState !== "active") {
          await recorder.stop();
          await setAudioModeAsync({ allowsRecording: false });
          file.current = recorder.uri;
          await removeFile();
          throw new Error("Microphone check cancelled.");
        }
      }).finally(() => { preparing.current = false; });
      await withDeadline(preparation, 15000, operation.signal);
      if (operation.signal.aborted || !alive.current) return;
      recorder.record();
      active.current = true;
      setCoachState("listening");
      setSecondsRemaining(60);

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
      operation.abort();
      if (alive.current && pendingCheck.current === operation) setError((failure as Error).message);
    } finally {
      if (!active.current && !preparing.current) await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (alive.current && pendingCheck.current === operation) { pendingCheck.current = null; setBusy(false); setCheckingMicrophone(false); }
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
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Action title="Open recommended practice" icon="play" busy={busy} onPress={() => void startFullPracticeSession()} />
            <Action title="Quick Microphone Check" secondary icon="mic" busy={busy} onPress={() => void startQuickCheck()} />
            {checkingMicrophone && <Action title="Cancel microphone request" secondary onPress={cancelQuickCheck} />}
          </View>
        )}

        {Boolean(uri) && !recorderState.isRecording && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Action title={playerStatus.playing ? "Stop playback" : "Play back my voice check"} secondary onPress={() => {
              try { if (playerStatus.playing) player.pause(); else if (uri) { player.replace(uri); player.play(); } }
              catch { setError("This device could not play the sample. Try recording again or check audio output settings."); }
            }} />
            <Action title="Delete audio sample" secondary onPress={() => void removeFile()} />
          </View>
        )}
      </Card>

      <Card>
        <Heading eyebrow="Microphone check">Record, listen and delete</Heading>
        <Disclosure summary="Record a local sample for up to one minute.">
          <Copy>This check records on your device for playback. It does not upload audio or assess your accent.</Copy>
          <Copy>Live AI role-play is a separate feature in supported Android and iOS builds.</Copy>
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
