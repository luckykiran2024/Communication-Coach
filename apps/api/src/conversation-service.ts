import { randomUUID } from "node:crypto";
import { transition, type SessionState } from "@coach/core";
import type { Store } from "./store";
import type { VoiceProvider } from "./voice-provider";

export class ProviderUnavailableError extends Error {}

export async function startLiveConversation(input: {
  store: Store;
  provider: VoiceProvider;
  userId: string;
  conversationId: string;
  scenarioId: string;
  instructions?: string;
  dayKey: string;
  allowanceSeconds: number;
  maximumSeconds: number;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  const conversation = await input.store.conversation(input.userId, input.conversationId);
  if (!conversation || conversation.scenarioId !== input.scenarioId) throw new Error("Conversation not found");
  if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new Error("Conversation is not ready to start");
  const reservationId = randomUUID();
  await input.store.reserveUsage({ id: reservationId, userId: input.userId, dayKey: input.dayKey, seconds: input.maximumSeconds, expiresAt: new Date(now().getTime() + input.maximumSeconds * 1000) }, input.allowanceSeconds);
  try {
    let state: SessionState = transition(conversation.state, "AUTHORIZED");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    state = transition(state, "CONNECTING");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    const connection = await input.provider.connect({ userId: input.userId, scenarioId: input.scenarioId, maximumSeconds: input.maximumSeconds, instructions: input.instructions, signal: AbortSignal.timeout(input.maximumSeconds * 1000) });
    state = transition(state, "ACTIVE");
    await input.store.updateConversationState(input.userId, input.conversationId, state);
    return { reservationId, state, connection };
  } catch (error) {
    await input.store.settleUsage(reservationId, 0);
    await input.store.updateConversationState(input.userId, input.conversationId, "FAILED").catch(() => undefined);
    throw new ProviderUnavailableError(error instanceof Error ? error.message : "Voice provider unavailable");
  }
}
