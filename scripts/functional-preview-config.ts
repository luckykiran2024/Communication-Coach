export function requireFunctionalPreview(env: NodeJS.ProcessEnv = process.env) {
  if (env.COACH_FUNCTIONAL_PREVIEW !== "true" || env.NODE_ENV === "production" || env.VERCEL) {
    throw new Error("Functional fixtures require explicit local-only opt-in and cannot run on Vercel or in production.");
  }
}

export const functionalPreviewNotice = "LOCAL FUNCTIONAL TEST — disposable memory data; simulated AI, email and payment. "
  + "No real provider or store validation.";
