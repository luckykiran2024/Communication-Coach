export type VoiceConnection = { providerSessionId: string; expiresAt: Date; clientSecret?: string };
export interface VoiceProvider {
  readonly name: string;
  connect(input: { userId: string; scenarioId: string; maximumSeconds: number; instructions?: string; signal: AbortSignal }): Promise<VoiceConnection>;
  terminate(providerSessionId: string): Promise<void>;
}
