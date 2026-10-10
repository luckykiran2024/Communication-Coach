import {
  assessmentInstructions, assessmentJsonSchema, assessmentRubrics, type Scenario,
} from "@coach/core";
import type { ConversationTurn } from "./store";

export type AssessmentInput = { scenario: Scenario; turns: ConversationTurn[]; model: string; signal: AbortSignal };
export type AssessmentOutput = { value: unknown; inputTokens: number; outputTokens: number; costMicros: number | null };
export interface AssessmentProvider { assess(input: AssessmentInput): Promise<AssessmentOutput> }

function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value).filter(([key]) => key !== "$schema")
    .map(([key, child]) => key === "const" ? ["enum", [child]] : [key, providerSchema(child)]);
  return Object.fromEntries(entries);
}

export class OpenAIAssessmentProvider implements AssessmentProvider {
  constructor(private readonly options: {
    apiKey: string; fetchImpl?: typeof fetch; inputMicrosPerMillion?: number; outputMicrosPerMillion?: number;
  }) {}

  async assess(input: AssessmentInput): Promise<AssessmentOutput> {
    const rubric = assessmentRubrics[input.scenario.module];
    const response = await (this.options.fetchImpl ?? fetch)("https://api.openai.com/v1/responses", {
      method: "POST", redirect: "error", signal: input.signal,
      headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model, store: false, max_output_tokens: 4000,
        instructions: assessmentInstructions,
        input: JSON.stringify({
          scenario: input.scenario, rubric, modelVersion: input.model, rubricVersion: rubric.version,
          turns: input.turns.filter(turn => turn.role === "user").map(({ id, phase, text }) => ({ id, phase, text })),
        }),
        text: { format: { type: "json_schema", name: "communication_feedback", strict: true,
          schema: providerSchema(assessmentJsonSchema) } },
      }),
    });
    if (!response.ok) throw new Error("Assessment provider unavailable");
    const data = await response.json() as {
      status?: string; usage?: { input_tokens?: number; output_tokens?: number };
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    };
    const inputTokens = data.usage?.input_tokens;
    const outputTokens = data.usage?.output_tokens;
    if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)
      || inputTokens! < 0 || outputTokens! < 0) throw new Error("Assessment usage missing");
    const text = data.status === "completed" ? data.output?.filter(item => item.type === "message")
      .flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text ?? "").join("") : "";
    const { inputMicrosPerMillion, outputMicrosPerMillion } = this.options;
    const costMicros = inputMicrosPerMillion === undefined || outputMicrosPerMillion === undefined ? null
      : Math.ceil((inputTokens! * inputMicrosPerMillion + outputTokens! * outputMicrosPerMillion) / 1_000_000);
    return { value: text, inputTokens: inputTokens!, outputTokens: outputTokens!, costMicros };
  }
}
