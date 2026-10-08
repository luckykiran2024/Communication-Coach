type ScenarioModule = "daily" | "management" | "leadership";
type ScenarioTemplate = { slug: string; title: string; context: string; focus: string };
type ScenarioLevel = { level: number; label: string; prompt: string; transfer: string };

const functions = ["Human Resources", "Engineering", "Product Management", "Finance", "Sales", "Marketing", "Operations", "Procurement", "Customer Success", "General Management", "Entrepreneurship", "Other/custom"];
const goals = ["Start conversations", "Explain ideas clearly", "Give constructive feedback", "Present recommendations", "Handle challenging questions"] as const;
const levels: ScenarioLevel[] = [
  { level: 1, label: "Clarity foundation", prompt: "State the situation, your main point, and one useful next step", transfer: "Change the setting while keeping the same clear structure" },
  { level: 2, label: "Structured message", prompt: "Organize the context, key message, supporting detail, and action", transfer: "Adapt the same message for a different colleague" },
  { level: 3, label: "Evidence and trade-offs", prompt: "Use evidence, explain the implication, and make a reasoned recommendation", transfer: "Respond when one important assumption changes" },
  { level: 4, label: "Audience adaptation", prompt: "Anticipate a concern, adapt your language to the audience, and protect the relationship", transfer: "Answer a challenging follow-up from another stakeholder" },
  { level: 5, label: "Leadership transfer", prompt: "Lead through ambiguity, name the decision, and create alignment without inventing certainty", transfer: "Transfer the communication approach to a new high-stakes situation" },
];

const templates: Record<ScenarioModule, ScenarioTemplate[]> = {
  daily: [
    { slug: "new-colleague", title: "Meet a new colleague", context: "You have thirty seconds before a project meeting with a colleague you have not met.", focus: "Conversation initiation" },
    { slug: "status-update", title: "Give a useful status update", context: "A teammate asks where your work stands while several tasks are moving at once.", focus: "Concise progress" },
    { slug: "ask-for-context", title: "Ask for missing context", context: "You have been given a task but an important requirement is unclear.", focus: "Clear clarification" },
    { slug: "disagree-respectfully", title: "Disagree respectfully", context: "A colleague proposes an approach you believe will create avoidable work.", focus: "Constructive disagreement" },
    { slug: "receive-feedback", title: "Receive difficult feedback", context: "Your manager gives feedback that is useful but uncomfortable to hear.", focus: "Listening and response" },
    { slug: "handoff-work", title: "Hand off work clearly", context: "You need another person to continue a task while you are away.", focus: "Actionable handoff" },
    { slug: "reset-expectations", title: "Reset expectations", context: "A commitment is at risk and the other person has not yet heard the update.", focus: "Early expectation setting" },
    { slug: "close-a-meeting", title: "Close a meeting with clarity", context: "A discussion is ending but the owners and next steps are still unclear.", focus: "Decisions and action" },
  ],
  management: [
    { slug: "prioritize-request", title: "Prioritize a competing request", context: "Two stakeholders want urgent work, but your team can only complete one item this week.", focus: "Trade-off communication" },
    { slug: "explain-delay", title: "Explain a delivery delay", context: "A dependency has moved and your original delivery date is no longer realistic.", focus: "Evidence, impact and action" },
    { slug: "share-limited-data", title: "Share limited data responsibly", context: "Early results suggest a pattern, but the sample is too small for a firm conclusion.", focus: "Facts versus interpretation" },
    { slug: "request-resources", title: "Request additional resources", context: "A recurring workload is above capacity and you need support to protect quality.", focus: "Business case" },
    { slug: "handle-escalation", title: "Handle an escalation", context: "A customer or internal partner is unhappy and wants an immediate answer.", focus: "Composure and resolution" },
    { slug: "recommend-a-change", title: "Recommend a process change", context: "A repeated handoff error is costing time and the team needs a practical improvement.", focus: "Recommendation structure" },
    { slug: "align-on-risk", title: "Align on a material risk", context: "A risk is possible but not certain, and the group needs to decide how much to mitigate.", focus: "Risk and decision" },
    { slug: "give-development-feedback", title: "Give development feedback", context: "A capable colleague needs one specific behavior change to become more effective.", focus: "Specific and useful feedback" },
  ],
  leadership: [
    { slug: "make-the-case", title: "Make the case for an idea", context: "Senior stakeholders will give your proposal only a few minutes of attention.", focus: "Persuasive clarity" },
    { slug: "answer-the-hard-question", title: "Answer the hard question", context: "Someone asks for certainty that the available evidence cannot support.", focus: "Confidence without overclaiming" },
    { slug: "lead-through-change", title: "Lead through change", context: "A change will affect routines and people need to understand both why and what happens next.", focus: "Purpose and direction" },
    { slug: "facilitate-conflict", title: "Facilitate a conflict", context: "Two capable people disagree about priorities and the disagreement is slowing the team.", focus: "Common ground" },
    { slug: "present-a-vision", title: "Present a practical vision", context: "Your audience needs a compelling direction connected to immediate action.", focus: "Vision to action" },
    { slug: "speak-with-uncertainty", title: "Speak with uncertainty", context: "A decision is needed before all information is available.", focus: "Transparent leadership" },
    { slug: "influence-without-authority", title: "Influence without authority", context: "You need another team to support a change even though they do not report to you.", focus: "Stakeholder influence" },
    { slug: "close-a-high-stakes-review", title: "Close a high-stakes review", context: "A review has surfaced concerns and the group needs a responsible commitment.", focus: "Alignment and accountability" },
  ],
};

export const generatedScenarios = (["daily", "management", "leadership"] as const).flatMap(module => templates[module].flatMap((template, templateIndex) => levels.map(level => {
  const assignedFunctions = module === "daily" ? [] : module === "management" ? [functions[templateIndex % functions.length]] : [...functions];
  const goal = goals[(templateIndex + level.level) % goals.length];
  return {
    id: `library-${module}-${template.slug}-l${level.level}`,
    version: 1,
    module,
    functions: assignedFunctions,
    goal,
    title: `${template.title} · ${level.label}`,
    context: `${template.context} This is a Level ${level.level} practice for ${level.label.toLowerCase()}.`,
    question: `${level.prompt}. Apply that approach to this situation and keep your answer grounded in what is known.`,
    independentQuestion: `${level.transfer}. Explain what you would say now without repeating your first answer.`,
    rubricVersion: `${module}-library-${level.level}`,
    focus: template.focus,
    level: level.level,
  };
})));
