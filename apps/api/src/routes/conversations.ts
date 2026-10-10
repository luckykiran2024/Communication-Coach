import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  assessCommunicationEvidence,
  conversationCreateSchema,
  isPublishedScenario,
  recommendScenarios,
  userConversationTurnSchema,
} from "@coach/core";
import { authenticate } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.get("/v1/me/conversations", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const catalog = await deps.availableScenarios();
    const items = (await deps.store.conversations(user.id, 10))
      .map(conversation => ({
        conversation: {
          id: conversation.id,
          scenarioId: conversation.scenarioId,
          state: conversation.state,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        },
        scenario: conversation.scenarioSnapshot ?? catalog.find(item => item.id === conversation.scenarioId),
      }))
      .filter(item => item.scenario);
    return { conversations: items };
  });
  app.get("/v1/me/export", async request => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const conversations = await deps.store.conversations(user.id);
    const records = await Promise.all(conversations.map(async conversation => ({
      conversation: {
        id: conversation.id,
        scenarioId: conversation.scenarioId,
        scenarioSnapshot: conversation.scenarioSnapshot,
        state: conversation.state,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      },
      turns: await deps.store.conversationTurns(user.id, conversation.id),
    })));
    return { exportedAt: deps.now().toISOString(), user: { id: user.id, email: user.email }, profile, conversations: records };
  });
  app.post("/v1/me/conversations", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const profile = await deps.store.profile(user.id);
    if (!profile) throw new ApiError(409, "Complete your profile first.");
    const parsed = conversationCreateSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a valid practice scenario.");
    const progress = await deps.learnerScenarioProgress(user.id, profile);
    const includedModules = (await deps.activePlan(user.id)).modules;
    const eligibleScenarios = (await deps.availableScenarios())
      .filter(item => isPublishedScenario(item) && includedModules.includes(item.module));
    const scenario = recommendScenarios(profile, eligibleScenarios, progress.mastery.level, progress.completedScenarioIds)
      .find(item => item.id === parsed.data.scenarioId);
    if (!scenario) throw new ApiError(403, "That scenario is not available for this profile.");
    const timestamp = deps.now();
    const conversation = {
      id: randomUUID(),
      userId: user.id,
      scenarioId: scenario.id,
      scenarioSnapshot: scenario,
      state: "CREATED" as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await deps.store.createConversation(conversation);
    return reply.code(201).send({
      conversation: { id: conversation.id, scenarioId: scenario.id, state: conversation.state, createdAt: timestamp.toISOString() },
      scenario,
      liveVoiceAvailable: false,
      message: "Practice session created. Live AI voice is not connected yet.",
    });
  });
  app.get("/v1/me/conversations/:id", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    const profile = await deps.store.profile(user.id);
    const scenario = conversation.scenarioSnapshot ?? (profile ? (await deps.availableScenarios()).find(item => item.id === conversation.scenarioId) : undefined);
    if (!scenario) return reply.code(404).send({ error: "Conversation scenario is no longer available." });
    return {
      conversation: { ...conversation, createdAt: conversation.createdAt.toISOString(), updatedAt: conversation.updatedAt.toISOString() },
      scenario,
      turns: await deps.store.conversationTurns(user.id, id),
      liveVoiceAvailable: false,
    };
  });
  app.post("/v1/me/conversations/:id/turns", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(conversation.state)) {
      throw new ApiError(409, "This practice session cannot accept another response.");
    }
    const parsed = userConversationTurnSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Enter a response between 1 and 10,000 characters.");
    const turn = {
      id: randomUUID(),
      sessionId: id,
      role: "user" as const,
      phase: parsed.data.phase,
      text: parsed.data.text,
      createdAt: deps.now(),
    };
    await deps.store.addConversationTurn(turn);
    return reply.code(201).send({
      turn: { ...turn, createdAt: turn.createdAt.toISOString() },
      message: parsed.data.phase === "independent_retry"
        ? "Independent retry saved. Complete the practice to record your evidence."
        : "Primary response saved. Now try the independent retry.",
    });
  });
  app.post("/v1/me/conversations/:id/complete", async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const id = (request.params as { id?: string }).id;
    if (!id) throw new ApiError(400, "A conversation id is required.");
    const conversation = await deps.store.conversation(user.id, id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found." });
    if (!["CREATED", "INTERRUPTED"].includes(conversation.state)) throw new ApiError(409, "This practice session is already closed.");
    const turns = await deps.store.conversationTurns(user.id, id);
    if (!turns.some(turn => turn.role === "user" && turn.phase === "primary")) {
      throw new ApiError(409, "Save your primary response before finishing practice.");
    }
    if (!turns.some(turn => turn.role === "user" && turn.phase === "independent_retry")) {
      throw new ApiError(409, "Complete the independent retry before finishing practice.");
    }
    const primary = turns.find(turn => turn.role === "user" && turn.phase === "primary");
    const retry = [...turns].reverse().find(turn => turn.role === "user" && turn.phase === "independent_retry");
    const evidence = primary && retry ? assessCommunicationEvidence({ primary: primary.text, retry: retry.text }) : null;
    const completed = await deps.store.updateConversationState(user.id, id, "COMPLETED");
    return {
      conversation: { id: completed.id, state: completed.state, completedAt: completed.updatedAt.toISOString() },
      evidence: evidence ? { score: evidence.score, passed: evidence.passed } : null,
      message: evidence?.passed
        ? "Practice completed. Your independent retry met the local evidence checks."
        : "Practice completed. More evidence is needed before this retry counts as successful.",
    };
  });
}
