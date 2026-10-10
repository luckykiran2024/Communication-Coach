import { createRealtimeClientSecret } from "./realtime-provider";
import type { VoiceConnection, VoiceProvider } from "./voice-provider";

export class RealtimeVoiceProvider implements VoiceProvider {
  readonly name = "openai-realtime";
  constructor(private readonly input: { apiKey: string; model: string; voice: string; fetchImpl?: typeof fetch }) {}
  async connect(connection: { userId: string; scenarioId: string; maximumSeconds: number; instructions?: string; signal: AbortSignal }): Promise<VoiceConnection> {
    if (connection.signal.aborted) throw new Error("Voice connection was cancelled.");
    const secret = await createRealtimeClientSecret({
      apiKey: this.input.apiKey,
      safetyIdentifier: connection.userId,
      model: this.input.model,
      voice: this.input.voice,
      instructions: connection.instructions ?? `Coach the learner through scenario ${connection.scenarioId}. Keep the conversation concise, supportive and focused on the practice prompt.`,
      expiresAfterSeconds: connection.maximumSeconds,
      signal: connection.signal,
      fetchImpl: this.input.fetchImpl,
    });
    return { providerSessionId: secret.sessionId, expiresAt: new Date(secret.expiresAt), clientSecret: secret.value };
  }
  async terminate(providerCallId: string) {
    const response = await (this.input.fetchImpl ?? fetch)(
      `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(providerCallId)}/hangup`, {
        method: "POST", signal: AbortSignal.timeout(10000), redirect: "error",
        headers: { Authorization: `Bearer ${this.input.apiKey}`, "OpenAI-Safety-Identifier": providerCallId },
      },
    );
    if (!response.ok) throw new Error("Realtime provider did not terminate the call.");
  }
}
