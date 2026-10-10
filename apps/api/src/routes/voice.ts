import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { isPublishedScenario, voiceTransportStatus } from "@coach/core";
import { z } from "zod";
import { ProviderUnavailableError, startLiveConversation } from "../conversation-service";
import { authenticate } from "../lib/auth-context";
import { dayKey, elapsedSeconds, monthKey, nextMonthReset, nextReset } from "../lib/time";
import { ApiError } from "../lib/errors";
import type { VoiceSession } from "../store";
import type { RouteDependencies } from "./context";

const voiceSessionSchema = z.object({ conversationId: z.string().uuid(), scenarioId: z.string().min(1).max(100) }).strict();
const voiceStopSchema = z.object({ consumedSeconds: z.number().int().min(0).max(420).default(0) }).strict().default({});
const voiceProviderCallSchema = z.object({ providerCallId: z.string().regex(/^[A-Za-z0-9._:-]{1,200}$/) }).strict();
const voiceTranscriptSchema = z.object({
  role: z.enum(["user", "assistant"]),
  phase: z.unknown().optional(),
  text: z.string().trim().min(1).max(10000),
}).strict();

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/me/voice-usage", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    const timezone = profile?.timezone ?? "Asia/Kolkata";
    const today = dayKey(deps.now(), timezone);
    const dailyUsage = await deps.store.usage(user.id, today);
    const plan = await deps.activePlan(user.id);
    const currentMonth = monthKey(deps.now(), timezone);
    const monthlyUsage = await deps.store.voiceMonthUsage(user.id, currentMonth);
    const freeTier = plan.id === "free";
    const sessionsUsed = freeTier ? await deps.store.totalVoiceSessions(user.id) : monthlyUsage.sessionsUsed;
    const sessionsRemaining = Math.max(0, plan.voiceSessionsPerMonth - sessionsUsed);
    return {
      planId: plan.id,
      planTitle: plan.title,
      timezone,
      dayKey: today,
      monthKey: currentMonth,
      sessionsUsedThisMonth: monthlyUsage.sessionsUsed,
      sessionsRemainingThisMonth: freeTier ? null : sessionsRemaining,
      sessionsAllowed: plan.voiceSessionsPerMonth,
      sessionsRemaining,
      lifetimeFreeLimit: freeTier,
      consumedSecondsThisMonth: monthlyUsage.consumedSeconds,
      maxSessionSeconds: plan.maxSessionSeconds,
      reservedSecondsToday: dailyUsage.reservedSeconds,
      consumedSecondsToday: dailyUsage.consumedSeconds,
      resetsAt: nextReset(deps.now(), timezone),
      monthResetsAt: nextMonthReset(deps.now(), timezone),
      enforcement: "server_reservations" as const,
      liveVoiceAvailable: deps.realtimeConfigured,
    };
  });
  app.get("/v1/voice/readiness", async request => {
    await authenticate(request, deps);
    return deps.realtimeConfigured
      ? { available: true, code: "SERVER_PROVIDER_READY", message: "The coach voice provider is configured. Use an Android or iOS development build for the live conversation." }
      : { available: false, code: "PROVIDER_NOT_CONFIGURED", message: "Live AI voice is not configured on the server. You can still test your microphone locally; no audio is sent to an AI provider." };
  });
  app.get("/v1/voice/capabilities", async request => {
    await authenticate(request, deps);
    const requestedPlatform = request.query && typeof request.query === "object" ? (request.query as { platform?: string }).platform : undefined;
    const requestedCapabilities = request.query && typeof request.query === "object"
      ? request.query as { nativeModuleAvailable?: string; developmentBuild?: string }
      : {};
    const platform = requestedPlatform === "android" || requestedPlatform === "ios" ? requestedPlatform : "web";
    return voiceTransportStatus({
      platform,
      nativeModuleAvailable: requestedCapabilities.nativeModuleAvailable === "true",
      developmentBuild: requestedCapabilities.developmentBuild === "true",
      providerConfigured: deps.realtimeConfigured,
    });
  });
  app.post("/v1/voice/sessions", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    if (request.headers.origin) throw new ApiError(403, "Live voice requires an Android or iOS development build.");
    if (await deps.store.activeVoiceSession(user.id)) throw new ApiError(409, "Finish your active voice session before starting another.");
    if (!deps.realtimeProvider) {
      return reply.code(503).send({ error: "Live voice is disabled pending provider configuration and native transport verification." });
    }
    const parsed = voiceSessionSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid conversation and scenario.");
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversation = await deps.store.conversation(user.id, parsed.data.conversationId);
    const scenario = (await deps.availableScenarios()).filter(isPublishedScenario).find(item => item.id === parsed.data.scenarioId);
    if (!conversation || conversation.scenarioId !== parsed.data.scenarioId || !scenario) throw new ApiError(404, "Practice conversation not found.");
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "Practice is not ready for voice.");
    const plan = await deps.activePlan(user.id);
    const currentMonth = monthKey(deps.now(), profile.timezone);
    const lifetimeLimit = plan.id === "free";
    const allowanceSeconds = plan.voiceSessionsPerMonth * plan.maxSessionSeconds;
    const maximumSeconds = Math.min(profile.practiceMinutes * 60, plan.maxSessionSeconds);
    try {
      await deps.store.reserveVoiceSession(user.id, currentMonth, plan.voiceSessionsPerMonth, lifetimeLimit);
    } catch (error) {
      if (error instanceof Error && error.message.includes("allowance is exhausted")) {
        throw new ApiError(409, lifetimeLimit ? "Your two free voice sessions have been used." : "Your monthly voice sessions are used. They reset at the start of next month.");
      }
      throw error;
    }
    let sessionSlotReserved = true;
    try {
      const result = await startLiveConversation({
        store: deps.store,
        provider: deps.realtimeProvider,
        userId: user.id,
        conversationId: conversation.id,
        scenarioId: scenario.id,
        instructions: conversation.currentPhase === "independent_retry"
          ? `Present this new situation: ${scenario.independentQuestion}. Then listen independently. Never score during the call.`
          : `Set the scene: ${scenario.context} ${scenario.question}. Let the learner respond. Ask at most 2 probing questions.
             Give no feedback and never score during the call. Do not begin the independent retry.`,
        dayKey: dayKey(deps.now(), profile.timezone),
        allowanceSeconds,
        maximumSeconds,
        now: () => deps.now(),
      });
      const timestamp = deps.now();
      const expiresAt = new Date(Math.min(result.connection.expiresAt.getTime(), timestamp.getTime() + maximumSeconds * 1000));
      const session: VoiceSession = {
        id: randomUUID(),
        userId: user.id,
        conversationId: conversation.id,
        reservationId: result.reservationId,
        monthKey: currentMonth,
        providerSessionId: result.connection.providerSessionId,
        providerCallId: null,
        providerTerminatedAt: null,
        status: "active",
        startedAt: timestamp,
        expiresAt,
        endedAt: null,
      };
      try {
        await deps.store.createVoiceSession(session);
        sessionSlotReserved = false;
      } catch (error) {
        await deps.store.settleUsage(result.reservationId, 0);
        await deps.store.releaseVoiceSession(user.id, currentMonth, lifetimeLimit);
        sessionSlotReserved = false;
        await deps.store.updateConversationState(user.id, conversation.id, "FAILED").catch(() => undefined);
        if (error instanceof Error && error.message.includes("already active")) throw new ApiError(409, "Finish your active voice session before starting another.");
        throw error;
      }
      return reply.code(201).send({
        sessionId: session.id,
        conversation: { id: conversation.id, state: result.state },
        reservationId: result.reservationId,
        clientSecret: result.connection.clientSecret,
        model: deps.realtimeModel,
        expiresAt: session.expiresAt.toISOString(),
        providerSessionCreated: true,
        liveVoiceAvailable: false,
        message: "Provider session created. Native WebRTC transport remains gated until device verification.",
      });
    } catch (error) {
      if (sessionSlotReserved) await deps.store.releaseVoiceSession(user.id, currentMonth, lifetimeLimit).catch(() => undefined);
      if (error instanceof ProviderUnavailableError) throw new ApiError(503, "The live voice provider is temporarily unavailable.");
      throw error;
    }
  });
  app.post("/v1/voice/sessions/:id/bind", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    const parsed = voiceProviderCallSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid provider call identifier.");
    const session = await deps.store.bindVoiceProviderCall(user.id, id, parsed.data.providerCallId);
    return reply.send({ sessionId: session.id, providerCallId: session.providerCallId, message: "Provider call bound for server-side termination." });
  });
  app.post("/v1/voice/sessions/:id/transcript", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    const parsed = voiceTranscriptSchema.safeParse(request.body);
    if (!id || !parsed.success) throw new ApiError(400, "Provide a valid voice transcript.");
    const session = await deps.store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "The voice session is already closed.");
    const turn = await deps.store.appendConversationTurn(user.id, {
      id: randomUUID(),
      sessionId: session.conversationId,
      role: parsed.data.role,
      text: parsed.data.text,
      createdAt: deps.now(),
    });
    return reply.code(201).send({ turn: { ...turn, createdAt: turn.createdAt.toISOString() }, message: "Voice transcript saved." });
  });
  app.post("/v1/voice/sessions/:id/stop", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A voice session id is required.");
    const parsed = voiceStopSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Provide a valid consumed duration.");
    const session = await deps.store.voiceSession(user.id, id);
    if (!session) return reply.code(404).send({ error: "Voice session not found." });
    if (session.status !== "active") throw new ApiError(409, "Voice session is already closed.");
    let providerTermination: "completed" | "not_bound" | "failed" = "not_bound";
    if (deps.realtimeProvider && session.providerCallId) {
      try {
        await deps.realtimeProvider.terminate(session.providerCallId);
        await deps.store.markVoiceProviderTerminated(session.id, deps.now());
        providerTermination = "completed";
      } catch {
        providerTermination = "failed";
      }
    }
    const endedAt = deps.now();
    const reservedSeconds = await deps.store.reservationSeconds(session.reservationId);
    if (reservedSeconds === null) throw new ApiError(409, "Voice usage reservation is no longer available.");
    const consumedSeconds = elapsedSeconds(session.startedAt, endedAt, reservedSeconds);
    if (parsed.data.consumedSeconds > consumedSeconds) {
      request.log.debug({ clientConsumedSecondsHint: parsed.data.consumedSeconds, serverConsumedSeconds: consumedSeconds }, "Voice usage hint exceeds server elapsed time");
    }
    await deps.store.endVoiceSession(user.id, id, endedAt, "ended", consumedSeconds);
    const conversation = await deps.store.conversation(user.id, session.conversationId);
    if (conversation?.state === "ACTIVE") await deps.store.updateConversationState(user.id, session.conversationId, "INTERRUPTED");
    return { sessionId: id, status: "ended", consumedSeconds, conversationState: "INTERRUPTED", providerTermination };
  });
}
