export type TelemetryEvent =
  | { name: "onboarding_started" }
  | { name: "onboarding_completed"; planRecommended?: string; goal?: string }
  | { name: "exercise_started"; scenarioId: string; module: string; phase?: string }
  | { name: "exercise_turn_submitted"; phase: string; turnCount: number }
  | { name: "exercise_completed"; scenarioId: string; score?: number }
  | { name: "ai_coach_connected"; transport: string }
  | { name: "ai_coach_disconnected"; durationSeconds: number }
  | { name: "ai_coach_error"; error: string }
  | { name: "plan_viewed"; planId?: string }
  | { name: "payment_started"; planId: string }
  | { name: "payment_completed"; planId: string }
  | { name: "api_latency"; endpoint: string; durationMs: number }
  | { name: "api_failure"; endpoint: string; error: string };

const eventLog: (TelemetryEvent & { timestamp: number })[] = [];

export function trackEvent(event: TelemetryEvent) {
  const logged = { ...event, timestamp: Date.now() };
  eventLog.push(logged);
  if (eventLog.length > 200) eventLog.shift();
  if (__DEV__) {
    // Structured telemetry logging during development
    console.log(`[Telemetry] ${event.name}`, event);
  }
}

export function getTelemetryHistory() {
  return [...eventLog];
}
