import type { MasteryProgress, Plan, Profile, Scenario } from "@coach/core";
import type { Store } from "../store";
import type { AuthDependencies } from "../lib/auth-context";
import type { RealtimeVoiceProvider } from "../realtime-voice-provider";
import type { VerifiedAppleNotification, VerifiedStorePurchase } from "../store-verifier";
import type { OAuthOptions } from "../lib/oauth";
import type { EmailSender } from "../email-sender";
import type { AssessmentProvider } from "../assessment-provider";

export type BillingOptions = {
  enabled?: boolean;
  webhookSecret?: string;
  googleNotificationSecret?: string;
  verifyGoogleNotificationRequest?: (authorization: string | undefined) => Promise<boolean>;
  productMap?: Record<string, string>;
  verifyPurchase?: (input: { provider: "apple" | "google"; productId: string; transactionId: string; purchaseToken: string }) => Promise<VerifiedStorePurchase | null>;
  verifyAppleNotification?: (signedPayload: string) => Promise<VerifiedAppleNotification | null>;
};

export type BuildAppOptions = {
  runtime?: "server" | "serverless";
  cronSecret?: string;
  rateLimitMax?: number;
  rateLimitNamespace?: string;
  logger?: boolean;
  origins?: string[];
  now?: () => Date;
  managerEmails?: string[];
  billing?: BillingOptions;
  voice?: { enabled?: boolean; apiKey?: string; model?: string; voice?: string; fetchImpl?: typeof fetch };
  devPlanId?: string;
  oauth?: OAuthOptions;
  assessment?: {
    enabled?: boolean; provider?: AssessmentProvider; apiKey?: string; model?: string; timeoutMs?: number;
    inputMicrosPerMillion?: number; outputMicrosPerMillion?: number;
  };
  email?: { sender: EmailSender | null; linkBaseUrl?: string };
};

export type RouteDependencies = AuthDependencies & {
  store: Store;
  now: () => Date;
  plans: Plan[];
  dummyHash: string;
  emailSender: EmailSender | null;
  emailLinkBaseUrl: string;
  availableScenarios: () => Promise<Scenario[]>;
  billingEnabled: boolean;
  billingWebhookSecret: string;
  googleNotificationSecret: string;
  billingProductMap: Record<string, string>;
  billing?: BillingOptions;
  realtimeProvider: RealtimeVoiceProvider | null;
  realtimeConfigured: boolean;
  realtimeModel: string;
  assessmentEnabled: boolean;
  assessmentProvider: AssessmentProvider | null;
  assessmentModel: string;
  assessmentTimeoutMs: number;
  reapVoiceSessions: () => Promise<void>;
  activePlan: (userId: string) => Promise<Plan>;
  planForProduct: (productId: string) => Plan | undefined;
  learnerScenarioProgress: (userId: string, profile: Profile | null) => Promise<{ mastery: MasteryProgress; completedScenarioIds: string[] }>;
};
