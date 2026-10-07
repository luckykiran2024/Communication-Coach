import { randomUUID } from "node:crypto";
import { ConflictError, type Account, type Conversation, type ConversationTurn, type Entitlement, type LoginSession, type OAuthIdentity, type PurchaseIntent, type ScenarioRevision, type Store, type UsageReservation, type VoiceSession } from "./store";
import type { Profile, Scenario, SessionState } from "@coach/core";

export class MemoryStore implements Store {
  accounts = new Map<string, Account>();
  oauthIdentities = new Map<string, OAuthIdentity>();
  sessions = new Map<string, LoginSession>();
  profiles = new Map<string, Profile>();
  reservations = new Map<string, UsageReservation & { consumedSeconds: number }>();
  conversationRows = new Map<string, Conversation>();
  turns = new Map<string, ConversationTurn[]>();
  scenarioRows = new Map<string, Scenario>();
  scenarioRevisionRows = new Map<string, ScenarioRevision[]>();
  entitlements = new Map<string, Entitlement>();
  purchaseIntents = new Map<string, PurchaseIntent>();
  voiceSessions = new Map<string, VoiceSession>();
  async ready() {}
  async createAccount(email: string, passwordHash: string) { if ([...this.accounts.values()].some(account => account.email === email)) throw new ConflictError(); const account = { id: randomUUID(), email, passwordHash, role: "learner" as const }; this.accounts.set(account.id, account); return account; }
  async accountByEmail(email: string) { return [...this.accounts.values()].find(account => account.email === email) ?? null; }
  async accountById(id: string) { return this.accounts.get(id) ?? null; }
  async oauthIdentity(provider: OAuthIdentity["provider"], subject: string) { return this.oauthIdentities.get(`${provider}:${subject}`) ?? null; }
  async saveOAuthIdentity(identity: OAuthIdentity) { const key = `${identity.provider}:${identity.subject}`; const existing = this.oauthIdentities.get(key); if (existing && existing.userId !== identity.userId) throw new ConflictError("This provider identity is already linked to another account."); this.oauthIdentities.set(key, identity); }
  async createSession(session: LoginSession) { this.sessions.set(session.tokenHash, session); }
  async sessionByHash(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async deleteSessions(userId: string) { for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash); }
  async deleteAccount(userId: string) { this.accounts.delete(userId); this.profiles.delete(userId); for (const [key, identity] of this.oauthIdentities) if (identity.userId === userId) this.oauthIdentities.delete(key); for (const [hash, session] of this.sessions) if (session.userId === userId) this.sessions.delete(hash); for (const [id, reservation] of this.reservations) if (reservation.userId === userId) this.reservations.delete(id); for (const [id, conversation] of this.conversationRows) if (conversation.userId === userId) { this.conversationRows.delete(id); this.turns.delete(id); } for (const [id, entitlement] of this.entitlements) if (entitlement.userId === userId) this.entitlements.delete(id); for (const [id, intent] of this.purchaseIntents) if (intent.userId === userId) this.purchaseIntents.delete(id); for (const [id, session] of this.voiceSessions) if (session.userId === userId) this.voiceSessions.delete(id); }
  async profile(userId: string) { return this.profiles.get(userId) ?? null; }
  async saveProfile(userId: string, profile: Profile) { const old = this.profiles.get(userId); if (old && old.timezone !== profile.timezone) throw new ConflictError("Timezone changes require support"); this.profiles.set(userId, profile); }
  async usage(userId: string, dayKey: string) { return [...this.reservations.values()].filter(row => row.userId === userId && row.dayKey === dayKey).reduce((total, row) => ({ reservedSeconds: total.reservedSeconds + row.seconds, consumedSeconds: total.consumedSeconds + row.consumedSeconds }), { reservedSeconds: 0, consumedSeconds: 0 }); }
  async reserveUsage(reservation: UsageReservation, allowanceSeconds: number) { const current = await this.usage(reservation.userId, reservation.dayKey); if (current.reservedSeconds + reservation.seconds > allowanceSeconds) throw new ConflictError("Daily voice allowance is exhausted."); this.reservations.set(reservation.id, { ...reservation, consumedSeconds: 0 }); }
  async settleUsage(reservationId: string, consumedSeconds: number) { const row = this.reservations.get(reservationId); if (!row) throw new Error("Usage reservation not found"); row.consumedSeconds = Math.min(consumedSeconds, row.seconds); row.seconds = row.consumedSeconds; }
  async createConversation(conversation: Conversation) { this.conversationRows.set(conversation.id, conversation); }
  async conversation(userId: string, id: string) { const row = this.conversationRows.get(id); return row?.userId === userId ? row : null; }
  async conversations(userId: string, limit?: number) { const rows = [...this.conversationRows.values()].filter(row => row.userId === userId).sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()); return limit === undefined ? rows : rows.slice(0, limit); }
  async updateConversationState(userId: string, id: string, state: SessionState) { const row = await this.conversation(userId, id); if (!row) throw new Error("Conversation not found"); row.state = state; row.updatedAt = new Date(); return row; }
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
  async createVoiceSession(session: VoiceSession) { this.voiceSessions.set(session.id, session); }
  async voiceSession(userId: string, id: string) { const session = this.voiceSessions.get(id); return session?.userId === userId ? session : null; }
  async bindVoiceProviderCall(userId: string, id: string, providerCallId: string) { const session = await this.voiceSession(userId, id); if (!session) throw new Error("Voice session not found"); if (session.status !== "active") throw new ConflictError("Voice session is already closed."); session.providerCallId = providerCallId; return session; }
  async markVoiceProviderTerminated(id: string, terminatedAt: Date) { const session = this.voiceSessions.get(id); if (session) session.providerTerminatedAt = terminatedAt; }
  async pendingVoiceProviderCalls() { return [...this.voiceSessions.values()].filter(session => session.status !== "active" && Boolean(session.providerCallId) && !session.providerTerminatedAt); }
  async endVoiceSession(userId: string, id: string, endedAt: Date, status: "ended" | "expired") { const session = await this.voiceSession(userId, id); if (!session) throw new Error("Voice session not found"); if (session.status !== "active") throw new ConflictError("Voice session is already closed."); session.status = status; session.endedAt = endedAt; return session; }
  async expireVoiceSessions(now: Date) { let expired = 0; for (const session of this.voiceSessions.values()) { if (session.status !== "active" || session.expiresAt > now) continue; session.status = "expired"; session.endedAt = now; const reservation = this.reservations.get(session.reservationId); if (reservation) reservation.seconds = reservation.consumedSeconds; const conversation = this.conversationRows.get(session.conversationId); if (conversation?.state === "ACTIVE") { conversation.state = "EXPIRED"; conversation.updatedAt = now; } expired += 1; } return expired; }
}
