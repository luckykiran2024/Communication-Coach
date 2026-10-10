import type { ConversationTurnPhase, Profile, Scenario, SessionState, ConversationTurnRole } from "@coach/core";
export type Account = {
  id: string; email: string; passwordHash: string; role: "learner" | "manager"; emailVerifiedAt: Date | null;
};
export type EmailTokenPurpose = "verify_email" | "password_reset";
export type EmailToken = {
  tokenHash: string; userId: string; purpose: EmailTokenPurpose; createdAt: Date; expiresAt: Date; usedAt: Date | null;
};
export type OAuthProvider = "google" | "microsoft";
export type OAuthIdentity = { id: string; provider: OAuthProvider; subject: string; userId: string; createdAt: Date; updatedAt: Date };
export type LoginSession = { tokenHash: string; userId: string; expiresAt: Date };
export type UsageSnapshot = { reservedSeconds: number; consumedSeconds: number };
export type UsageReservation = { id: string; userId: string; dayKey: string; seconds: number; expiresAt: Date };
export type Entitlement = { id: string; userId: string; provider: "apple" | "google"; productId: string; transactionId: string; originalTransactionId: string | null; purchaseToken: string | null; status: "active" | "expired" | "revoked"; environment: "sandbox" | "production"; expiresAt: Date | null; providerEventDate: Date | null; createdAt: Date; updatedAt: Date };
export type PurchaseIntent = { id: string; userId: string; provider: "apple" | "google"; productId: string; nonce: string; status: "pending" | "completed" | "cancelled"; createdAt: Date; expiresAt: Date };
export type VoiceSession = {
  id: string; userId: string; conversationId: string; reservationId: string; monthKey: string;
  providerSessionId: string; providerCallId: string | null; providerTerminatedAt: Date | null;
  status: "active" | "ended" | "expired" | "failed"; startedAt: Date; expiresAt: Date; endedAt: Date | null;
};
export type VoiceMonthUsage = { userId: string; monthKey: string; sessionsUsed: number; consumedSeconds: number };
export type ScenarioRevision = { id: string; scenarioId: string; version: number; scenario: Scenario; changedBy: string | null; createdAt: Date };
export type Conversation = { id: string; userId: string; scenarioId: string; scenarioSnapshot?: Scenario; state: SessionState; createdAt: Date; updatedAt: Date };
export type ConversationTurn = { id: string; sessionId: string; role: ConversationTurnRole; phase: ConversationTurnPhase; text: string; createdAt: Date };
export interface Store {
  ready(): Promise<void>;
  createAccount(email: string, passwordHash: string): Promise<Account>;
  accountByEmail(email: string): Promise<Account | null>;
  accountById(id: string): Promise<Account | null>;
  markEmailVerified(userId: string, now: Date): Promise<Account>;
  issueEmailToken(token: EmailToken, hourlyLimit: number): Promise<boolean>;
  consumeEmailToken(
    hash: string, purpose: EmailTokenPurpose, now: Date, userId?: string, newPasswordHash?: string,
  ): Promise<Account | null>;
  oauthIdentity(provider: OAuthProvider, subject: string): Promise<OAuthIdentity | null>;
  saveOAuthIdentity(identity: OAuthIdentity): Promise<void>;
  createSession(session: LoginSession, expectedPasswordHash?: string): Promise<void>;
  sessionByHash(hash: string): Promise<LoginSession | null>;
  deleteSession(hash: string): Promise<void>;
  deleteSessions(userId: string): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  profile(userId: string): Promise<Profile | null>;
  saveProfile(userId: string, profile: Profile): Promise<void>;
  usage(userId: string, dayKey: string): Promise<UsageSnapshot>;
  reservationSeconds(reservationId: string): Promise<number | null>;
  reserveUsage(reservation: UsageReservation, allowanceSeconds: number): Promise<void>;
  settleUsage(reservationId: string, consumedSeconds: number): Promise<void>;
  voiceMonthUsage(userId: string, monthKey: string): Promise<VoiceMonthUsage>;
  totalVoiceSessions(userId: string): Promise<number>;
  reserveVoiceSession(userId: string, monthKey: string, sessionLimit: number, lifetimeLimit: boolean): Promise<void>;
  releaseVoiceSession(userId: string, monthKey: string, lifetimeLimit: boolean): Promise<void>;
  createConversation(conversation: Conversation): Promise<void>;
  conversation(userId: string, id: string): Promise<Conversation | null>;
  conversations(userId: string, limit?: number): Promise<Conversation[]>;
  updateConversationState(userId: string, id: string, state: SessionState): Promise<Conversation>;
  addConversationTurn(turn: ConversationTurn): Promise<void>;
  conversationTurns(userId: string, sessionId: string): Promise<ConversationTurn[]>;
  customScenarios(): Promise<Scenario[]>;
  createCustomScenario(scenario: Scenario): Promise<void>;
  reviewCustomScenario(id: string, status: "draft" | "published" | "deprecated", reviewerId: string | null, reviewedAt: Date): Promise<Scenario | null>;
  scenarioRevisions(id: string): Promise<ScenarioRevision[]>;
  rollbackCustomScenario(id: string, revisionId: string, reviewerId: string | null, reviewedAt: Date): Promise<Scenario | null>;
  entitlement(userId: string): Promise<Entitlement | null>;
  entitlementByTransactionId(transactionId: string): Promise<Entitlement | null>;
  entitlementByOriginalTransactionId(provider: "apple" | "google", originalTransactionId: string): Promise<Entitlement | null>;
  entitlementByPurchaseToken(provider: "apple" | "google", purchaseToken: string): Promise<Entitlement | null>;
  saveEntitlement(entitlement: Entitlement): Promise<void>;
  createPurchaseIntent(intent: PurchaseIntent): Promise<void>;
  purchaseIntent(id: string): Promise<PurchaseIntent | null>;
  completePurchaseIntent(id: string): Promise<void>;
  createVoiceSession(session: VoiceSession): Promise<void>;
  activeVoiceSession(userId: string): Promise<VoiceSession | null>;
  voiceSession(userId: string, id: string): Promise<VoiceSession | null>;
  bindVoiceProviderCall(userId: string, id: string, providerCallId: string): Promise<VoiceSession>;
  markVoiceProviderTerminated(id: string, terminatedAt: Date): Promise<void>;
  pendingVoiceProviderCalls(): Promise<VoiceSession[]>;
  endVoiceSession(userId: string, id: string, endedAt: Date, status: "ended" | "expired", consumedSeconds: number): Promise<VoiceSession>;
  expireVoiceSessions(now: Date): Promise<number>;
}
export class ConflictError extends Error {}
