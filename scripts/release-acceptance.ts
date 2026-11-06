import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const acceptanceChecks = ["email", "oauth", "billing", "assessment", "voice", "scheduler", "database", "moderation", "accountDeletion", "androidDevice"] as const;
export function validateReleaseAcceptance(value: unknown, candidate: { commit: string; buildId: string; aabSha256: string }, now = new Date()) {
  const errors: string[] = [];
  const evidence = value as Record<string, unknown> | null;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { valid: false, errors: ["Release acceptance evidence is required."] };
  if (!/^[a-f0-9]{40}$/.test(candidate.commit) || evidence.commit !== candidate.commit) errors.push("Acceptance must match the exact candidate commit.");
  if (!candidate.buildId || evidence.buildId !== candidate.buildId) errors.push("Acceptance must match the exact Android build ID.");
  if (!/^[a-f0-9]{64}$/.test(candidate.aabSha256) || evidence.aabSha256 !== candidate.aabSha256) errors.push("Acceptance must match the actual AAB SHA-256.");
  for (const field of ["apiDeploymentId", "reviewer"] as const) if (typeof evidence[field] !== "string" || !evidence[field].trim() || /replace|example|pending/i.test(evidence[field])) errors.push(`${field} is required.`);
  const testedAt = typeof evidence.testedAt === "string" ? Date.parse(evidence.testedAt) : NaN;
  if (!Number.isFinite(testedAt) || testedAt > now.getTime() || now.getTime() - testedAt > 30 * 86400000) errors.push("Acceptance must be dated within the last 30 days.");
  const checks = evidence.checks as Record<string, unknown> | undefined;
  for (const check of acceptanceChecks) if (checks?.[check] !== "pass") errors.push(`Release acceptance ${check} must pass.`);
  return { valid: errors.length === 0, errors, apiDeploymentId: evidence.apiDeploymentId as string };
}
export function loadReleaseAcceptance() {
  try {
    return validateReleaseAcceptance(JSON.parse(readFileSync(process.env.RELEASE_ACCEPTANCE_PATH!, "utf8")), {
      commit: process.env.RELEASE_COMMIT ?? "", buildId: process.env.RELEASE_BUILD_ID ?? "",
      aabSha256: createHash("sha256").update(readFileSync(process.env.RELEASE_AAB_PATH!)).digest("hex"),
    });
  } catch { return { valid: false, errors: ["Provide RELEASE_ACCEPTANCE_PATH, RELEASE_AAB_PATH, RELEASE_COMMIT and RELEASE_BUILD_ID for the tested Android candidate."] }; }
}
