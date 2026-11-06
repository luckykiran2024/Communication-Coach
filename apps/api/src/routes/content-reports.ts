import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireManager } from "../lib/auth-context";
import { ApiError } from "../lib/errors";
import type { RouteDependencies } from "./context";

const reportSchema = z.object({ conversationId: z.string().uuid(), target: z.enum(["feedback", "voice"]),
  reason: z.enum(["offensive", "unsafe", "incorrect", "other"]), details: z.string().trim().max(1000).default("") }).strict();

export function register(app: FastifyInstance, deps: RouteDependencies) {
  app.post("/v1/me/content-reports", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const { user } = await authenticate(request, deps);
    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError(400, "Choose a report reason and keep details within 1,000 characters.");
    const conversation = await deps.store.conversation(user.id, parsed.data.conversationId);
    if (!conversation) throw new ApiError(404, "Practice not found.");
    const hasContent = parsed.data.target === "feedback"
      ? Boolean(await deps.store.assessment(user.id, conversation.id))
      : (await deps.store.conversationTurns(user.id, conversation.id)).some(turn => turn.role === "assistant");
    if (!hasContent) throw new ApiError(409, "There is no saved AI content to report yet.");
    const id = randomUUID();
    await deps.store.saveContentReport({ ...parsed.data, id, userId: user.id, status: "open", createdAt: deps.now(), resolvedAt: null });
    return reply.code(201).send({ id, message: "Report received for review. Thank you." });
  });
  app.get("/v1/manager/content-reports", async request => {
    await requireManager(request, deps);
    return { reports: await deps.store.contentReports() };
  });
  app.get("/v1/manager/content-reports/:id", async request => {
    await requireManager(request, deps);
    const id = (request.params as { id: string }).id;
    const report = z.string().uuid().safeParse(id).success ? await deps.store.contentReport(id) : null;
    if (!report) throw new ApiError(404, "Report not found.");
    return { report, conversation: await deps.store.conversation(report.userId, report.conversationId),
      turns: await deps.store.conversationTurns(report.userId, report.conversationId),
      assessment: report.target === "feedback" ? await deps.store.assessment(report.userId, report.conversationId) : null };
  });
  app.post("/v1/manager/content-reports/:id/resolve", async request => {
    await requireManager(request, deps);
    const id = (request.params as { id: string }).id;
    if (!z.string().uuid().safeParse(id).success || !await deps.store.resolveContentReport(id, deps.now())) throw new ApiError(404, "Open report not found.");
    return { resolved: true };
  });
}
