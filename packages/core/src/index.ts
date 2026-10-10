import { z } from "zod";
import { z as assessmentZod } from "zod/v4";
export { assessmentRubrics, assessmentInstructions } from "./rubrics";
import scenarioData from "../content/scenarios.json" with { type: "json" };
import hrManagerDrafts from "../content/hr-manager-pack.json" with { type: "json" };
import { generatedScenarios } from "./scenario-library";
export const brand = { name: "Communication Coach", tagline: "Speak with clarity. Lead with confidence." };
export const palette = {
  light: { background: "#FFF7EF", surface: "#FFFFFF", accentSurface: "#FFE6D8", ink: "#1B1D3A", muted: "rgba(27,29,58,0.68)", accent: "#FF5C4D", positive: "#08A889", border: "#FFE6D8" },
  dark: { background: "#0D1124", surface: "#171D36", accentSurface: "#312341", ink: "#F8F5FF", muted: "rgba(248,245,255,0.72)", accent: "#FF806D", positive: "#22C6A4", border: "#312341" },
};
export const colorThemes = ["sunrise", "ocean", "berry"] as const;
export type ColorTheme = typeof colorThemes[number];
export const colorPalettes = {
  sunrise: palette,
  ocean: {
    light: { background: "#F2FBFA", surface: "#FFFFFF", accentSurface: "#DDF6F2", ink: "#102B3A", muted: "rgba(16,43,58,0.68)", accent: "#007C91", positive: "#00A98F", border: "#DDF6F2" },
    dark: { background: "#071A24", surface: "#102B3A", accentSurface: "#123D49", ink: "#F2FCFF", muted: "rgba(242,252,255,0.72)", accent: "#38C7D7", positive: "#22C6A4", border: "#123D49" },
  },
  berry: {
    light: { background: "#FCF4FB", surface: "#FFFFFF", accentSurface: "#F5E4F4", ink: "#2A1837", muted: "rgba(42,24,55,0.68)", accent: "#B84CBF", positive: "#D45B7A", border: "#F5E4F4" },
    dark: { background: "#1B1024", surface: "#291536", accentSurface: "#3A1C42", ink: "#FFF6FF", muted: "rgba(255,246,255,0.72)", accent: "#E783D4", positive: "#F58AA7", border: "#3A1C42" },
  },
} as const;
export const functions = ["Human Resources", "Engineering", "Product Management", "Finance", "Sales", "Marketing", "Operations", "Procurement", "Customer Success", "General Management", "Entrepreneurship", "Other/custom"] as const;
export const careerLevels = ["Early-career professional", "Experienced individual contributor", "First-time manager", "Experienced manager", "Senior leader", "Executive", "Founder/entrepreneur"] as const;
export const goals = ["Start conversations", "Explain ideas clearly", "Give constructive feedback", "Present recommendations", "Handle challenging questions"] as const;
export const planIds = ["free", "essential", "professional", "executive", "extended"] as const;
export const coachAccents = ["Indian English", "British English", "American English", "Australian English"] as const;
export type CoachAccent = typeof coachAccents[number];
export const practiceTimezones = ["Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Australia/Sydney"] as const;
export const moduleSchema = z.enum(["daily", "management", "leadership"]);
export type LearningModule = z.infer<typeof moduleSchema>;
export const modules: { id: LearningModule; title: string; framework: string; description: string }[] = [
  { id: "daily", title: "Daily Communication", framework: "TASC", description: "Find your first thought. Make your meaning clear." },
  { id: "management", title: "Professional & Business Communication", framework: "DIMA · CLEAR", description: "Make sound recommendations, handle business conversations, and turn information into decisions." },
  { id: "leadership", title: "Leadership & Public Speaking", framework: "MESSAGE", description: "Shape a message that moves your audience." },
];
export const practicePrograms = [
  { level: 1, title: "Clarity foundation", description: "State the situation, your main point, and a useful next step." },
  { level: 2, title: "Structured message", description: "Organise context, key message, supporting detail, and action." },
  { level: 3, title: "Evidence and trade-offs", description: "Use evidence, explain implications, and make a reasoned recommendation." },
  { level: 4, title: "Audience adaptation", description: "Anticipate concerns and adapt your message to the audience." },
  { level: 5, title: "Leadership transfer", description: "Lead through ambiguity and create alignment without overstating certainty." },
] as const;
export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  primaryLanguage: z.string().trim().min(1).max(60).default("English"),
  coachingLanguage: z.literal("English").default("English"),
  function: z.enum(functions),
  jobTitle: z.string().trim().min(1).max(100),
  careerLevel: z.enum(careerLevels),
  industry: z.string().trim().max(100).default(""),
  audience: z.string().trim().min(1).max(160),
  situations: z.string().trim().max(500).default(""),
  goal: z.enum(goals),
  challenges: z.string().trim().max(1000).default(""),
  practiceMinutes: z.number().int().min(2).max(20).default(10),
  planId: z.enum(planIds).default("professional"),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Use a valid IANA timezone").default("Asia/Kolkata"),
  reducedMotion: z.boolean().default(false),
}).strict();
export type Profile = z.infer<typeof profileSchema>;
export const engagementLevels = [
  { level: 1, title: "Getting started", threshold: 0 },
  { level: 2, title: "Finding your voice", threshold: 60 },
  { level: 3, title: "Building momentum", threshold: 150 },
  { level: 4, title: "Clear communicator", threshold: 300 },
  { level: 5, title: "Conversation leader", threshold: 500 },
] as const;
export type EngagementLevel = { level: number; title: string; points: number; nextLevelPoints: number | null; pointsToNext: number; progressPercent: number };
export function getEngagementLevel(input: { completedSessions: number; practiceMinutes: number; currentStreakDays: number }): EngagementLevel {
  const points = Math.max(0, input.completedSessions * 20 + input.practiceMinutes + input.currentStreakDays * 5);
  const current = [...engagementLevels].reverse().find(item => points >= item.threshold) ?? engagementLevels[0];
  const next = engagementLevels.find(item => item.threshold > current.threshold) ?? null;
  return { level: current.level, title: current.title, points, nextLevelPoints: next?.threshold ?? null, pointsToNext: next ? Math.max(0, next.threshold - points) : 0, progressPercent: next ? Math.min(100, Math.max(0, ((points - current.threshold) / (next.threshold - current.threshold)) * 100)) : 100 };
}
export const masteryLevels = [
  { level: 1, title: "Getting started", minimumPracticeDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 },
  { level: 2, title: "Finding your voice", minimumPracticeDays: 2, completedScenarios: 1, successfulRetries: 1, evidenceAssessments: 1 },
  { level: 3, title: "Building momentum", minimumPracticeDays: 5, completedScenarios: 3, successfulRetries: 2, evidenceAssessments: 2 },
  { level: 4, title: "Clear communicator", minimumPracticeDays: 10, completedScenarios: 6, successfulRetries: 4, evidenceAssessments: 4 },
  { level: 5, title: "Conversation leader", minimumPracticeDays: 20, completedScenarios: 10, successfulRetries: 7, evidenceAssessments: 7 },
] as const;
export type MasteryProgress = {
  level: number; title: string; practiceDays: number; completedScenarios: number; successfulRetries: number; evidenceAssessments: number;
  nextLevel: number | null; progressPercent: number; nextRequirements: typeof masteryLevels[number] | null;
};
export function getMasteryLevel(input: Pick<MasteryProgress, "practiceDays" | "completedScenarios" | "successfulRetries" | "evidenceAssessments">): MasteryProgress {
  const reached = (level: typeof masteryLevels[number]) => input.practiceDays >= level.minimumPracticeDays && input.completedScenarios >= level.completedScenarios && input.successfulRetries >= level.successfulRetries && input.evidenceAssessments >= level.evidenceAssessments;
  const current = [...masteryLevels].reverse().find(reached) ?? masteryLevels[0];
  const next = masteryLevels.find(level => level.level > current.level) ?? null;
  const progressPercent = next ? Math.round(([input.practiceDays / Math.max(1, next.minimumPracticeDays), input.completedScenarios / Math.max(1, next.completedScenarios), input.successfulRetries / Math.max(1, next.successfulRetries), input.evidenceAssessments / Math.max(1, next.evidenceAssessments)].map(value => Math.min(1, value)).reduce((total, value) => total + value, 0) / 4) * 100) : 100;
  return { level: current.level, title: current.title, ...input, nextLevel: next?.level ?? null, progressPercent, nextRequirements: next };
}
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
}).strict();
export const oauthSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("google"), accessToken: z.string().trim().min(20).max(5000) }).strict(),
  z.object({ provider: z.literal("microsoft"), idToken: z.string().trim().min(20).max(10000) }).strict(),
]);
export const scenarioSchema = z.object({
  id: z.string().trim().min(1).max(120), version: z.number().int().positive(), module: moduleSchema,
  functions: z.array(z.enum(functions)).max(functions.length), goal: z.enum(goals), title: z.string().trim().min(1).max(160),
  context: z.string().trim().min(1).max(2000), question: z.string().trim().min(1).max(2000), independentQuestion: z.string().trim().min(1).max(2000), level: z.number().int().min(1).max(5).default(1),
  rubricVersion: z.string().trim().min(1).max(100), focus: z.string().trim().min(1).max(200),
  reviewStatus: z.enum(["draft", "published", "deprecated"]).optional(), ownerId: z.string().uuid().nullable().optional(), reviewedBy: z.string().uuid().nullable().optional(), reviewedAt: z.string().datetime().nullable().optional(),
});
export type Scenario = z.infer<typeof scenarioSchema>;
export const scenarios = z.array(scenarioSchema).parse([...scenarioData, ...generatedScenarios, ...hrManagerDrafts]);
export function isPublishedScenario(scenario: Scenario) { return scenario.reviewStatus === undefined || scenario.reviewStatus === "published"; }
export function recommendScenarios(profile: Profile, catalog: readonly Scenario[] = scenarios, masteryLevel = 1, completedScenarioIds: readonly string[] = []): Scenario[] {
  const eligible = catalog.filter(scenario => isPublishedScenario(scenario) && scenario.level <= Math.min(5, masteryLevel)
    && (scenario.module === "daily" || scenario.functions.includes(profile.function)));
  const unseen = eligible.filter(scenario => !completedScenarioIds.includes(scenario.id));
  const source = unseen.length > 0 ? unseen : eligible;
  return source
    .map(scenario => ({ scenario, rank: (scenario.functions.includes(profile.function) ? 2 : 0) + (scenario.goal === profile.goal ? 3 : 0) }))
    .sort((first, second) => second.rank - first.rank || first.scenario.id.localeCompare(second.scenario.id))
    .map(item => item.scenario);
}
export const planSchema = z.object({
  id: z.enum(planIds),
  title: z.string(),
  targetPriceInr: z.number().nonnegative(),
  voiceSessionsPerMonth: z.number().int().positive(),
  maxSessionSeconds: z.number().int().positive(),
  modules: z.array(moduleSchema).min(1),
});
export const plansSchema = z.array(planSchema).length(5).refine(items =>
  new Set(items.map(item => item.id)).size === 5 && items.some(item => item.id === "free" && item.targetPriceInr === 0),
);
export type Plan = z.infer<typeof planSchema>;
export const states = ["CREATED", "AUTHORIZED", "CONNECTING", "ACTIVE", "PAUSED", "COMPLETED", "ASSESSING", "FEEDBACK_READY", "FAILED", "INTERRUPTED", "CANCELLED", "EXPIRED"] as const;
export type SessionState = typeof states[number];
const transitions: Record<SessionState, readonly SessionState[]> = {
  CREATED: ["AUTHORIZED", "COMPLETED", "CANCELLED", "EXPIRED"], AUTHORIZED: ["CONNECTING", "CANCELLED", "EXPIRED"],
  CONNECTING: ["ACTIVE", "FAILED", "CANCELLED", "EXPIRED"], ACTIVE: ["PAUSED", "COMPLETED", "INTERRUPTED", "FAILED", "EXPIRED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"], COMPLETED: ["ASSESSING"],
  ASSESSING: ["FEEDBACK_READY", "FAILED"], FEEDBACK_READY: [], FAILED: [],
  INTERRUPTED: ["AUTHORIZED", "COMPLETED"], CANCELLED: [], EXPIRED: ["ASSESSING"],
};
export function transition(current: SessionState, next: SessionState): SessionState {
  if (!transitions[current].includes(next)) throw new Error("Invalid session transition");
  return next;
}
export const conversationCreateSchema = z.object({ scenarioId: z.string().min(1).max(100) }).strict();
export const conversationTurnPhaseSchema = z.enum(["primary", "independent_retry"]);
export type ConversationTurnPhase = z.infer<typeof conversationTurnPhaseSchema>;
export const conversationTurnSchema = z.object({ role: z.enum(["user", "assistant", "system"]), text: z.string().trim().min(1).max(10000), phase: conversationTurnPhaseSchema.default("primary") }).strict();
export const userConversationTurnSchema = conversationTurnSchema.omit({ phase: true })
  .extend({ role: z.literal("user"), phase: z.unknown().optional() });
