// src/index.ts
import { z } from "zod";

// content/scenarios.json
var scenarios_default = [
  {
    id: "daily-opening",
    version: 1,
    module: "daily",
    functions: [],
    goal: "Start conversations",
    title: "Your first thirty seconds",
    context: "You are meeting a new colleague before a project meeting.",
    question: "Start the conversation and explain one thing you are working on.",
    independentQuestion: "You meet a colleague from another team at lunch. Open the conversation without using your previous opening.",
    rubricVersion: "daily-1",
    focus: "Conversation initiation"
  },
  {
    id: "engineering-delay",
    version: 1,
    module: "management",
    functions: [
      "Engineering"
    ],
    goal: "Present recommendations",
    title: "A release needs a decision",
    context: "Two integration tests are failing. The release is due Friday. Fixing both is estimated to take three days. Your product partner needs a recommendation.",
    question: "Explain what is known, the release impact, and the decision you recommend.",
    independentQuestion: "A dependency team moves its delivery by a week. Give a new recommendation to your product partner.",
    rubricVersion: "management-1",
    focus: "Evidence, implications and action"
  },
  {
    id: "hr-engagement",
    version: 1,
    module: "management",
    functions: [
      "Human Resources"
    ],
    goal: "Explain ideas clearly",
    title: "Make the survey useful",
    context: "Survey participation fell from 80% to 62%. Among respondents, 45% request clearer career paths. The data does not explain why participation fell.",
    question: "Brief a business leader on the findings, their limitations, and a practical next step.",
    independentQuestion: "Exit interviews from six employees mention workload. Explain what can and cannot be concluded.",
    rubricVersion: "management-1",
    focus: "Facts versus interpretation"
  },
  {
    id: "finance-variance",
    version: 1,
    module: "management",
    functions: [
      "Finance"
    ],
    goal: "Present recommendations",
    title: "Explain the variance",
    context: "Monthly costs are 12% above budget. A one-off equipment purchase accounts for eight percentage points; recurring supplier costs account for four.",
    question: "Explain the variance to the CFO and recommend what to investigate next.",
    independentQuestion: "Revenue is 8% below forecast while new orders are flat. Explain what further evidence you need.",
    rubricVersion: "management-1",
    focus: "Information synthesis"
  },
  {
    id: "product-scope",
    version: 1,
    module: "management",
    functions: [
      "Product Management"
    ],
    goal: "Handle challenging questions",
    title: "Defend a trade-off",
    context: "A customer requests an export feature. Engineering estimates two weeks, which would delay a reliability improvement requested by five customers.",
    question: "Explain a prioritization recommendation to the customer success lead.",
    independentQuestion: "A sales prospect requests a custom dashboard that would delay onboarding fixes. Explain your trade-off.",
    rubricVersion: "management-1",
    focus: "Audience and trade-offs"
  },
  {
    id: "founder-pitch",
    version: 1,
    module: "leadership",
    functions: [
      "Entrepreneurship"
    ],
    goal: "Explain ideas clearly",
    title: "Make the problem matter",
    context: "A potential investor has one minute to understand your business. Use your own facts; do not invent traction.",
    question: "Describe your customer problem, your solution, evidence you have, and the next step you are asking for.",
    independentQuestion: "Explain the same business to a potential customer rather than an investor.",
    rubricVersion: "leadership-1",
    focus: "Audience-appropriate message"
  }
];

