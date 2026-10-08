import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Switch, View } from "react-native";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth } from "../src/auth";
import { request, type VoiceCapabilities } from "../src/api";
import { Action, Card, Copy, Heading, Icon, Screen, useTheme, VoiceWave } from "../src/ui";
export default function VoiceCheck() {
  const auth = useAuth();
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null);
  const [consent, setConsent] = useState(false); const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [status, setStatus] = useState("Ready when you are.");
  const active = useRef(false); const alive = useRef(true); const file = useRef<string | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readiness, setReadiness] = useState("Checking authenticated server connectivity…");
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);
  async function removeFile() {
    player.pause();
    if (file.current && Platform.OS !== "web") await FileSystem.deleteAsync(file.current, { idempotent: true });
    file.current = null; if (alive.current) setUri(null);
  }
  async function stop() {
    if (!active.current) return;
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
    file.current = recorder.uri;
    if (alive.current) { setUri(recorder.uri); setStatus("Recording stopped. Listen back, then delete it."); }
  }
  useEffect(() => {
    alive.current = true;
    const loadCapabilities = async () => {
      if (Platform.OS === "web") return { nativeModuleAvailable: false, developmentBuild: false };
      try {
        const nativeWebRtc = await import("react-native-webrtc");
        return { nativeModuleAvailable: typeof nativeWebRtc.RTCPeerConnection === "function", developmentBuild: Constants.appOwnership !== "expo" };
      } catch {
        return { nativeModuleAvailable: false, developmentBuild: false };
      }
    };
    void Promise.all([request<{ message: string }>("/v1/voice/readiness", auth.token), loadCapabilities()])
      .then(async ([result, detected]) => {
        const query = new URLSearchParams({ platform: Platform.OS, nativeModuleAvailable: String(detected.nativeModuleAvailable), developmentBuild: String(detected.developmentBuild) });
        const currentCapabilities = await request<VoiceCapabilities>(`/v1/voice/capabilities?${query.toString()}`, auth.token);
        if (alive.current) { setReadiness(result.message); setCapabilities(currentCapabilities); }
      })
      .catch(failure => { if (alive.current) setReadiness(failure.message); });
    const subscription = AppState.addEventListener("change", next => {
      if (next !== "active") { player.pause(); void stop().catch(() => { if (alive.current) setError("Audio interrupted. Please restart the check."); }); }
    });
    return () => {
      alive.current = false; subscription.remove(); if (timer.current) clearTimeout(timer.current);
      void (async () => { try { await stop(); await removeFile(); } catch {} })();
    };
  }, []);
  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  async function start() {
    setBusy(true); setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setError("Microphone permission was denied. Enable it in device settings, then try again."); return; }
      if (!alive.current || AppState.currentState !== "active") return;
      await removeFile();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!alive.current || AppState.currentState !== "active") { await recorder.stop(); file.current = recorder.uri; await removeFile(); return; }
      recorder.record(); active.current = true; setStatus("Recording · microphone is on");
      timer.current = setTimeout(() => { void stop().catch(failure => setError(failure.message)); }, 60000);
    } catch (failure) { setError((failure as Error).message); } finally { if (alive.current) setBusy(false); }
  }
  return <Screen><Heading eyebrow="Native audio proof of concept">Make sure your voice comes through.</Heading><Copy>{readiness}</Copy>{capabilities && <Card><Heading eyebrow="Live voice status">{capabilities.liveVoiceAvailable ? "Ready" : capabilities.code.replaceAll("_", " ")}</Heading><Copy>{capabilities.platform === "web" ? "Web preview supports local audio only." : "This build does not yet have every native live-voice prerequisite."} Transport: {capabilities.transport}.</Copy></Card>}
    <Card><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name={recorderState.isRecording ? "recording" : "mic"} size={24} color={recorderState.isRecording ? theme.positive : theme.accent} /><Heading eyebrow={recorderState.isRecording ? "Microphone on" : "Microphone off"}>{Math.floor(recorderState.durationMillis / 1000)} seconds</Heading></View><VoiceWave active={recorderState.isRecording} color={recorderState.isRecording ? theme.positive : theme.accent} /><Copy>{status}</Copy>
      <View style={{ gap: 12 }}><Copy>I agree to a temporary local recording for this audio check. It is not uploaded, transcribed, or assessed.</Copy><Switch accessibilityLabel="Agree to temporary local audio recording" value={consent} disabled={recorderState.isRecording || busy} onValueChange={setConsent} /></View>
      {Boolean(error) && <Copy error>{error}</Copy>}
      <Action title={recorderState.isRecording ? "Stop recording" : "Record a short test"} disabled={!consent} busy={busy} onPress={() => { if (recorderState.isRecording) void stop().catch(failure => setError(failure.message)); else void start(); }} />
      {uri && <><Action title="Play my recording" secondary onPress={() => { player.replace(uri); player.play(); }} /><Action title="Stop playback" secondary onPress={() => player.pause()} /><Action title="Delete recording" secondary onPress={() => removeFile().then(() => setStatus("Recording deleted.")).catch(failure => setError(failure.message))} /></>}
    </Card><Copy>Maximum 60 seconds. Stops when the app leaves the foreground. Temporary files are deleted when you leave this screen normally; interrupted app termination can leave cache files for the OS to remove. This is not a live AI conversation.</Copy>
  </Screen>;
}