export type ConversationTurnRole = z.infer<typeof conversationTurnSchema>["role"];
export const voiceTransportStatusSchema = z.object({ platform: z.enum(["android", "ios", "web"]), transport: z.literal("react-native-webrtc"), nativeModuleAvailable: z.boolean(), developmentBuild: z.boolean(), providerConfigured: z.boolean(), liveVoiceAvailable: z.boolean(), code: z.enum(["WEB_PREVIEW_ONLY", "DEV_CLIENT_REQUIRED", "PROVIDER_NOT_CONFIGURED", "READY"]) }).strict();
export type VoiceTransportStatus = z.infer<typeof voiceTransportStatusSchema>;
export function voiceTransportStatus(input: Pick<VoiceTransportStatus, "platform" | "nativeModuleAvailable" | "developmentBuild" | "providerConfigured">): VoiceTransportStatus {
  const liveVoiceAvailable = input.platform !== "web" && input.nativeModuleAvailable && input.developmentBuild && input.providerConfigured;
  const code = input.platform === "web" ? "WEB_PREVIEW_ONLY" : !input.nativeModuleAvailable || !input.developmentBuild ? "DEV_CLIENT_REQUIRED" : !input.providerConfigured ? "PROVIDER_NOT_CONFIGURED" : "READY";
  return { ...input, transport: "react-native-webrtc", liveVoiceAvailable, code };
}
export const assessmentSchema = assessmentZod.object({
  rubricVersion: assessmentZod.string().min(1), modelVersion: assessmentZod.string().min(1),
  priorities: assessmentZod.array(assessmentZod.object({
    observation: assessmentZod.string().min(1).max(1200), quote: assessmentZod.string().trim().min(1).max(2000),
    turnId: assessmentZod.string().min(1), nextExercise: assessmentZod.string().min(1).max(1200),
    confidence: assessmentZod.enum(["low", "medium", "high"]),
  }).strict()).max(2),
  audioAssessed: assessmentZod.literal(false),
}).strict();
export const feedbackAssessmentSchema = assessmentSchema.extend({
  transferResult: assessmentZod.enum(["demonstrated", "partial", "not_yet"]),
});
export type FeedbackAssessment = assessmentZod.infer<typeof feedbackAssessmentSchema>;
export const assessmentJsonSchema = assessmentZod.toJSONSchema(feedbackAssessmentSchema);
export function validateAssessment(value: unknown, turns: { id: string; role: string; text: string }[]) {
  const assessment = assessmentSchema.parse(value);
  for (const evidence of assessment.priorities) {
    if (!turns.some(turn => turn.id === evidence.turnId && turn.role === "user" && turn.text.includes(evidence.quote))) {
      throw new Error("Evidence must quote a learner turn");
    }
  }
  return assessment;
}
export type CommunicationEvidence = { score: number; passed: boolean; primarySubstantive: boolean; retrySubstantive: boolean; retryIndependent: boolean; structuredMessage: boolean; actionableMessage: boolean };
export function assessCommunicationEvidence(input: { primary: string; retry: string }): CommunicationEvidence {
  const primary = input.primary.trim();
  const retry = input.retry.trim();
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const primarySubstantive = primary.length >= 40;
  const retrySubstantive = retry.length >= 40;
  const retryIndependent = normalize(primary) !== normalize(retry);
  const structuredMessage = /\b(because|therefore|impact|recommend|evidence|data|known|decision|first|then)\b/i.test(`${primary} ${retry}`);
  const actionableMessage = /\b(will|should|recommend|suggest|propose|plan|ask|next|decision)\b/i.test(retry);
  const criteria = [primarySubstantive, retrySubstantive, retryIndependent, structuredMessage, actionableMessage];
  const score = Math.round((criteria.filter(Boolean).length / criteria.length) * 100);
  return { score, passed: score >= 80, primarySubstantive, retrySubstantive, retryIndependent, structuredMessage, actionableMessage };
}
