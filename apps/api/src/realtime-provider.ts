export type RealtimeClientSecret = { value: string; expiresAt: string; sessionId: string };

export class RealtimeProviderError extends Error {}

type RealtimeResponse = { value?: unknown; expires_at?: unknown; session?: { id?: unknown } };

export async function createRealtimeClientSecret(input: {
  apiKey: string;
  safetyIdentifier: string;
  model: string;
  voice: string;
  instructions: string;
  expiresAfterSeconds: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<RealtimeClientSecret> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": input.safetyIdentifier,
    },
    signal: input.signal,
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: Math.max(10, Math.min(7200, Math.round(input.expiresAfterSeconds))) },
      session: { type: "realtime", model: input.model, instructions: input.instructions, audio: { input: { transcription: { model: "gpt-4o-mini-transcribe", language: "en" } }, output: { voice: input.voice } } },
    }),
  });
  const data = await response.json().catch(() => null) as RealtimeResponse | null;
  if (!response.ok || typeof data?.value !== "string" || typeof data.expires_at !== "number" || typeof data.session?.id !== "string") {
    throw new RealtimeProviderError("Realtime provider did not create a valid client secret.");
  }
  return { value: data.value, expiresAt: new Date(data.expires_at * 1000).toISOString(), sessionId: data.session.id };
}
