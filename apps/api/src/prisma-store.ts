import { Prisma, PrismaClient } from "@prisma/client";
import { profileSchema, scenarioSchema, type Profile, type Scenario, states, type SessionState } from "@coach/core";
import { ConflictError, type Account, type ConversationTurn, type Entitlement, type OAuthIdentity, type PurchaseIntent, type ScenarioRevision, type Store, type VoiceSession } from "./store";
type AccountRow = { id: string; email: string; passwordHash: string; role: string };
const accountFromRow = (row: AccountRow): Account => ({ id: row.id, email: row.email, passwordHash: row.passwordHash, role: row.role === "manager" ? "manager" : "learner" });
const accountFromNullableRow = (row: AccountRow | null): Account | null => row ? accountFromRow(row) : null;
export function prismaStore(db: PrismaClient): Store {
  return {
    async ready() { await db.$queryRaw`SELECT 1`; },
    async createAccount(email, passwordHash) {
      try { return accountFromRow(await db.user.create({ data: { email, passwordHash } })); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError();
        throw error;
      }
    },
    async accountByEmail(email) { return accountFromNullableRow(await db.user.findUnique({ where: { email } })); },
    async accountById(id) { return accountFromNullableRow(await db.user.findUnique({ where: { id } })); },
    async oauthIdentity(provider: OAuthIdentity["provider"], subject: string) {
      const row = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider, subject } } });
      return row ? { ...row, provider: row.provider as OAuthIdentity["provider"] } : null;
    },
    async saveOAuthIdentity(identity: OAuthIdentity) {
      try { await db.oAuthIdentity.create({ data: identity }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("This provider identity is already linked to another account."); throw error; }
    },
    async createSession(session) { await db.authSession.create({ data: session }); },
    sessionByHash: tokenHash => db.authSession.findUnique({ where: { tokenHash } }),
    async deleteSession(tokenHash) { await db.authSession.deleteMany({ where: { tokenHash } }); },
    async deleteSessions(userId) { await db.authSession.deleteMany({ where: { userId } }); },
    async deleteAccount(userId) { await db.user.delete({ where: { id: userId } }); },
    async profile(userId) {
      const stored = await db.userProfile.findUnique({ where: { userId } });
      return stored ? profileSchema.parse(stored.data) : null;
    },
    async saveProfile(userId: string, profile: Profile) {
      await db.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        const existing = await transaction.userProfile.findUnique({ where: { userId } });
        if (existing && existing.timezone !== profile.timezone) throw new ConflictError("Timezone changes require support");
        const data = { data: profile, timezone: profile.timezone };
        await transaction.userProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
      });
    },
    async usage(userId, dayKey) {
      const rows = await db.usageReservation.aggregate({
        where: { userId, dayKey },
        _sum: { reservedSeconds: true, consumedSeconds: true },
      });
      return { reservedSeconds: rows._sum.reservedSeconds ?? 0, consumedSeconds: rows._sum.consumedSeconds ?? 0 };
    },
    async reserveUsage(reservation, allowanceSeconds) {
      await db.$transaction(async transaction => {
        const rows = await transaction.usageReservation.aggregate({
          where: { userId: reservation.userId, dayKey: reservation.dayKey },
          _sum: { reservedSeconds: true, consumedSeconds: true },
        });
        const reserved = rows._sum.reservedSeconds ?? 0;
        const consumed = rows._sum.consumedSeconds ?? 0;
        if (reserved + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
        await transaction.usageReservation.create({ data: { ...reservation, reservedSeconds: reservation.seconds } });
      });
    },
    async settleUsage(reservationId, consumedSeconds) {
      if (!Number.isInteger(consumedSeconds) || consumedSeconds < 0) throw new Error("Invalid usage settlement");
      await db.$transaction(async transaction => {
        const reservation = await transaction.usageReservation.findUnique({ where: { id: reservationId } });
        if (!reservation) throw new Error("Usage reservation not found");
        const settled = Math.min(consumedSeconds, reservation.reservedSeconds);
        await transaction.usageReservation.update({ where: { id: reservationId }, data: { reservedSeconds: settled, consumedSeconds: settled } });
      });
    },
    async createConversation(conversation) {
      await db.conversation.create({ data: { id: conversation.id, userId: conversation.userId, scenarioId: conversation.scenarioId, scenarioData: conversation.scenarioSnapshot, state: conversation.state, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt } });
    },
    async conversation(userId, id) {
      const row = await db.conversation.findFirst({ where: { id, userId } });
      if (!row || !states.includes(row.state as SessionState)) return null;
      return { ...row, scenarioSnapshot: row.scenarioData ? scenarioSchema.parse(row.scenarioData) : undefined, state: row.state as SessionState };
    },
    async conversations(userId, limit) {
      const rows = await db.conversation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...(limit === undefined ? {} : { take: Math.min(Math.max(limit, 1), 20) }) });
      return rows.filter(row => states.includes(row.state as SessionState)).map(row => ({ ...row, scenarioSnapshot: row.scenarioData ? scenarioSchema.parse(row.scenarioData) : undefined, state: row.state as SessionState }));
    },
    async updateConversationState(userId, id, state) {
      const row = await db.conversation.updateMany({ where: { id, userId }, data: { state } });
      if (row.count !== 1) throw new Error("Conversation not found");
      const updated = await db.conversation.findUniqueOrThrow({ where: { id } });
      return { ...updated, scenarioSnapshot: updated.scenarioData ? scenarioSchema.parse(updated.scenarioData) : undefined, state: updated.state as SessionState };
    },
    async addConversationTurn(turn) {
      await db.conversationTurn.create({ data: turn });
    },
    async conversationTurns(userId, sessionId) {
      const owner = await db.conversation.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
      if (!owner) return [];
      const turns = await db.conversationTurn.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
      return turns.map(turn => ({ ...turn, role: turn.role as ConversationTurn["role"], phase: turn.phase as ConversationTurn["phase"] }));
    },
    async customScenarios() {
      const rows = await db.customScenario.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map(row => scenarioSchema.parse(row.data));
    },
    async createCustomScenario(scenario: Scenario) {
      try { await db.$transaction(async transaction => { await transaction.customScenario.create({ data: { id: scenario.id, data: scenario } }); await transaction.customScenarioRevision.create({ data: { scenarioId: scenario.id, version: 1, data: scenario, changedBy: scenario.ownerId ?? undefined } }); }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("A scenario with this id already exists."); throw error; }
    },
    async reviewCustomScenario(id: string, status: "draft" | "published" | "deprecated", reviewerId: string | null, reviewedAt: Date) {
      return db.$transaction(async transaction => {
        const existing = await transaction.customScenario.findUnique({ where: { id } });
        if (!existing) return null;
        const scenario = scenarioSchema.parse(existing.data);
        const reviewed = { ...scenario, reviewStatus: status, reviewedBy: reviewerId, reviewedAt: reviewedAt.toISOString() };
        const version = await transaction.customScenarioRevision.count({ where: { scenarioId: id } }) + 1;
        await transaction.customScenario.update({ where: { id }, data: { data: reviewed } });
        await transaction.customScenarioRevision.create({ data: { scenarioId: id, version, data: reviewed, changedBy: reviewerId ?? undefined, createdAt: reviewedAt } });
        return reviewed;
      });
    },
    async scenarioRevisions(id: string) {
      const rows = await db.customScenarioRevision.findMany({ where: { scenarioId: id }, orderBy: { version: "asc" } });
      return rows.map(row => ({ id: row.id, scenarioId: row.scenarioId, version: row.version, scenario: scenarioSchema.parse(row.data), changedBy: row.changedBy, createdAt: row.createdAt })) as ScenarioRevision[];
    },
    async rollbackCustomScenario(id: string, revisionId: string, reviewerId: string | null, reviewedAt: Date) {
      return db.$transaction(async transaction => {
        const [currentRow, revision] = await Promise.all([transaction.customScenario.findUnique({ where: { id } }), transaction.customScenarioRevision.findFirst({ where: { id: revisionId, scenarioId: id } })]);
        if (!currentRow || !revision) return null;
        const current = scenarioSchema.parse(currentRow.data);
        const target = scenarioSchema.parse(revision.data);
        const rolledBack = { ...target, id, version: current.version + 1, ownerId: current.ownerId ?? null, reviewStatus: "draft" as const, reviewedBy: null, reviewedAt: null };
        const version = await transaction.customScenarioRevision.count({ where: { scenarioId: id } }) + 1;
        await transaction.customScenario.update({ where: { id }, data: { data: rolledBack } });
        await transaction.customScenarioRevision.create({ data: { scenarioId: id, version, data: rolledBack, changedBy: reviewerId ?? undefined, createdAt: reviewedAt } });
        return rolledBack;
      });
    },
    async entitlement(userId: string) {
      const row = await db.entitlement.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider as Entitlement["provider"], status: row.status as Entitlement["status"], environment: row.environment as Entitlement["environment"] } : null;
    },
    async entitlementByTransactionId(transactionId: string) {
      const row = await db.entitlement.findUnique({ where: { transactionId } });
      return row ? { ...row, provider: row.provider as Entitlement["provider"], status: row.status as Entitlement["status"], environment: row.environment as Entitlement["environment"] } : null;
    },
    async entitlementByOriginalTransactionId(provider: "apple" | "google", originalTransactionId: string) {
      const row = await db.entitlement.findFirst({ where: { provider, originalTransactionId }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider as Entitlement["provider"], status: row.status as Entitlement["status"], environment: row.environment as Entitlement["environment"] } : null;
    },
    async entitlementByPurchaseToken(provider: "apple" | "google", purchaseToken: string) {
      const row = await db.entitlement.findFirst({ where: { provider, purchaseToken }, orderBy: { updatedAt: "desc" } });
      return row ? { ...row, provider: row.provider as Entitlement["provider"], status: row.status as Entitlement["status"], environment: row.environment as Entitlement["environment"] } : null;
    },
    async saveEntitlement(entitlement: Entitlement) {
      await db.entitlement.upsert({ where: { transactionId: entitlement.transactionId }, create: entitlement, update: { userId: entitlement.userId, provider: entitlement.provider, productId: entitlement.productId, originalTransactionId: entitlement.originalTransactionId, purchaseToken: entitlement.purchaseToken, status: entitlement.status, environment: entitlement.environment, expiresAt: entitlement.expiresAt, providerEventDate: entitlement.providerEventDate } });
    },
    async createPurchaseIntent(intent: PurchaseIntent) { await db.purchaseIntent.create({ data: intent }); },
    async purchaseIntent(id: string) { const row = await db.purchaseIntent.findUnique({ where: { id } }); return row ? { ...row, provider: row.provider as PurchaseIntent["provider"], status: row.status as PurchaseIntent["status"] } : null; },
    async completePurchaseIntent(id: string) { await db.purchaseIntent.updateMany({ where: { id, status: "pending" }, data: { status: "completed" } }); },
    async createVoiceSession(session: VoiceSession) { await db.voiceSession.create({ data: session }); },
    async voiceSession(userId: string, id: string) { const row = await db.voiceSession.findFirst({ where: { id, userId } }); return row ? { ...row, status: row.status as VoiceSession["status"] } : null; },
    async bindVoiceProviderCall(userId: string, id: string, providerCallId: string) {
      const updated = await db.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { providerCallId } });
      if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
      const row = await db.voiceSession.findUniqueOrThrow({ where: { id } });
      return { ...row, status: row.status as VoiceSession["status"] };
    },
    async markVoiceProviderTerminated(id: string, terminatedAt: Date) { await db.voiceSession.updateMany({ where: { id, providerTerminatedAt: null }, data: { providerTerminatedAt: terminatedAt } }); },
    async pendingVoiceProviderCalls() {
      const rows = await db.voiceSession.findMany({ where: { status: { not: "active" }, providerCallId: { not: null }, providerTerminatedAt: null } });
      return rows.map(row => ({ ...row, status: row.status as VoiceSession["status"] }));
    },
    async endVoiceSession(userId: string, id: string, endedAt: Date, status: "ended" | "expired") {
      const updated = await db.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { status, endedAt } });
      if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
      const row = await db.voiceSession.findUniqueOrThrow({ where: { id } });
      return { ...row, status: row.status as VoiceSession["status"] };
    },
    async expireVoiceSessions(now: Date) {
      const rows = await db.voiceSession.findMany({ where: { status: "active", expiresAt: { lte: now } }, select: { id: true, conversationId: true, reservationId: true } });
      for (const row of rows) await db.$transaction(async transaction => {
        const updated = await transaction.voiceSession.updateMany({ where: { id: row.id, status: "active" }, data: { status: "expired", endedAt: now } });
        if (updated.count !== 1) return;
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (reservation) await transaction.usageReservation.update({ where: { id: row.reservationId }, data: { reservedSeconds: reservation.consumedSeconds } });
        await transaction.conversation.updateMany({ where: { id: row.conversationId, state: "ACTIVE" }, data: { state: "EXPIRED" } });
      });
      return rows.length;
    },
  };
}
