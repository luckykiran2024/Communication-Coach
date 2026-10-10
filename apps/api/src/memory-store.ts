import { randomUUID } from "node:crypto";
import { ConflictError, type Account, type Conversation, type ConversationTurn, type Entitlement, type LoginSession, type OAuthIdentity, type PurchaseIntent, type ScenarioRevision, type Store, type UsageReservation, type VoiceSession } from "./store";
import type { Profile, Scenario, SessionState } from "@coach/core";
import { elapsedSeconds } from "./lib/time";
import type { EmailToken, EmailTokenPurpose } from "./store";
import { safeEqual } from "./lib/safe-equal";
import type { Assessment, AssessmentUsage } from "./store";
import { checkedAssessment, checkedAssessmentUsage } from "./lib/assessment-record";

export class MemoryStore implements Store {
  readonly rateLimitStorage = "memory" as const;
  private rateLimitBuckets = new Map<string, { current: number; resetAt: number }>();
  async incrementRateLimit(keyHash: string, windowMs: number, now: Date) {
    return this.withUsageLock(`rate:${keyHash}`, async () => {
      const existing = this.rateLimitBuckets.get(keyHash);
      const row = existing && existing.resetAt > now.getTime()
        ? { ...existing, current: Math.min(2147483647, existing.current + 1) }
        : { current: 1, resetAt: now.getTime() + windowMs };
      this.rateLimitBuckets.set(keyHash, row);
      return { current: row.current, ttl: Math.max(1, row.resetAt - now.getTime()) };
    });
  }
  async pruneRateLimits(now: Date) {
    for (const [key, row] of this.rateLimitBuckets) if (row.resetAt <= now.getTime()) this.rateLimitBuckets.delete(key);
  }
  async learningRecords(userId: string) {
    return (await this.conversations(userId)).map(conversation => ({
      conversation: structuredClone(conversation), turns: structuredClone(this.turns.get(conversation.id) ?? []),
      assessment: structuredClone(this.assessmentRows.get(conversation.id) ?? null),
    }));
  }
  async measuredVoiceSessions(userId: string) {
    return [...this.voiceSessions.values()].filter(session => session.userId === userId
      && ["ended", "expired"].includes(session.status)).map(session => ({
      conversationId: session.conversationId, startedAt: session.startedAt,
      consumedSeconds: this.reservations.get(session.reservationId)?.consumedSeconds ?? null,
    }));
  }
  private usageLocks = new Map<string, Promise<void>>();
  accounts = new Map<string, Account>();
  emailTokens = new Map<string, EmailToken>();
  oauthIdentities = new Map<string, OAuthIdentity>();
  sessions = new Map<string, LoginSession>();
  profiles = new Map<string, Profile>();
  reservations = new Map<string, UsageReservation & { consumedSeconds: number }>();
  monthlyVoiceUsage = new Map<string, { sessionsUsed: number; consumedSeconds: number }>();
  conversationRows = new Map<string, Conversation>();
  turns = new Map<string, ConversationTurn[]>();
  assessmentRows = new Map<string, Assessment>();
  assessmentUsageRows = new Map<string, AssessmentUsage>();
  scenarioRows = new Map<string, Scenario>();
  scenarioRevisionRows = new Map<string, ScenarioRevision[]>();
  entitlements = new Map<string, Entitlement>();
  purchaseIntents = new Map<string, PurchaseIntent>();
  voiceSessions = new Map<string, VoiceSession>();
  async ready() {}
  async createAccount(email: string, passwordHash: string) {
    if ([...this.accounts.values()].some(account => account.email === email)) throw new ConflictError();
    const account: Account = { id: randomUUID(), email, passwordHash, role: "learner", emailVerifiedAt: null };
    this.accounts.set(account.id, account);
    return { ...account };
  }
  async markEmailVerified(userId: string, now: Date) {
    const user = this.accounts.get(userId);
    if (!user) throw new Error("Account not found");
    user.emailVerifiedAt ??= now;
    return user;
  }
  async issueEmailToken(token: EmailToken, hourlyLimit: number) {
    return this.withUsageLock(`account:${token.userId}`, async () => {
      const since = token.createdAt.getTime() - 3600000;
      const count = [...this.emailTokens.values()].filter(item =>
        item.userId === token.userId && item.purpose === token.purpose && item.createdAt.getTime() > since,
      ).length;
      if (count >= hourlyLimit || !this.accounts.has(token.userId)) return false;
      this.emailTokens.set(token.tokenHash, token);
      return true;
    });
  }
  async consumeEmailToken(
    hash: string, purpose: EmailTokenPurpose, now: Date, userId?: string, newPasswordHash?: string,
  ) {
    const candidate = this.emailTokens.get(hash);
    if (!candidate) return null;
    return this.withUsageLock(`account:${candidate.userId}`, async () => {
      const token = this.emailTokens.get(hash);
      if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= now) return null;
      if (userId && token.userId !== userId) return null;
      const user = this.accounts.get(token.userId);
      if (!user || (purpose === "password_reset" && !newPasswordHash)) return null;
      const wasVerified = Boolean(user.emailVerifiedAt);
      token.usedAt = now;
      user.emailVerifiedAt ??= now;
      if (purpose === "password_reset") {
        user.passwordHash = newPasswordHash!;
        await this.deleteSessions(user.id);
        if (!wasVerified) {
          for (const [key, identity] of this.oauthIdentities) {
            if (identity.userId === user.id) this.oauthIdentities.delete(key);
          }
        }
        for (const item of this.emailTokens.values()) if (item.userId === user.id) item.usedAt = now;
      }
      return user;
    });
  }
  async accountByEmail(email: string) {
    const user = [...this.accounts.values()].find(account => account.email === email);
    return user ? { ...user } : null;
  }
  async accountById(id: string) {
    const user = this.accounts.get(id);
    return user ? { ...user } : null;
  }
  async oauthIdentity(provider: OAuthIdentity["provider"], subject: string) { return this.oauthIdentities.get(`${provider}:${subject}`) ?? null; }
  async saveOAuthIdentity(identity: OAuthIdentity) { const key = `${identity.provider}:${identity.subject}`; const existing = this.oauthIdentities.get(key); if (existing && existing.userId !== identity.userId) throw new ConflictError("This provider identity is already linked to another account."); this.oauthIdentities.set(key, identity); }
  async createSession(session: LoginSession, expectedPasswordHash?: string) {
    await this.withUsageLock(`account:${session.userId}`, async () => {
      const user = this.accounts.get(session.userId);
      if (!user || (expectedPasswordHash && !safeEqual(user.passwordHash, expectedPasswordHash))) {
        throw new ConflictError("Account credentials changed. Please sign in again.");
      }
      this.sessions.set(session.tokenHash, session);
    });
  }
  async sessionByHash(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async deleteSessions(userId: string) { for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash); }
  async deleteAccount(userId: string) {
    this.accounts.delete(userId);
    for (const [hash, token] of this.emailTokens) if (token.userId === userId) this.emailTokens.delete(hash);
    this.profiles.delete(userId);
    for (const [key, identity] of this.oauthIdentities) if (identity.userId === userId) this.oauthIdentities.delete(key);
    for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash);
    for (const [id, reservation] of this.reservations) if (reservation.userId === userId) this.reservations.delete(id);
    for (const [key] of this.monthlyVoiceUsage) if (key.startsWith(`${userId}:`)) this.monthlyVoiceUsage.delete(key);
    for (const [id, conversation] of this.conversationRows) {
      if (conversation.userId !== userId) continue;
      this.conversationRows.delete(id);
      this.turns.delete(id);
      this.assessmentRows.delete(id);
      for (const [key, usage] of this.assessmentUsageRows) {
        if (usage.conversationId === id) this.assessmentUsageRows.delete(key);
      }
    }
    for (const [id, entitlement] of this.entitlements) if (entitlement.userId === userId) this.entitlements.delete(id);
    for (const [id, intent] of this.purchaseIntents) if (intent.userId === userId) this.purchaseIntents.delete(id);
    for (const [id, session] of this.voiceSessions) if (session.userId === userId) this.voiceSessions.delete(id);
  }
  async profile(userId: string) { return this.profiles.get(userId) ?? null; }
  async saveProfile(userId: string, profile: Profile) { const old = this.profiles.get(userId); if (old && old.timezone !== profile.timezone) throw new ConflictError("Timezone changes require support"); this.profiles.set(userId, profile); }
  async usage(userId: string, dayKey: string) { return [...this.reservations.values()].filter(row => row.userId === userId && row.dayKey === dayKey).reduce((total, row) => ({ reservedSeconds: total.reservedSeconds + row.seconds, consumedSeconds: total.consumedSeconds + row.consumedSeconds }), { reservedSeconds: 0, consumedSeconds: 0 }); }
  private async withUsageLock<T>(key: string, operation: () => Promise<T>) {
    const previous = this.usageLocks.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>(resolve => { release = resolve; });
    this.usageLocks.set(key, current);
    await previous;
    try { return await operation(); }
    finally {
      release();
      if (this.usageLocks.get(key) === current) this.usageLocks.delete(key);
    }
  }
  async reservationSeconds(reservationId: string) { return this.reservations.get(reservationId)?.seconds ?? null; }
  async reserveUsage(reservation: UsageReservation, allowanceSeconds: number) {
    const key = `${reservation.userId}:${reservation.dayKey}`;
    await this.withUsageLock(key, async () => {
      const usage = await this.usage(reservation.userId, reservation.dayKey);
      if (usage.reservedSeconds + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted.");
      this.reservations.set(reservation.id, { ...reservation, consumedSeconds: 0 });
    });
  }
  async settleUsage(reservationId: string, consumedSeconds: number) { const row = this.reservations.get(reservationId); if (!row) throw new Error("Usage reservation not found"); row.consumedSeconds = Math.min(consumedSeconds, row.seconds); row.seconds = row.consumedSeconds; }
  async voiceMonthUsage(userId: string, monthKey: string) {
    const usage = this.monthlyVoiceUsage.get(`${userId}:${monthKey}`);
    return { userId, monthKey, sessionsUsed: usage?.sessionsUsed ?? 0, consumedSeconds: usage?.consumedSeconds ?? 0 };
  }
  async totalVoiceSessions(userId: string) {
    return [...this.monthlyVoiceUsage.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .reduce((total, [, usage]) => total + usage.sessionsUsed, 0);
  }
  async reserveVoiceSession(userId: string, monthKey: string, sessionLimit: number, lifetimeLimit: boolean) {
    const lockScope = lifetimeLimit ? "lifetime" : monthKey;
    await this.withUsageLock(`${userId}:sessions:${lockScope}`, async () => {
      const usage = await this.voiceMonthUsage(userId, monthKey);
      const used = lifetimeLimit ? await this.totalVoiceSessions(userId) : usage.sessionsUsed;
      if (used >= sessionLimit) throw new ConflictError("Voice session allowance is exhausted.");
      this.monthlyVoiceUsage.set(`${userId}:${monthKey}`, { ...usage, sessionsUsed: usage.sessionsUsed + 1 });
    });
  }
  async releaseVoiceSession(userId: string, monthKey: string, lifetimeLimit: boolean) {
    const lockScope = lifetimeLimit ? "lifetime" : monthKey;
    await this.withUsageLock(`${userId}:sessions:${lockScope}`, async () => {
      const key = `${userId}:${monthKey}`;
      const usage = this.monthlyVoiceUsage.get(key);
      if (usage) usage.sessionsUsed = Math.max(0, usage.sessionsUsed - 1);
    });
  }
  async createConversation(conversation: Conversation) {
    this.conversationRows.set(conversation.id, { ...conversation, currentPhase: conversation.currentPhase ?? "primary" });
  }
  async conversation(userId: string, id: string) { const row = this.conversationRows.get(id); return row?.userId === userId ? row : null; }
  async conversations(userId: string, limit?: number) { const rows = [...this.conversationRows.values()].filter(row => row.userId === userId).sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()); return limit === undefined ? rows : rows.slice(0, limit); }
  async updateConversationState(userId: string, id: string, state: SessionState) { const row = await this.conversation(userId, id); if (!row) throw new Error("Conversation not found"); row.state = state; row.updatedAt = new Date(); return row; }
  async claimConversationCompletion(userId: string, id: string) {
    return this.withUsageLock(`conversation:${id}`, async () => {
      const row = this.conversationRows.get(id);
      if (row?.userId !== userId || !["CREATED", "INTERRUPTED"].includes(row.state)) return false;
      row.state = "COMPLETED";
      row.updatedAt = new Date();
      return true;
    });
  }
  async assessment(userId: string, conversationId: string) {
    if (this.conversationRows.get(conversationId)?.userId !== userId) return null;
    const record = this.assessmentRows.get(conversationId);
    return record ? structuredClone(record) : null;
  }
  async advanceConversation(userId: string, id: string) {
    return this.withUsageLock(`conversation:${id}`, async () => {
      const row = this.conversationRows.get(id);
      const hasPrimary = this.turns.get(id)?.some(turn => turn.role === "user" && turn.phase === "primary");
      const activeVoice = [...this.voiceSessions.values()].some(session =>
        session.conversationId === id && session.status === "active");
      if (row?.userId !== userId || row.currentPhase !== "primary" || !hasPrimary || activeVoice
        || !["CREATED", "INTERRUPTED"].includes(row.state)) return false;
      row.currentPhase = "independent_retry";
      row.updatedAt = new Date();
      return true;
    });
  }
  async appendConversationTurn(userId: string, turn: Omit<ConversationTurn, "phase">) {
    return this.withUsageLock(`conversation:${turn.sessionId}`, async () => {
      const row = this.conversationRows.get(turn.sessionId);
      if (row?.userId !== userId) throw new Error("Conversation not found");
      if (!["CREATED", "ACTIVE", "INTERRUPTED"].includes(row.state)) throw new ConflictError("Practice is closed.");
      const saved = { ...turn, phase: row.currentPhase ?? "primary" };
      await this.addConversationTurn(saved);
      return saved;
    });
  }
  async saveAssessment(userId: string, assessment: Assessment) {
    const record = checkedAssessment(assessment);
    await this.withUsageLock(`conversation:${record.conversationId}`, async () => {
      if (this.conversationRows.get(record.conversationId)?.userId !== userId) {
        throw new Error("Conversation not found");
      }
      if (this.assessmentRows.has(record.conversationId)
        || [...this.assessmentRows.values()].some(existing => existing.id === record.id)) {
        throw new ConflictError("Assessment already exists.");
      }
      this.assessmentRows.set(record.conversationId, record);
    });
  }
  async recordAssessmentUsage(userId: string, usage: AssessmentUsage) {
    const record = checkedAssessmentUsage(usage);
    await this.withUsageLock(`conversation:${record.conversationId}`, async () => {
      if (this.conversationRows.get(record.conversationId)?.userId !== userId) {
        throw new Error("Conversation not found");
      }
      const key = `${record.conversationId}:${record.attempt}`;
      if (this.assessmentUsageRows.has(key)
        || [...this.assessmentUsageRows.values()].some(existing => existing.id === record.id)) {
        throw new ConflictError("Assessment attempt usage already exists.");
      }
      this.assessmentUsageRows.set(key, record);
    });
  }
  async addConversationTurn(turn: ConversationTurn) { this.turns.set(turn.sessionId, [...(this.turns.get(turn.sessionId) ?? []), turn]); }
  async conversationTurns(userId: string, sessionId: string) { return this.conversationRows.get(sessionId)?.userId === userId ? this.turns.get(sessionId) ?? [] : []; }
  async customScenarios() { return [...this.scenarioRows.values()]; }
  async createCustomScenario(scenario: Scenario) { if (this.scenarioRows.has(scenario.id)) throw new ConflictError("A scenario with this id already exists."); this.scenarioRows.set(scenario.id, scenario); this.scenarioRevisionRows.set(scenario.id, [{ id: randomUUID(), scenarioId: scenario.id, version: 1, scenario, changedBy: scenario.ownerId ?? null, createdAt: new Date() }]); }
  async reviewCustomScenario(id: string, status: "draft" | "published" | "deprecated", reviewerId: string | null, reviewedAt: Date) { const scenario = this.scenarioRows.get(id); if (!scenario) return null; const reviewed = { ...scenario, reviewStatus: status, reviewedBy: reviewerId, reviewedAt: reviewedAt.toISOString() }; this.scenarioRows.set(id, reviewed); const revisions = this.scenarioRevisionRows.get(id) ?? []; revisions.push({ id: randomUUID(), scenarioId: id, version: revisions.length + 1, scenario: reviewed, changedBy: reviewerId, createdAt: reviewedAt }); this.scenarioRevisionRows.set(id, revisions); return reviewed; }
  async scenarioRevisions(id: string) { return [...(this.scenarioRevisionRows.get(id) ?? [])].sort((first, second) => first.version - second.version); }
  async rollbackCustomScenario(id: string, revisionId: string, reviewerId: string | null, reviewedAt: Date) { const current = this.scenarioRows.get(id); const revision = (this.scenarioRevisionRows.get(id) ?? []).find(item => item.id === revisionId); if (!current || !revision) return null; const rolledBack = { ...revision.scenario, id, version: current.version + 1, ownerId: current.ownerId ?? null, reviewStatus: "draft" as const, reviewedBy: null, reviewedAt: null }; this.scenarioRows.set(id, rolledBack); const revisions = this.scenarioRevisionRows.get(id) ?? []; revisions.push({ id: randomUUID(), scenarioId: id, version: revisions.length + 1, scenario: rolledBack, changedBy: reviewerId, createdAt: reviewedAt }); this.scenarioRevisionRows.set(id, revisions); return rolledBack; }
  async entitlement(userId: string) { return [...this.entitlements.values()].filter(item => item.userId === userId).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null; }
  async entitlementByTransactionId(transactionId: string) { return this.entitlements.get(transactionId) ?? null; }
  async entitlementByOriginalTransactionId(provider: "apple" | "google", originalTransactionId: string) { return [...this.entitlements.values()].filter(item => item.provider === provider && item.originalTransactionId === originalTransactionId).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null; }
  async entitlementByPurchaseToken(provider: "apple" | "google", purchaseToken: string) { return [...this.entitlements.values()].filter(item => item.provider === provider && item.purchaseToken === purchaseToken).sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())[0] ?? null; }
  async saveEntitlement(entitlement: Entitlement) { this.entitlements.set(entitlement.transactionId, entitlement); }
  async createPurchaseIntent(intent: PurchaseIntent) { this.purchaseIntents.set(intent.id, intent); }
  async purchaseIntent(id: string) { return this.purchaseIntents.get(id) ?? null; }
  async completePurchaseIntent(id: string) { const intent = this.purchaseIntents.get(id); if (intent) intent.status = "completed"; }
  async createVoiceSession(session: VoiceSession) {
    if ([...this.voiceSessions.values()].some(item => item.userId === session.userId && item.status === "active")) {
      throw new ConflictError("Another voice session is already active.");
    }
    this.voiceSessions.set(session.id, session);
  }
  async voiceSession(userId: string, id: string) { const session = this.voiceSessions.get(id); return session?.userId === userId ? session : null; }
  async activeVoiceSession(userId: string) {
    return [...this.voiceSessions.values()].find(session => session.userId === userId && session.status === "active") ?? null;
  }
  async bindVoiceProviderCall(userId: string, id: string, providerCallId: string) { const session = await this.voiceSession(userId, id); if (!session) throw new Error("Voice session not found"); if (session.status !== "active") throw new ConflictError("Voice session is already closed."); session.providerCallId = providerCallId; return session; }
  async markVoiceProviderTerminated(id: string, terminatedAt: Date) { const session = this.voiceSessions.get(id); if (session) session.providerTerminatedAt = terminatedAt; }
  async pendingVoiceProviderCalls() { return [...this.voiceSessions.values()].filter(session => session.status !== "active" && Boolean(session.providerCallId) && !session.providerTerminatedAt); }
  async endVoiceSession(userId: string, id: string, endedAt: Date, status: "ended" | "expired", consumedSeconds: number) {
    const session = await this.voiceSession(userId, id);
    if (!session) throw new Error("Voice session not found");
    if (session.status !== "active") throw new ConflictError("Voice session is already closed.");
    const reservation = this.reservations.get(session.reservationId);
    if (!reservation) throw new Error("Usage reservation not found");
    const chargedSeconds = Math.min(consumedSeconds, reservation.seconds);
    reservation.seconds = chargedSeconds;
    reservation.consumedSeconds = chargedSeconds;
    const usageKey = `${userId}:${session.monthKey}`;
    const monthly = this.monthlyVoiceUsage.get(usageKey) ?? { sessionsUsed: 0, consumedSeconds: 0 };
    monthly.consumedSeconds += chargedSeconds;
    this.monthlyVoiceUsage.set(usageKey, monthly);
    session.status = status;
    session.endedAt = endedAt;
    return session;
  }
  async expireVoiceSessions(now: Date) {
    let expired = 0;
    for (const session of this.voiceSessions.values()) {
      if (session.status !== "active" || session.expiresAt > now) continue;
      session.status = "expired";
      session.endedAt = now;
      const reservation = this.reservations.get(session.reservationId);
      if (reservation) {
        const consumedSeconds = elapsedSeconds(session.startedAt, session.expiresAt, reservation.seconds);
        reservation.seconds = consumedSeconds;
        reservation.consumedSeconds = consumedSeconds;
        const usageKey = `${session.userId}:${session.monthKey}`;
        const usage = this.monthlyVoiceUsage.get(usageKey) ?? { sessionsUsed: 0, consumedSeconds: 0 };
        usage.consumedSeconds += consumedSeconds;
        this.monthlyVoiceUsage.set(usageKey, usage);
      }
      const conversation = this.conversationRows.get(session.conversationId);
      if (conversation?.state === "ACTIVE") {
        conversation.state = "INTERRUPTED";
        conversation.updatedAt = now;
      }
      expired += 1;
    }
    return expired;
  }
}