// src/scenario-library.ts
var functions = ["Human Resources", "Engineering", "Product Management", "Finance", "Sales", "Marketing", "Operations", "Procurement", "Customer Success", "General Management", "Entrepreneurship", "Other/custom"];
var goals = ["Start conversations", "Explain ideas clearly", "Give constructive feedback", "Present recommendations", "Handle challenging questions"];
var levels = [
  { level: 1, label: "Clarity foundation", prompt: "State the situation, your main point, and one useful next step", transfer: "Change the setting while keeping the same clear structure" },
  { level: 2, label: "Structured message", prompt: "Organize the context, key message, supporting detail, and action", transfer: "Adapt the same message for a different colleague" },
  { level: 3, label: "Evidence and trade-offs", prompt: "Use evidence, explain the implication, and make a reasoned recommendation", transfer: "Respond when one important assumption changes" },
  { level: 4, label: "Audience adaptation", prompt: "Anticipate a concern, adapt your language to the audience, and protect the relationship", transfer: "Answer a challenging follow-up from another stakeholder" },
  { level: 5, label: "Leadership transfer", prompt: "Lead through ambiguity, name the decision, and create alignment without inventing certainty", transfer: "Transfer the communication approach to a new high-stakes situation" }
];
var templates = {
  daily: [
    { slug: "new-colleague", title: "Meet a new colleague", context: "You have thirty seconds before a project meeting with a colleague you have not met.", focus: "Conversation initiation" },
    { slug: "status-update", title: "Give a useful status update", context: "A teammate asks where your work stands while several tasks are moving at once.", focus: "Concise progress" },
    { slug: "ask-for-context", title: "Ask for missing context", context: "You have been given a task but an important requirement is unclear.", focus: "Clear clarification" },
    { slug: "disagree-respectfully", title: "Disagree respectfully", context: "A colleague proposes an approach you believe will create avoidable work.", focus: "Constructive disagreement" },
    { slug: "receive-feedback", title: "Receive difficult feedback", context: "Your manager gives feedback that is useful but uncomfortable to hear.", focus: "Listening and response" },
    { slug: "handoff-work", title: "Hand off work clearly", context: "You need another person to continue a task while you are away.", focus: "Actionable handoff" },
    { slug: "reset-expectations", title: "Reset expectations", context: "A commitment is at risk and the other person has not yet heard the update.", focus: "Early expectation setting" },
    { slug: "close-a-meeting", title: "Close a meeting with clarity", context: "A discussion is ending but the owners and next steps are still unclear.", focus: "Decisions and action" }
  ],
  management: [
    { slug: "prioritize-request", title: "Prioritize a competing request", context: "Two stakeholders want urgent work, but your team can only complete one item this week.", focus: "Trade-off communication" },
    { slug: "explain-delay", title: "Explain a delivery delay", context: "A dependency has moved and your original delivery date is no longer realistic.", focus: "Evidence, impact and action" },
    { slug: "share-limited-data", title: "Share limited data responsibly", context: "Early results suggest a pattern, but the sample is too small for a firm conclusion.", focus: "Facts versus interpretation" },
    { slug: "request-resources", title: "Request additional resources", context: "A recurring workload is above capacity and you need support to protect quality.", focus: "Business case" },
    { slug: "handle-escalation", title: "Handle an escalation", context: "A customer or internal partner is unhappy and wants an immediate answer.", focus: "Composure and resolution" },
    { slug: "recommend-a-change", title: "Recommend a process change", context: "A repeated handoff error is costing time and the team needs a practical improvement.", focus: "Recommendation structure" },
    { slug: "align-on-risk", title: "Align on a material risk", context: "A risk is possible but not certain, and the group needs to decide how much to mitigate.", focus: "Risk and decision" },
    { slug: "give-development-feedback", title: "Give development feedback", context: "A capable colleague needs one specific behavior change to become more effective.", focus: "Specific and useful feedback" }
  ],
  leadership: [
    { slug: "make-the-case", title: "Make the case for an idea", context: "Senior stakeholders will give your proposal only a few minutes of attention.", focus: "Persuasive clarity" },
    { slug: "answer-the-hard-question", title: "Answer the hard question", context: "Someone asks for certainty that the available evidence cannot support.", focus: "Confidence without overclaiming" },
    { slug: "lead-through-change", title: "Lead through change", context: "A change will affect routines and people need to understand both why and what happens next.", focus: "Purpose and direction" },
    { slug: "facilitate-conflict", title: "Facilitate a conflict", context: "Two capable people disagree about priorities and the disagreement is slowing the team.", focus: "Common ground" },
    { slug: "present-a-vision", title: "Present a practical vision", context: "Your audience needs a compelling direction connected to immediate action.", focus: "Vision to action" },
    { slug: "speak-with-uncertainty", title: "Speak with uncertainty", context: "A decision is needed before all information is available.", focus: "Transparent leadership" },
    { slug: "influence-without-authority", title: "Influence without authority", context: "You need another team to support a change even though they do not report to you.", focus: "Stakeholder influence" },
    { slug: "close-a-high-stakes-review", title: "Close a high-stakes review", context: "A review has surfaced concerns and the group needs a responsible commitment.", focus: "Alignment and accountability" }
  ]
};
var generatedScenarios = ["daily", "management", "leadership"].flatMap((module) => templates[module].flatMap((template, templateIndex) => levels.map((level) => {
  const assignedFunctions = module === "daily" ? [] : module === "management" ? [functions[templateIndex % functions.length]] : [...functions];
  const goal = goals[(templateIndex + level.level) % goals.length];
  return {
    id: `library-${module}-${template.slug}-l${level.level}`,
    version: 1,
    module,
    functions: assignedFunctions,
    goal,
    title: `${template.title} \xB7 ${level.label}`,
    context: `${template.context} This is a Level ${level.level} practice for ${level.label.toLowerCase()}.`,
    question: `${level.prompt}. Apply that approach to this situation and keep your answer grounded in what is known.`,
    independentQuestion: `${level.transfer}. Explain what you would say now without repeating your first answer.`,
    rubricVersion: `${module}-library-${level.level}`,
    focus: template.focus,
    level: level.level
  };
})));

