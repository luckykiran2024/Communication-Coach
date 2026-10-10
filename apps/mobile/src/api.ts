import type { EngagementLevel, MasteryProgress, Profile, Scenario, Plan } from "@coach/core";
import { Platform } from "react-native";
export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function request<Result>(path: string, token?: string | null, method = "GET", body?: unknown): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(apiUrl + path, {
      method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("Cannot reach the server. Check your connection and API address."); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error ?? "Unable to complete this request.", response.status);
  }
  return response.status === 204 ? undefined as Result : response.json();
}
export type Me = { user: { id: string; email: string; emailVerifiedAt: string | null }; profile: Profile | null };
export type Catalog = { plans: Plan[]; priceNotice: string; liveVoiceAvailable: boolean };
export type Recommendations = { scenarios: Scenario[]; previewOnly: boolean };
export type ProgressSnapshot = { totalSessions: number; completedSessions: number; weeklySessions: number; practiceMinutes: number; weeklyPracticeMinutes: number; currentStreakDays: number; engagement: EngagementLevel; mastery: MasteryProgress; practiceDays: number; completedScenarios: number; successfulRetries: number; evidenceAssessments: number; dailyPractice: { day: string; minutes: number; sessions: number }[]; levelTrack: { level: number; title: string; reached: boolean }[]; skillSignal: number | null; skillSignalStatus: "awaiting_assessment" | "available" };
export type VoiceCapabilities = { platform: "android" | "ios" | "web"; transport: "react-native-webrtc"; nativeModuleAvailable: boolean; developmentBuild: boolean; providerConfigured: boolean; liveVoiceAvailable: boolean; code: "WEB_PREVIEW_ONLY" | "DEV_CLIENT_REQUIRED" | "PROVIDER_NOT_CONFIGURED" | "READY" };
