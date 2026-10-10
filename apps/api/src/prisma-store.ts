import { Prisma, PrismaClient } from "@prisma/client";
import { profileSchema, scenarioSchema, type Profile, type Scenario, states, type SessionState } from "@coach/core";
import {
  ConflictError, type Account, type ConversationTurn, type Entitlement, type OAuthIdentity,
  type PurchaseIntent, type ScenarioRevision, type Store, type VoiceMonthUsage, type VoiceSession,
} from "./store";
import { elapsedSeconds } from "./lib/time";
import { safeEqual } from "./lib/safe-equal";
type AccountRow = { id: string; email: string; passwordHash: string; role: string; emailVerifiedAt: Date | null };
const accountFromRow = (row: AccountRow): Account => ({
  id: row.id, email: row.email, passwordHash: row.passwordHash,
  role: row.role === "manager" ? "manager" : "learner", emailVerifiedAt: row.emailVerifiedAt,
});
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
    async markEmailVerified(userId, now) {
      await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      return accountFromRow(await db.user.findUniqueOrThrow({ where: { id: userId } }));
    },
    async issueEmailToken(token, hourlyLimit) {
      return db.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${token.userId}::uuid FOR UPDATE`;
        const count = await transaction.emailVerificationToken.count({
          where: {
            userId: token.userId, purpose: token.purpose,
            createdAt: { gt: new Date(token.createdAt.getTime() - 3600000) },
          },
        });
        if (count >= hourlyLimit) return false;
        await transaction.emailVerificationToken.create({ data: token });
        return true;
      });
    },
    async consumeEmailToken(hash, purpose, now, userId, newPasswordHash) {
      return db.$transaction(async transaction => {
        const candidate = await transaction.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
        if (!candidate) return null;
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.userId}::uuid FOR UPDATE`;
        const token = await transaction.emailVerificationToken.findUnique({ where: { tokenHash: hash } });
        if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= now) return null;
        if (userId && token.userId !== userId) return null;
        if (purpose === "password_reset" && !newPasswordHash) return null;
        await transaction.emailVerificationToken.update({ where: { tokenHash: hash }, data: { usedAt: now } });
        const user = await transaction.user.findUniqueOrThrow({ where: { id: token.userId } });
        const updated = await transaction.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: user.emailVerifiedAt ?? now, ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}) },
        });
        if (purpose === "password_reset") {
          await transaction.authSession.deleteMany({ where: { userId: user.id } });
          if (!user.emailVerifiedAt) await transaction.oAuthIdentity.deleteMany({ where: { userId: user.id } });
          await transaction.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
        }
        return accountFromRow(updated);
      });
    },
    async oauthIdentity(provider: OAuthIdentity["provider"], subject: string) {
      const row = await db.oAuthIdentity.findUnique({ where: { provider_subject: { provider, subject } } });
      return row ? { ...row, provider: row.provider as OAuthIdentity["provider"] } : null;
    },
    async saveOAuthIdentity(identity: OAuthIdentity) {
      try { await db.oAuthIdentity.create({ data: identity }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictError("This provider identity is already linked to another account."); throw error; }
    },
    async createSession(session, expectedPasswordHash) {
      await db.$transaction(async transaction => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${session.userId}::uuid FOR UPDATE`;
        const user = await transaction.user.findUnique({ where: { id: session.userId } });
        if (!user || (expectedPasswordHash && !safeEqual(user.passwordHash, expectedPasswordHash))) {
          throw new ConflictError("Account credentials changed. Please sign in again.");
        }
        await transaction.authSession.create({ data: session });
      });
    },
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
    async reservationSeconds(reservationId) {
      const reservation = await db.usageReservation.findUnique({ where: { id: reservationId }, select: { reservedSeconds: true } });
      return reservation?.reservedSeconds ?? null;
    },
    async reserveUsage(reservation, allowanceSeconds) {
      await db.$transaction(async transaction => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${reservation.userId} || ':' || ${reservation.dayKey})::bigint
          )
        `;
        const rows = await transaction.usageReservation.aggregate({
          where: { userId: reservation.userId, dayKey: reservation.dayKey },
          _sum: { reservedSeconds: true, consumedSeconds: true },
        });
        const reserved = rows._sum.reservedSeconds ?? 0;
        if (reserved + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
        await transaction.usageReservation.create({
          data: {
            id: reservation.id,
            userId: reservation.userId,
            dayKey: reservation.dayKey,
            reservedSeconds: reservation.seconds,
            expiresAt: reservation.expiresAt,
          },
        });
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
    async voiceMonthUsage(userId, monthKey): Promise<VoiceMonthUsage> {
      const usage = await db.voiceMonthUsage.findUnique({ where: { userId_monthKey: { userId, monthKey } } });
      return usage
        ? { userId, monthKey, sessionsUsed: usage.sessionsUsed, consumedSeconds: usage.consumedSeconds }
        : { userId, monthKey, sessionsUsed: 0, consumedSeconds: 0 };
    },
    async totalVoiceSessions(userId) {
      const result = await db.voiceMonthUsage.aggregate({ where: { userId }, _sum: { sessionsUsed: true } });
      return result._sum.sessionsUsed ?? 0;
    },
    async reserveVoiceSession(userId, monthKey, sessionLimit, lifetimeLimit) {
      const lockScope = lifetimeLimit ? "lifetime" : monthKey;
      await db.$transaction(async transaction => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${userId} || ':sessions:' || ${lockScope})::bigint)
        `;
        const usage = await transaction.voiceMonthUsage.upsert({
          where: { userId_monthKey: { userId, monthKey } },
          create: { userId, monthKey },
          update: {},
        });
        const used = lifetimeLimit
          ? (await transaction.voiceMonthUsage.aggregate({ where: { userId }, _sum: { sessionsUsed: true } }))._sum.sessionsUsed ?? 0
          : usage.sessionsUsed;
        if (used >= sessionLimit) throw new ConflictError("Voice session allowance is exhausted.");
        await transaction.voiceMonthUsage.update({
          where: { userId_monthKey: { userId, monthKey } },
          data: { sessionsUsed: { increment: 1 } },
        });
      });
    },
    async releaseVoiceSession(userId, monthKey, lifetimeLimit) {
      const lockScope = lifetimeLimit ? "lifetime" : monthKey;
      await db.$transaction(async transaction => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${userId} || ':sessions:' || ${lockScope})::bigint)
        `;
        await transaction.voiceMonthUsage.updateMany({
          where: { userId, monthKey, sessionsUsed: { gt: 0 } },
          data: { sessionsUsed: { decrement: 1 } },
        });
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
    async createVoiceSession(session: VoiceSession) {
      try { await db.voiceSession.create({ data: session }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictError("Another voice session is already active.");
        }
        throw error;
      }
    },
    async voiceSession(userId: string, id: string) { const row = await db.voiceSession.findFirst({ where: { id, userId } }); return row ? { ...row, status: row.status as VoiceSession["status"] } : null; },
    async activeVoiceSession(userId: string) {
      const row = await db.voiceSession.findFirst({ where: { userId, status: "active" } });
      return row ? { ...row, status: row.status as VoiceSession["status"] } : null;
    },
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
    async endVoiceSession(userId: string, id: string, endedAt: Date, status: "ended" | "expired", consumedSeconds: number) {
      return db.$transaction(async transaction => {
        const row = await transaction.voiceSession.findFirst({ where: { id, userId, status: "active" } });
        if (!row) throw new ConflictError("Voice session is already closed.");
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (!reservation) throw new Error("Usage reservation not found");
        const chargedSeconds = Math.min(consumedSeconds, reservation.reservedSeconds);
        const updated = await transaction.voiceSession.updateMany({ where: { id, userId, status: "active" }, data: { status, endedAt } });
        if (updated.count !== 1) throw new ConflictError("Voice session is already closed.");
        await transaction.usageReservation.update({
          where: { id: row.reservationId },
          data: { reservedSeconds: chargedSeconds, consumedSeconds: chargedSeconds },
        });
        await transaction.voiceMonthUsage.upsert({
          where: { userId_monthKey: { userId, monthKey: row.monthKey } },
          create: { userId, monthKey: row.monthKey, consumedSeconds: chargedSeconds },
          update: { consumedSeconds: { increment: chargedSeconds } },
        });
        return { ...row, status, endedAt } as VoiceSession;
      });
    },
    async expireVoiceSessions(now: Date) {
      const rows = await db.voiceSession.findMany({
        where: { status: "active", expiresAt: { lte: now } },
        select: { id: true, userId: true, monthKey: true, conversationId: true, reservationId: true, startedAt: true, expiresAt: true },
      });
      let expired = 0;
      for (const row of rows) await db.$transaction(async transaction => {
        const updated = await transaction.voiceSession.updateMany({ where: { id: row.id, status: "active" }, data: { status: "expired", endedAt: now } });
        if (updated.count !== 1) return;
        const reservation = await transaction.usageReservation.findUnique({ where: { id: row.reservationId } });
        if (reservation) {
          const consumedSeconds = elapsedSeconds(row.startedAt, row.expiresAt, reservation.reservedSeconds);
          await transaction.usageReservation.update({
            where: { id: row.reservationId },
            data: { reservedSeconds: consumedSeconds, consumedSeconds },
          });
          await transaction.voiceMonthUsage.upsert({
            where: { userId_monthKey: { userId: row.userId, monthKey: row.monthKey } },
            create: { userId: row.userId, monthKey: row.monthKey, consumedSeconds },
            update: { consumedSeconds: { increment: consumedSeconds } },
          });
        }
        await transaction.conversation.updateMany({ where: { id: row.conversationId, state: "ACTIVE" }, data: { state: "EXPIRED" } });
        expired += 1;
      });
      return expired;
    },
  };
}