// src/index.ts
var brand = { name: "Communication Coach", tagline: "Practice 20 minutes a day and be at brilliance." };
var palette = {
  light: { background: "#FFF7EF", surface: "#FFFFFF", accentSurface: "#FFE6D8", ink: "#1B1D3A", muted: "rgba(27,29,58,0.68)", accent: "#FF5C4D", positive: "#08A889", border: "#FFE6D8" },
  dark: { background: "#0D1124", surface: "#171D36", accentSurface: "#312341", ink: "#F8F5FF", muted: "rgba(248,245,255,0.72)", accent: "#FF806D", positive: "#22C6A4", border: "#312341" }
};
var colorThemes = ["sunrise", "ocean", "berry"];
var colorPalettes = {
  sunrise: palette,
  ocean: {
    light: { background: "#F2FBFA", surface: "#FFFFFF", accentSurface: "#DDF6F2", ink: "#102B3A", muted: "rgba(16,43,58,0.68)", accent: "#007C91", positive: "#00A98F", border: "#DDF6F2" },
    dark: { background: "#071A24", surface: "#102B3A", accentSurface: "#123D49", ink: "#F2FCFF", muted: "rgba(242,252,255,0.72)", accent: "#38C7D7", positive: "#22C6A4", border: "#123D49" }
  },
  berry: {
    light: { background: "#FCF4FB", surface: "#FFFFFF", accentSurface: "#F5E4F4", ink: "#2A1837", muted: "rgba(42,24,55,0.68)", accent: "#B84CBF", positive: "#D45B7A", border: "#F5E4F4" },
    dark: { background: "#1B1024", surface: "#291536", accentSurface: "#3A1C42", ink: "#FFF6FF", muted: "rgba(255,246,255,0.72)", accent: "#E783D4", positive: "#F58AA7", border: "#3A1C42" }
  }
};
var functions2 = ["Human Resources", "Engineering", "Product Management", "Finance", "Sales", "Marketing", "Operations", "Procurement", "Customer Success", "General Management", "Entrepreneurship", "Other/custom"];
var careerLevels = ["Early-career professional", "Experienced individual contributor", "First-time manager", "Experienced manager", "Senior leader", "Executive", "Founder/entrepreneur"];
var goals2 = ["Start conversations", "Explain ideas clearly", "Give constructive feedback", "Present recommendations", "Handle challenging questions"];
var planIds = ["essential", "professional", "executive", "extended"];
var coachAccents = ["Indian English", "British English", "American English", "Australian English"];
var practiceTimezones = ["Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Australia/Sydney"];
var moduleSchema = z.enum(["daily", "management", "leadership"]);
var modules = [
  { id: "daily", title: "Daily Communication", framework: "TASC", description: "Find your first thought. Make your meaning clear." },
  { id: "management", title: "Management & Business", framework: "DIMA \xB7 CLEAR", description: "Turn information into decisions and useful conversations." },
  { id: "leadership", title: "Leadership & Public Speaking", framework: "MESSAGE", description: "Shape a message that moves your audience." }
];
var profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  primaryLanguage: z.string().trim().min(1).max(60).default("English"),
  coachingLanguage: z.literal("English").default("English"),
  function: z.enum(functions2),
  jobTitle: z.string().trim().min(1).max(100),
  careerLevel: z.enum(careerLevels),
  industry: z.string().trim().max(100).default(""),
  audience: z.string().trim().min(1).max(160),
  situations: z.string().trim().max(500).default(""),
  goal: z.enum(goals2),
  challenges: z.string().trim().max(1e3).default(""),
  practiceMinutes: z.number().int().min(2).max(20).default(10),
  planId: z.enum(planIds).default("professional"),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone").default("Asia/Kolkata"),
  reducedMotion: z.boolean().default(false)
}).strict();
var engagementLevels = [
  { level: 1, title: "Getting started", threshold: 0 },
  { level: 2, title: "Finding your voice", threshold: 60 },
  { level: 3, title: "Building momentum", threshold: 150 },
  { level: 4, title: "Clear communicator", threshold: 300 },
  { level: 5, title: "Conversation leader", threshold: 500 }
];
function getEngagementLevel(input) {
  const points = Math.max(0, input.completedSessions * 20 + input.practiceMinutes + input.currentStreakDays * 5);
  const current = [...engagementLevels].reverse().find((item) => points >= item.threshold) ?? engagementLevels[0];
  const next = engagementLevels.find((item) => item.threshold > current.threshold) ?? null;
  return { level: current.level, title: current.title, points, nextLevelPoints: next?.threshold ?? null, pointsToNext: next ? Math.max(0, next.threshold - points) : 0, progressPercent: next ? Math.min(100, Math.max(0, (points - current.threshold) / (next.threshold - current.threshold) * 100)) : 100 };
}
var masteryLevels = [
  { level: 1, title: "Getting started", minimumPracticeDays: 0, completedScenarios: 0, successfulRetries: 0, evidenceAssessments: 0 },
  { level: 2, title: "Finding your voice", minimumPracticeDays: 2, completedScenarios: 1, successfulRetries: 1, evidenceAssessments: 1 },
  { level: 3, title: "Building momentum", minimumPracticeDays: 5, completedScenarios: 3, successfulRetries: 2, evidenceAssessments: 2 },
  { level: 4, title: "Clear communicator", minimumPracticeDays: 10, completedScenarios: 6, successfulRetries: 4, evidenceAssessments: 4 },
  { level: 5, title: "Conversation leader", minimumPracticeDays: 20, completedScenarios: 10, successfulRetries: 7, evidenceAssessments: 7 }
];
function getMasteryLevel(input) {
  const reached = (level) => input.practiceDays >= level.minimumPracticeDays && input.completedScenarios >= level.completedScenarios && input.successfulRetries >= level.successfulRetries && input.evidenceAssessments >= level.evidenceAssessments;
  const current = [...masteryLevels].reverse().find(reached) ?? masteryLevels[0];
  const next = masteryLevels.find((level) => level.level > current.level) ?? null;
  const progressPercent = next ? Math.round([input.practiceDays / Math.max(1, next.minimumPracticeDays), input.completedScenarios / Math.max(1, next.completedScenarios), input.successfulRetries / Math.max(1, next.successfulRetries), input.evidenceAssessments / Math.max(1, next.evidenceAssessments)].map((value) => Math.min(1, value)).reduce((total, value) => total + value, 0) / 4 * 100) : 100;
  return { level: current.level, title: current.title, ...input, nextLevel: next?.level ?? null, progressPercent, nextRequirements: next };
}
var credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
}).strict();
var oauthSchema = z.object({ provider: z.enum(["google", "microsoft"]), accessToken: z.string().trim().min(20).max(5e3) }).strict();
var scenarioSchema = z.object({
  id: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
  module: moduleSchema,
  functions: z.array(z.enum(functions2)).max(functions2.length),
  goal: z.enum(goals2),
  title: z.string().trim().min(1).max(160),
  context: z.string().trim().min(1).max(2e3),
  question: z.string().trim().min(1).max(2e3),
  independentQuestion: z.string().trim().min(1).max(2e3),
  level: z.number().int().min(1).max(5).default(1),
  rubricVersion: z.string().trim().min(1).max(100),
  focus: z.string().trim().min(1).max(200),
  reviewStatus: z.enum(["draft", "published", "deprecated"]).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional()
});
var scenarios = z.array(scenarioSchema).parse([...scenarios_default, ...generatedScenarios]);
function isPublishedScenario(scenario) {
  return scenario.reviewStatus === void 0 || scenario.reviewStatus === "published";
}
function recommendScenarios(profile, catalog = scenarios, masteryLevel = 1, completedScenarioIds = []) {
  const eligible = catalog.filter((scenario) => scenario.level <= Math.min(5, masteryLevel) && (scenario.module === "daily" || scenario.functions.includes(profile.function)));
  const unseen = eligible.filter((scenario) => !completedScenarioIds.includes(scenario.id));
  const source = unseen.length > 0 ? unseen : eligible;
  return source.map((scenario) => ({ scenario, rank: (scenario.functions.includes(profile.function) ? 2 : 0) + (scenario.goal === profile.goal ? 3 : 0) })).sort((first, second) => second.rank - first.rank || first.scenario.id.localeCompare(second.scenario.id)).map((item) => item.scenario);
}
var planSchema = z.object({ id: z.enum(planIds), title: z.string(), targetPriceInr: z.number().positive(), dailySeconds: z.number().int().positive(), modules: z.array(moduleSchema).min(1) });
var plansSchema = z.array(planSchema).length(4).refine((items) => new Set(items.map((item) => item.id)).size === 4);
var states = ["CREATED", "AUTHORIZED", "CONNECTING", "ACTIVE", "PAUSED", "COMPLETED", "ASSESSING", "FEEDBACK_READY", "FAILED", "INTERRUPTED", "CANCELLED", "EXPIRED"];
var transitions = {
  CREATED: ["AUTHORIZED", "COMPLETED", "CANCELLED", "EXPIRED"],
  AUTHORIZED: ["CONNECTING", "CANCELLED", "EXPIRED"],
  CONNECTING: ["ACTIVE", "FAILED", "CANCELLED", "EXPIRED"],
  ACTIVE: ["PAUSED", "COMPLETED", "INTERRUPTED", "FAILED", "EXPIRED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"],
  COMPLETED: ["ASSESSING"],
  ASSESSING: ["FEEDBACK_READY", "FAILED"],
  FEEDBACK_READY: [],
  FAILED: [],
  INTERRUPTED: ["COMPLETED"],
  CANCELLED: [],
  EXPIRED: ["ASSESSING"]
};
function transition(current, next) {
  if (!transitions[current].includes(next)) throw new Error("Invalid session transition");
  return next;
}
var conversationCreateSchema = z.object({ scenarioId: z.string().min(1).max(100) }).strict();
var conversationTurnPhaseSchema = z.enum(["primary", "independent_retry"]);
var conversationTurnSchema = z.object({ role: z.enum(["user", "assistant", "system"]), text: z.string().trim().min(1).max(1e4), phase: conversationTurnPhaseSchema.default("primary") }).strict();
var userConversationTurnSchema = conversationTurnSchema.extend({ role: z.literal("user") });
var voiceTransportStatusSchema = z.object({ platform: z.enum(["android", "ios", "web"]), transport: z.literal("react-native-webrtc"), nativeModuleAvailable: z.boolean(), developmentBuild: z.boolean(), providerConfigured: z.boolean(), liveVoiceAvailable: z.boolean(), code: z.enum(["WEB_PREVIEW_ONLY", "DEV_CLIENT_REQUIRED", "PROVIDER_NOT_CONFIGURED", "READY"]) }).strict();
function voiceTransportStatus(input) {
  const liveVoiceAvailable = input.platform !== "web" && input.nativeModuleAvailable && input.developmentBuild && input.providerConfigured;
  const code = input.platform === "web" ? "WEB_PREVIEW_ONLY" : !input.nativeModuleAvailable || !input.developmentBuild ? "DEV_CLIENT_REQUIRED" : !input.providerConfigured ? "PROVIDER_NOT_CONFIGURED" : "READY";
  return { ...input, transport: "react-native-webrtc", liveVoiceAvailable, code };
}
var assessmentSchema = z.object({
  rubricVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  priorities: z.array(z.object({ observation: z.string().min(1), quote: z.string().min(1), turnId: z.string().min(1), nextExercise: z.string().min(1), confidence: z.enum(["low", "medium", "high"]) }).strict()).max(2),
  audioAssessed: z.literal(false)
}).strict();
function validateAssessment(value, turns) {
  const assessment = assessmentSchema.parse(value);
  for (const evidence of assessment.priorities) {
    if (!turns.some((turn) => turn.id === evidence.turnId && turn.role === "user" && turn.text.includes(evidence.quote))) {
      throw new Error("Evidence must quote a learner turn");
    }
  }
  return assessment;
}
function assessCommunicationEvidence(input) {
  const primary = input.primary.trim();
  const retry = input.retry.trim();
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const primarySubstantive = primary.length >= 40;
  const retrySubstantive = retry.length >= 40;
  const retryIndependent = normalize(primary) !== normalize(retry);
  const structuredMessage = /\b(because|therefore|impact|recommend|evidence|data|known|decision|first|then)\b/i.test(`${primary} ${retry}`);
  const actionableMessage = /\b(will|should|recommend|suggest|propose|plan|ask|next|decision)\b/i.test(retry);
  const criteria = [primarySubstantive, retrySubstantive, retryIndependent, structuredMessage, actionableMessage];
  const score = Math.round(criteria.filter(Boolean).length / criteria.length * 100);
  return { score, passed: score >= 80, primarySubstantive, retrySubstantive, retryIndependent, structuredMessage, actionableMessage };
}
export {
  assessCommunicationEvidence,
  assessmentSchema,
  brand,
  careerLevels,
  coachAccents,
  colorPalettes,
  colorThemes,
  conversationCreateSchema,
  conversationTurnPhaseSchema,
  conversationTurnSchema,
  credentialsSchema,
  engagementLevels,
  functions2 as functions,
  getEngagementLevel,
  getMasteryLevel,
  goals2 as goals,
  isPublishedScenario,
  masteryLevels,
  moduleSchema,
  modules,
  oauthSchema,
  palette,
  planIds,
  planSchema,
  plansSchema,
  practiceTimezones,
  profileSchema,
  recommendScenarios,
  scenarioSchema,
  scenarios,
  states,
  transition,
  userConversationTurnSchema,
  validateAssessment,
  voiceTransportStatus,
  voiceTransportStatusSchema
};

