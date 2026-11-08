import { useEffect, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { AccessibilityInfo, AppState, Platform, Switch, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { modules, practicePrograms, type CoachAccent, type Scenario } from "@coach/core";
import { ReportContent } from "../../src/report-content";
import { withDeadline } from "../../src/deadline";
import { request } from "../../src/api";
import { useAuth } from "../../src/auth";
import { connectRealtimeCall, type RealtimeCall } from "../../src/realtime";
import { textPracticeDescription } from "../../src/presentation";
import { Action, Card, Copy, Disclosure, Heading, Icon, MicButton, Screen, usePreferences, useTheme, VoiceWave } from "../../src/ui";

type Practice = {
  conversation: { id: string; scenarioId: string; state: string; createdAt: string; currentPhase: string };
  scenario: Scenario; turns: { role: string; phase?: "primary" | "independent_retry"; text: string }[];
  liveVoiceAvailable: boolean;
  assessmentEnabled?: boolean;
  feedbackRetryAvailable?: boolean;
};
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
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const liveCallRef = useRef<RealtimeCall | null>(null);
  const transcriptQueue = useRef<Promise<void>>(Promise.resolve());
  const transcriptFailure = useRef(false);
  const mounted = useRef(true);
  const connectionGeneration = useRef(0);
  const connectionAbort = useRef<AbortController | null>(null);
  const sessionRef = useRef<{ id: string; token: string; startedAt: number } | null>(null);
  const stopPromise = useRef<Promise<void> | null>(null);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechGeneration = useRef(0);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    if (!auth.token || !id) return;
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") void stopLiveVoice(); });
    request<Practice>(`/v1/me/conversations/${id}`, auth.token).then(value => { if (mounted.current) setPractice(value); }).catch(failure => { if (mounted.current) setError((failure as Error).message); });
    return () => { mounted.current = false; subscription.remove(); void stopLiveVoice(); speechGeneration.current += 1; if (speechTimer.current) clearTimeout(speechTimer.current); if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); else void Speech.stop(); liveCallRef.current?.close(); liveCallRef.current = null; };
  }, [auth.token, id]);
  if (auth.loading) return <Screen><Copy>Loading…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (error && !practice) return <Screen><Copy error>{error}</Copy>
    <Action title="Back to today" onPress={() => router.replace("/home")} /></Screen>;
  if (!practice) return <Screen><Copy>Loading practice…</Copy></Screen>;

  const module = modules.find(item => item.id === practice.scenario.module);
  const primaryResponse = practice.turns.find(turn => turn.role === "user" && (turn.phase ?? "primary") === "primary");
  const retryResponse = practice.turns.find(turn => turn.role === "user" && turn.phase === "independent_retry");
  const retryStarted = practice.conversation.currentPhase === "independent_retry";
  const retryCompleted = Boolean(retryResponse);
  const activeQuestion = retryStarted ? practice.scenario.independentQuestion : practice.scenario.question;
  const promptText = `${practice.scenario.context} ${activeQuestion}`;

  function speakPrompt() {
    stopSpeaking();
    const generation = ++speechGeneration.current;
    const update = (message: string, state: PromptState = "ready") => {
      if (speechGeneration.current !== generation) return;
      if (speechTimer.current) clearTimeout(speechTimer.current);
      setPromptState(state); setSpeechMessage(message);
    };
    setPromptState("speaking"); setSpeechMessage("Speaking the prompt…");
    speechTimer.current = setTimeout(() => {
      if (speechGeneration.current !== generation) return;
      stopSpeaking();
      setSpeechMessage("Speech did not finish. You can read the prompt and continue by text, or check your device's speech settings.");
    }, 60000);
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        update("Speech is unavailable in this browser. Read the prompt and continue by text."); return;
      }
      const utterance = new SpeechSynthesisUtterance(promptText);
      utterance.lang = accentLanguage(voiceAccent);
      utterance.voice = window.speechSynthesis.getVoices().find(voice =>
        voice.lang.toLowerCase().replaceAll("_", "-") === utterance.lang.toLowerCase()) ?? null;
      utterance.onend = () => update("Prompt finished. Your turn to respond.");
      utterance.onerror = () => update("This browser could not play speech. Read the prompt and continue by text, or use your phone's installed speech voice.");
      try { window.speechSynthesis.speak(utterance); }
      catch { update("Speech is unavailable in this browser. Read the prompt and continue by text."); }
      return;
    }
    void Speech.getAvailableVoicesAsync().catch(() => []).then(voices => {
      if (speechGeneration.current !== generation) return;
      const voice = voices.find(item => item.language.toLowerCase().replaceAll("_", "-") === accentLanguage(voiceAccent).toLowerCase());
      Speech.speak(promptText, { language: accentLanguage(voiceAccent), voice: voice?.identifier, rate: 0.9,
        onDone: () => update("Prompt finished. Your turn to respond."),
        onStopped: () => update("Prompt stopped.", "idle"),
        onError: () => { AccessibilityInfo.announceForAccessibility(promptText); update("Check that a speech voice is installed in your device settings. You can continue by text."); },
      });
    });
  }

  function stopSpeaking() {
    speechGeneration.current += 1;
    if (speechTimer.current) clearTimeout(speechTimer.current);
    if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    else void Speech.stop();
    setPromptState("idle"); setSpeechMessage("Prompt stopped.");
  }

  async function saveResponse() {
    if (!auth.token || !id || !draft.trim()) return;
    setSaving(true); setError(""); setSavedMessage("");
    try {
      const result = await request<{ turn: Practice["turns"][number]; message: string }>(
        `/v1/me/conversations/${id}/turns`, auth.token, "POST", { role: "user", text: draft },
      );
      setPractice(current => current ? { ...current, turns: [...current.turns, result.turn] } : current);
      setDraft(""); setSavedMessage(result.message);
      transcriptFailure.current = false;
    } catch (failure) { setError((failure as Error).message); } finally { setSaving(false); }
  }

  async function advancePractice() {
    if (!auth.token || !id || liveCall || liveBusy || transcriptFailure.current) return;
    setSaving(true);
    try {
      await request(`/v1/me/conversations/${id}/advance`, auth.token, "POST");
      setPractice(await request<Practice>(`/v1/me/conversations/${id}`, auth.token));
      setDraft(""); setSavedMessage("New situation ready. Respond independently by voice or text.");
      stopSpeaking();
    } catch (failure) { setError((failure as Error).message); }
    finally { setSaving(false); }
  }

  async function refreshPractice() {
    if (!auth.token || !id) return;
    const latest = await request<Practice>(`/v1/me/conversations/${id}`, auth.token);
    setPractice(latest);
    if (latest.conversation.state === "FEEDBACK_READY") router.replace(`/feedback/${id}`);
  }

  async function finishPractice(retryFeedback = false) {
    if (!auth.token || !id || !practice || practice.turns.length === 0) return;
    setFinishing(true); setError("");
    try {
      const result = await request<{ conversation: { state: string }; message?: string }>(
        `/v1/me/conversations/${id}/${retryFeedback ? "feedback/retry" : "complete"}`,
        auth.token, "POST", undefined, 60000,
      );
      setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: result.conversation.state } } : current);
      setSavedMessage(result.message ?? "Your evidence-linked feedback is ready.");
      if (result.conversation.state === "FEEDBACK_READY") { router.replace(`/feedback/${id}`); return; }
      router.replace(`/workshop/${practice.scenario.module}?programLevel=${practice.scenario.level}&completedScenarioId=${encodeURIComponent(practice.scenario.id)}`);
    } catch (failure) {
      setError((failure as Error).message);
      await refreshPractice().catch(() => undefined);
    } finally { setFinishing(false); }
  }

  async function startLiveVoice() {
    if (!auth.token || !id || !practice || Platform.OS === "web") { setLiveMessage("Live voice requires an Android or iOS development build."); return; }
    if (liveBusy || sessionRef.current || !voiceConsent) return;
    const generation = ++connectionGeneration.current;
    const controller = new AbortController(); connectionAbort.current = controller;
    const current = () => mounted.current && connectionGeneration.current === generation && !controller.signal.aborted;
    setLiveBusy(true); setError(""); setLiveMessage("Connecting the coach microphone…");
    let sessionId = "";
    let call: RealtimeCall | null = null;
    transcriptQueue.current = Promise.resolve();
    transcriptFailure.current = false;
    const persistTranscript = (event: Record<string, unknown>, role: "user" | "assistant") => {
      const transcript = typeof event.transcript === "string" ? event.transcript.trim() : "";
      if (!transcript || !auth.token || !sessionId) return;
      transcriptQueue.current = transcriptQueue.current.then(async () => {
        const result = await request<{ turn: Practice["turns"][number] }>(
          `/v1/voice/sessions/${sessionId}/transcript`, auth.token, "POST", { role, text: transcript },
        );
        setPractice(current => current ? { ...current, turns: [...current.turns, result.turn] } : current);
      }).catch(() => {
        transcriptFailure.current = true;
        setLiveMessage("A transcript could not be saved. Stop voice and save a text response before continuing.");
      });
    };
    try {
      const result = await request<{ sessionId: string; clientSecret: string; model: string; expiresAt: string; conversation: { state: string } }>("/v1/voice/sessions", auth.token, "POST", { conversationId: id, scenarioId: practice.scenario.id });
      sessionId = result.sessionId;
      if (!current()) {
        await request(`/v1/voice/sessions/${sessionId}/stop`, auth.token, "POST", { consumedSeconds: 0 }).catch(() => undefined);
        return;
      }
      sessionRef.current = { id: sessionId, token: auth.token, startedAt: Date.now() };
      call = await connectRealtimeCall({ clientSecret: result.clientSecret, model: result.model, signal: controller.signal,
        onProviderCallCreated: async providerCallId => {
          // Bind even after cancellation so server cleanup can terminate a late-created call.
          const bind = () => request(`/v1/voice/sessions/${sessionId}/bind`, auth.token, "POST", { providerCallId });
          try { await bind(); } catch { await bind(); }
        }, onEvent: event => {
        if (!current()) return;
        if (event.type === "error") setLiveMessage("The coach voice reported an error. You can stop and retry.");
        if (event.type === "response.output_audio_transcript.done" || event.type === "response.audio_transcript.done") { setLiveMessage("Coach is speaking…"); persistTranscript(event, "assistant"); }
        if (event.type === "conversation.item.input_audio_transcription.completed") { setLiveMessage("Coach heard your response."); persistTranscript(event, "user"); }
      } });
      if (!current()) call.close();
      else liveCallRef.current = call;
      if (!current()) {
        call.close();
        await request(`/v1/voice/sessions/${sessionId}/stop`, auth.token, "POST", { consumedSeconds: 0 }).catch(() => undefined);
        return;
      }
      const expiresAt = Date.parse(result.expiresAt);
      sessionTimer.current = setTimeout(() => { void stopLiveVoice(); }, Number.isFinite(expiresAt) ? Math.max(0, Math.min(420000, expiresAt - Date.now())) : 420000);
      setLiveCall(call); setLiveSessionId(result.sessionId); setLiveStartedAt(Date.now()); setLiveMessage("Coach is listening. Speak naturally; the prompt is being spoken aloud."); setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: result.conversation.state } } : current);
    } catch (failure) {
      call?.close();
      if (liveCallRef.current === call) liveCallRef.current = null;
      if (sessionId) await request(`/v1/voice/sessions/${sessionId}/stop`, auth.token, "POST", { consumedSeconds: 0 }).catch(() => undefined);
      if (sessionRef.current?.id === sessionId) sessionRef.current = null;
      if (current()) setLiveMessage((failure as Error).message);
    }
    finally { if (current()) setLiveBusy(false); }
  }

  async function stopLiveVoice() {
    connectionGeneration.current += 1;
    connectionAbort.current?.abort();
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    liveCallRef.current?.close(); liveCallRef.current = null;
    if (stopPromise.current) return stopPromise.current;
    const session = sessionRef.current;
    if (!session) { if (mounted.current) { setLiveBusy(false); setLiveCall(null); } return; }
    sessionRef.current = null;
    if (mounted.current) setLiveBusy(true);
    const consumedSeconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
    const pending = (async () => {
      try {
        await withDeadline(transcriptQueue.current, 5000).catch(() => { transcriptFailure.current = true; });
        const result = await request<{ consumedSeconds: number }>(
          "/v1/voice/sessions/" + session.id + "/stop", session.token, "POST", { consumedSeconds },
        );
        if (mounted.current) {
          setLiveMessage("Live practice ended. " + result.consumedSeconds + " seconds were charged to your allowance.");
          setPractice(current => current ? { ...current, conversation: { ...current.conversation, state: "INTERRUPTED" } } : current);
        }
      } catch (failure) { if (mounted.current) setError((failure as Error).message); }
      finally {
        stopPromise.current = null;
        if (mounted.current) { setLiveCall(null); setLiveSessionId(""); setLiveStartedAt(null); setLiveBusy(false); }
      }
    })();
    stopPromise.current = pending;
    return pending;
  }

  const isSpeaking = promptState === "speaking";
  const canStartLive = Platform.OS !== "web" && ["CREATED", "INTERRUPTED"].includes(practice.conversation.state);
  const statusText = isSpeaking ? "Coach is speaking" : promptState === "ready" ? "Your turn to speak" : "Ready when you are";
  return <Screen>
    <Heading eyebrow={`${module?.title ?? "Practice"} · ${practicePrograms[practice.scenario.level - 1]?.title ?? "Practice programme"}`}>{practice.scenario.title.replace(/\s*·\s*(?:Clarity foundation|Structured message|Evidence and trade-offs|Audience adaptation|Leadership transfer)$/i, "")}</Heading>
    <Copy>Session status: {practice.conversation.state} · Created {new Date(practice.conversation.createdAt).toLocaleString()}</Copy>
    {practice.conversation.state === "FEEDBACK_READY" &&
      <Action title="Review your feedback" onPress={() => router.push(`/feedback/${id}`)} />}
    {practice.feedbackRetryAvailable && <Card>
      <Heading eyebrow="Responses saved">Try feedback again</Heading>
      <Copy>The review was interrupted or could not be verified. Retrying uses your daily feedback allowance.</Copy>
      <Action title="Try feedback again" busy={finishing} disabled={finishing}
        onPress={() => void finishPractice(true)} />
    </Card>}
    {practice.conversation.state === "ASSESSING" && <Card>
      <Copy>Your feedback is being reviewed. Check again shortly; you do not need to resubmit your responses.</Copy>
      <Action title="Check feedback status" onPress={() => void refreshPractice().catch(failure => setError(failure.message))} />
    </Card>}
    {primaryResponse && !retryStarted && ["CREATED", "INTERRUPTED"].includes(practice.conversation.state) &&
      <Action title="Ready for the new situation" disabled={liveBusy || Boolean(liveCall) || saving}
        busy={saving} onPress={() => void advancePractice()} />}
    <Card tone="accent">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="spark" size={19} color={theme.ink} /><Text style={{ color: theme.ink, fontWeight: "700", letterSpacing: 1.5, fontSize: 12 }}>CONVERSATION MODE</Text></View>
      <Heading eyebrow="Coach prompt">Speak to the situation, not a script.</Heading>
      <Copy>{practice.scenario.context}</Copy>
      <Copy>{retryStarted ? `Independent retry: ${practice.scenario.independentQuestion}` : practice.scenario.question}</Copy>
      <Copy>Focus: {practice.scenario.focus}</Copy>
      <Disclosure summary="Feeling stuck? Show what to cover">
        <Copy>Start with the situation: {practice.scenario.context}</Copy>
        <Copy>1. Say your main point in one sentence.</Copy>
        <Copy>2. Give one relevant fact or example. Say what you do not yet know.</Copy>
        <Copy>3. Explain why it matters to the person listening.</Copy>
        <Copy>4. Finish with a next step, owner, or question.</Copy>
        <Copy>Try opening with: “Here is what I know so far…” You can pause, look at these points, and begin again.</Copy>
      </Disclosure>
      <Copy>Coach voice: {voiceAccent}. The installed device voice supplies the final pronunciation.</Copy>
      <VoiceWave active={isSpeaking} color={theme.ink} />
      <MicButton active={isSpeaking} label={isSpeaking ? "Stop voice prompt" : promptState === "ready" ? "Record your answer" : "Hear prompt"} onPress={isSpeaking ? stopSpeaking : promptState === "ready" ? () => router.push("/voice") : speakPrompt} />
      <Text style={{ color: theme.ink, textAlign: "center", fontWeight: "700", fontSize: 17 }}>{statusText}</Text>
      <Copy>{speechMessage || (promptState === "ready" ? "Tap the microphone to record your answer." : "Tap the microphone and let the coach set the scene out loud.")}</Copy>
      {isSpeaking && <Action title="Stop speaking" secondary icon="mic" onPress={stopSpeaking} />}
      <Copy>Live AI voice sends microphone audio and transcripts to the AI provider. Transcripts are saved to your practice history. Avoid confidential information.</Copy>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Switch accessibilityLabel="Allow live AI audio and transcript processing" value={voiceConsent} onValueChange={setVoiceConsent} /><View style={{ flex: 1 }}><Copy>I agree to start live AI audio and transcript processing.</Copy></View></View>
      <Action title={liveCall ? "Stop live coach" : Platform.OS === "web" ? "Live voice requires the mobile app" : practice.liveVoiceAvailable ? "Start AI live coach" : "AI live coach unavailable"}
        icon="mic" disabled={liveBusy || (!liveCall && (!voiceConsent || !canStartLive || !practice.liveVoiceAvailable))}
        busy={liveBusy} onPress={() => void (liveCall ? stopLiveVoice() : startLiveVoice())} />
      {(Platform.OS === "web" || !practice.liveVoiceAvailable) && <Copy>Live AI requires an enabled server voice provider and a verified Android/iOS WebRTC build. Text practice and local microphone recording remain available; this button stays disabled until those checks pass.</Copy>}
      {Boolean(liveMessage) && <Copy>{liveMessage}</Copy>}
    </Card>
    <Card><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="client" size={22} color={theme.accent} /><Heading eyebrow="Your turn">Make it conversational</Heading></View><Copy>Answer out loud as if a real colleague were in front of you. Use the local audio check to record and play back your response while live AI voice is being connected.</Copy><Action title="Open microphone check" icon="recording" onPress={() => router.push("/voice")} /></Card>
    <Card>
      <Heading eyebrow={retryStarted ? "Independent retry" : "Text fallback"}>
        {retryStarted ? "Try the situation again." : "Write your response"}
      </Heading>
      <Copy>{textPracticeDescription(practice.assessmentEnabled, retryStarted)}</Copy>
      {["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && !retryCompleted && <>
        <TextInput accessibilityLabel={retryStarted ? "Your independent retry" : "Your practice response"}
          placeholder={retryStarted ? "Answer the new situation in your own words…" : "Type what you would say…"}
          value={draft} onChangeText={setDraft} multiline maxLength={10000} textAlignVertical="top"
          style={{ minHeight: 120, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12,
            color: theme.ink, backgroundColor: theme.surface }} />
        <Action title={retryStarted ? "Save independent retry" : "Save primary response"} disabled={!draft.trim()}
          busy={saving} onPress={() => void saveResponse()} />
      </>}
      {["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && retryStarted && !retryCompleted &&
        <Copy>Complete the independent retry before finishing this practice.</Copy>}
      {["CREATED", "INTERRUPTED"].includes(practice.conversation.state) && retryCompleted &&
        <Action title="Finish practice" secondary disabled={finishing} busy={finishing} onPress={() => void finishPractice()} />}
      {Boolean(savedMessage) && <Copy>{savedMessage}</Copy>}
      {Boolean(error) && <Copy error>{error}</Copy>}
      {practice.turns.length > 0 && <Copy>
        {practice.turns.length} response{practice.turns.length === 1 ? "" : "s"} saved. No assistant turns have been added.
      </Copy>}
    </Card>
    <Card><Heading eyebrow="Live AI voice">Conversational mode</Heading><Copy>The live coach uses a short-lived server-issued session key. Your standard API key never enters the mobile app. Stop the session when you finish so the server can settle your allowance.</Copy></Card>
    {practice.turns.some(turn => turn.role === "assistant") && <ReportContent conversationId={id} target="voice" />}
    <Action title="Back to today" secondary onPress={() => router.replace("/home")} />
  </Screen>;
}

function accentLanguage(accent: CoachAccent) { return ({ "Indian English": "en-IN", "British English": "en-GB", "American English": "en-US", "Australian English": "en-AU" } as const)[accent]; }
