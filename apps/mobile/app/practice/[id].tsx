import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AccessibilityInfo, Platform, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { modules, practicePrograms, type CoachAccent, type Scenario } from "@coach/core";
import { request } from "../../src/api";
import { useAuth } from "../../src/auth";
import { connectRealtimeCall, type RealtimeCall } from "../../src/realtime";
import { Action, Card, Copy, Heading, Icon, MicButton, Screen, usePreferences, useTheme, VoiceWave } from "../../src/ui";

type Practice = { conversation: { id: string; scenarioId: string; state: string; createdAt: string }; scenario: Scenario; turns: { role: string; phase?: "primary" | "independent_retry"; text: string }[]; liveVoiceAvailable: boolean };
type PromptState = "idle" | "speaking" | "ready";

export default function PracticeDetail() {
  const auth = useAuth();
  const theme = useTheme();
  const { voiceAccent } = usePreferences();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [practice, setPractice] = useState<Practice | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [speechMessage, setSpeechMessage] = useState("");
  const [promptState, setPromptState] = useState<PromptState>("idle");
  const [liveCall, setLiveCall] = useState<RealtimeCall | null>(null);
  const [liveSessionId, setLiveSessionId] = useState("");
  const [liveStartedAt, setLiveStartedAt] = useState<number | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const liveCallRef = useRef<RealtimeCall | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!auth.token || !id) return;
    request<Practice>(`/v1/me/conversations/${id}`, auth.token).then(setPractice).catch(failure => setError((failure as Error).message));
    return () => { if (speechTimer.current) clearTimeout(speechTimer.current); if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); else void Speech.stop(); liveCallRef.current?.close(); liveCallRef.current = null; };
  }, [auth.token, id]);
  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (error) return <Screen><Copy error>{error}</Copy><Action title="Back to today" onPress={() => router.replace("/home")} /></Screen>;
  if (!practice) return <Screen><Copy>Loading practice…</Copy></Screen>;

  const module = modules.find(item => item.id === practice.scenario.module);
  const primaryResponse = practice.turns.find(turn => turn.role === "user" && (turn.phase ?? "primary") === "primary");
  const retryResponse = practice.turns.find(turn => turn.role === "user" && turn.phase === "independent_retry");
  const retryStarted = Boolean(primaryResponse);
  const retryCompleted = Boolean(retryResponse);
  const activeQuestion = retryStarted ? practice.scenario.independentQuestion : practice.scenario.question;
  const promptText = `${practice.scenario.context} ${activeQuestion}`;

  function speakPrompt() {
    setSpeechMessage("");
    setPromptState("speaking");
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(promptText);
      utterance.lang = accentLanguage(voiceAccent);
      const browserVoices = window.speechSynthesis.getVoices();
      const requestedLanguage = accentLanguage(voiceAccent).toLowerCase();
      utterance.voice = browserVoices.find(voice => voice.lang.toLowerCase().replaceAll("_", "-") === requestedLanguage) ?? null;
      utterance.onend = () => { setPromptState("ready"); setSpeechMessage("Prompt finished. Your turn to respond."); };
      utterance.onerror = () => { setPromptState("ready"); setSpeechMessage("The prompt could not be spoken on this device."); };
      window.speechSynthesis.speak(utterance);
      setSpeechMessage("Speaking the prompt…");
      return;
    }
    if (Platform.OS !== "web") {
      void Speech.stop();
      void Speech.getAvailableVoicesAsync().then(voices => {
        const requestedLanguage = accentLanguage(voiceAccent).toLowerCase();
        const matchingVoice = voices.find(voice => voice.language.toLowerCase().replaceAll("_", "-") === requestedLanguage);
        Speech.speak(promptText, { language: accentLanguage(voiceAccent), voice: matchingVoice?.identifier, rate: 0.9, onDone: () => { setPromptState("ready"); setSpeechMessage(matchingVoice || voiceAccent !== "Indian English" ? "Prompt finished. Your turn to respond." : "Prompt finished. Your turn to respond. For an Indian English voice, install an en-IN voice in your phone’s text-to-speech settings." ); }, onStopped: () => setPromptState("idle"), onError: () => { AccessibilityInfo.announceForAccessibility(promptText); setPromptState("ready"); setSpeechMessage("Native speech could not start. Check that a text-to-speech voice is installed in your device settings."); } });
      }).catch(() => {
        Speech.speak(promptText, { language: accentLanguage(voiceAccent), rate: 0.9, onDone: () => { setPromptState("ready"); setSpeechMessage("Prompt finished. Your turn to respond."); }, onStopped: () => setPromptState("idle"), onError: () => { AccessibilityInfo.announceForAccessibility(promptText); setPromptState("ready"); setSpeechMessage("Native speech could not start. Check that a text-to-speech voice is installed in your device settings."); } });
      });
      setSpeechMessage("Speaking the prompt aloud…");
      return;
    }
    AccessibilityInfo.announceForAccessibility(promptText);
    setSpeechMessage("Prompt sent to your device accessibility voice.");
    speechTimer.current = setTimeout(() => { setPromptState("ready"); setSpeechMessage("Your turn to respond."); }, Math.min(8000, Math.max(2500, promptText.length * 32)));
  }

  function stopSpeaking() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    else void Speech.stop();
    setPromptState("idle");
    setSpeechMessage("Prompt stopped.");
  }

  async function saveResponse() {
    if (!auth.token || !id || !draft.trim()) return;
    setSaving(true); setError(""); setSavedMessage("");
    try {
      const result = await request<{ turn: { role: string; phase: "primary" | "independent_retry"; text: string }; message: string }>(`/v1/me/conversations/${id}/turns`, auth.token, "POST", { role: "user", phase: retryStarted ? "independent_retry" : "primary", text: draft });
      setPractice(current => current ? { ...current, turns: [...current.turns, result.turn] } : current);
      setDraft(""); setSavedMessage(result.message);
    } catch (failure) { setError((failure as Error).message); } finally { setSaving(false); }
  }

  async function finishPractice() {
    if (!auth.token || !id || !practice || practice.turns.length === 0) return;
    setFinishing(true); setError("");
    try {
      const result = await request<{ conversation: { state: string }; message: string }>(`/v1/me/conversations/${id}/complete`, auth.token, "POST");
      setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: result.conversation.state } } : current);
      setSavedMessage(result.message);
      router.replace(`/workshop/${practice.scenario.module}?programLevel=${practice.scenario.level}&completedScenarioId=${encodeURIComponent(practice.scenario.id)}`);
    } catch (failure) { setError((failure as Error).message); } finally { setFinishing(false); }
  }

  async function startLiveVoice() {
    if (!auth.token || !id || !practice || Platform.OS === "web") { setLiveMessage("Live voice requires an Android or iOS development build."); return; }
    setLiveBusy(true); setError(""); setLiveMessage("Connecting the coach microphone…");
    let sessionId = "";
    let call: RealtimeCall | null = null;
    let transcriptQueue = Promise.resolve();
    const persistTranscript = (event: Record<string, unknown>, role: "user" | "assistant") => {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (!transcript || !auth.token || !sessionId) return;
      transcriptQueue = transcriptQueue.then(async () => {
        const result = await request<{ turn: { role: string; phase: "primary" | "independent_retry"; text: string } }>(`/v1/voice/sessions/${sessionId}/transcript`, auth.token, "POST", { role, phase: "primary", text: transcript });
        setPractice(current => current ? { ...current, turns: [...current.turns, result.turn] } : current);
      }).catch(() => undefined);
    };
    try {
      const result = await request<{ sessionId: string; clientSecret: string; conversation: { state: string } }>("/v1/voice/sessions", auth.token, "POST", { conversationId: id, scenarioId: practice.scenario.id });
      sessionId = result.sessionId;
      call = await connectRealtimeCall({ clientSecret: result.clientSecret, onEvent: event => {
        if (event.type === "error") setLiveMessage("The coach voice reported an error. You can stop and retry.");
        if (event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") { setLiveMessage("Coach is speaking…"); persistTranscript(event, "assistant"); }
        if (event.type === "conversation.item.input_audio_transcription.completed") { setLiveMessage("Coach heard your response."); persistTranscript(event, "user"); }
      } });
      await request(`/v1/voice/sessions/${sessionId}/bind`, auth.token, "POST", { providerCallId: call.providerCallId });
      liveCallRef.current = call; setLiveCall(call); setLiveSessionId(result.sessionId); setLiveStartedAt(Date.now()); setLiveMessage("Coach is listening. Speak naturally; the prompt is being spoken aloud."); setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: result.conversation.state } } : current);
    } catch (failure) {
      call?.close();
      if (sessionId) await request(`/v1/voice/sessions/${sessionId}/stop`, auth.token, "POST", { consumedSeconds: 0 }).catch(() => undefined);
      setLiveMessage((failure as Error).message);
    }
    finally { setLiveBusy(false); }
  }

  async function stopLiveVoice() {
    if (!liveCall || !auth.token || !liveSessionId) return;
    setLiveBusy(true);
    const consumedSeconds = Math.max(0, Math.round((Date.now() - (liveStartedAt ?? Date.now())) / 1000));
    liveCall.close();
    liveCallRef.current = null;
    try { await request(`/v1/voice/sessions/${liveSessionId}/stop`, auth.token, "POST", { consumedSeconds }); setLiveMessage("Live practice ended. Your session allowance was settled safely."); setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: "INTERRUPTED" } } : current); }
    catch (failure) { setError((failure as Error).message); }
    finally { setLiveCall(null); setLiveSessionId(""); setLiveStartedAt(null); setLiveBusy(false); }
  }

  const isSpeaking = promptState === "speaking";
  const statusText = isSpeaking ? "Coach is speaking" : promptState === "ready" ? "Your turn to speak" : "Ready when you are";
  return <Screen>
    <Heading eyebrow={`${module?.title ?? "Practice"} · ${practicePrograms[practice.scenario.level - 1]?.title ?? "Practice programme"}`}>{practice.scenario.title.replace(/\s*·\s*(?:Clarity foundation|Structured message|Evidence and trade-offs|Audience adaptation|Leadership transfer)$/i, "")}</Heading>
    <Copy>Session status: {practice.conversation.state} · Created {new Date(practice.conversation.createdAt).toLocaleString()}</Copy>
    <Card tone="accent">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="spark" size={19} color={theme.ink} /><Text style={{ color: theme.ink, fontWeight: "700", letterSpacing: 1.5, fontSize: 12 }}>CONVERSATION MODE</Text></View>
      <Heading eyebrow="Coach prompt">Speak to the situation, not a script.</Heading>
      <Copy>{practice.scenario.context}</Copy>
      <Copy>{retryStarted ? `Independent retry: ${practice.scenario.independentQuestion}` : practice.scenario.question}</Copy>
      <Copy>Focus: {practice.scenario.focus}</Copy>
      <Copy>Coach voice: {voiceAccent}. The installed device voice supplies the final pronunciation.</Copy>
      <VoiceWave active={isSpeaking} color={theme.ink} />
      <MicButton active={isSpeaking} label={isSpeaking ? "Stop voice prompt" : promptState === "ready" ? "Record your answer" : "Hear prompt"} onPress={isSpeaking ? stopSpeaking : promptState === "ready" ? () => router.push("/voice") : speakPrompt} />
      <Text style={{ color: theme.ink, textAlign: "center", fontWeight: "700", fontSize: 17 }}>{statusText}</Text>
      <Copy>{speechMessage || (promptState === "ready" ? "Tap the microphone to record your answer." : "Tap the microphone and let the coach set the scene out loud.")}</Copy>
      {isSpeaking && <Action title="Stop speaking" secondary icon="mic" onPress={stopSpeaking} />}
      <Action title={liveCall ? "Stop live coach" : practice.liveVoiceAvailable ? "Start AI live coach" : "AI live coach unavailable"} icon="mic" disabled={liveBusy || practice.conversation.state === "COMPLETED" || (!practice.liveVoiceAvailable && !liveCall)} busy={liveBusy} onPress={() => void (liveCall ? stopLiveVoice() : startLiveVoice())} />
      {!practice.liveVoiceAvailable && <Copy>Live AI requires an enabled server voice provider and a verified Android/iOS WebRTC build. Text practice and local microphone recording remain available; this button stays disabled until those checks pass.</Copy>}
      {Boolean(liveMessage) && <Copy>{liveMessage}</Copy>}
    </Card>
    <Card><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="client" size={22} color={theme.accent} /><Heading eyebrow="Your turn">Make it conversational</Heading></View><Copy>Answer out loud as if a real colleague were in front of you. Use the local audio check to record and play back your response while live AI voice is being connected.</Copy><Action title="Open microphone check" icon="recording" onPress={() => router.push("/voice")} /></Card>
    <Card><Heading eyebrow={retryStarted ? "Independent retry" : "Text fallback"}>{retryStarted ? "Try the situation again." : "Write your response"}</Heading><Copy>{retryStarted ? "Use the new situation to show what you can apply independently. Your response is checked for substantive, structured and actionable evidence." : "This optional text path saves your primary response for a future assessment. It does not generate AI feedback."}</Copy>{["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && !retryCompleted && <><TextInput accessibilityLabel={retryStarted ? "Your independent retry" : "Your practice response"} placeholder={retryStarted ? "Answer the new situation in your own words…" : "Type what you would say…"} value={draft} onChangeText={setDraft} multiline maxLength={10000} textAlignVertical="top" style={{ minHeight: 120, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.ink, backgroundColor: theme.surface }} /><Action title={retryStarted ? "Save independent retry" : "Save primary response"} disabled={!draft.trim()} busy={saving} onPress={() => void saveResponse()} /></>}{["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && retryStarted && !retryCompleted && <Copy>Complete the independent retry before finishing this practice.</Copy>}{["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && retryCompleted && <Action title="Finish practice" secondary disabled={finishing} busy={finishing} onPress={() => void finishPractice()} />}{Boolean(savedMessage) && <Copy>{savedMessage}</Copy>}{Boolean(error) && <Copy error>{error}</Copy>}{practice.turns.length > 0 && <Copy>{practice.turns.length} response{practice.turns.length === 1 ? "" : "s"} saved. No assistant turns have been added.</Copy>}</Card>
    <Card><Heading eyebrow="Live AI voice">Conversational mode</Heading><Copy>The live coach uses a short-lived server-issued session key. Your standard API key never enters the mobile app. Stop the session when you finish so the server can settle your allowance.</Copy></Card>
    <Action title="Back to today" secondary onPress={() => router.replace("/home")} />
  </Screen>;
}

function accentLanguage(accent: CoachAccent) { return ({ "Indian English": "en-IN", "British English": "en-GB", "American English": "en-US", "Australian English": "en-AU" } as const)[accent]; }
