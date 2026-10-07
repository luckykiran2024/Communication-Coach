import { readFileSync } from "node:fs";

export const nativeQaPlatforms = ["android", "ios"] as const;
export const nativeQaChecks = ["microphone", "playback", "backgroundInterruption", "screenReader", "textScaling", "reducedMotion", "keyboard"] as const;
type NativeQaPlatform = typeof nativeQaPlatforms[number];
type NativeQaCheck = typeof nativeQaChecks[number];

export type NativeQaEvidence = {
  platform: NativeQaPlatform;
  device: string;
  osVersion: string;
  buildId: string;
  testedAt: string;
  checks: Record<NativeQaCheck, "pass">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoUtcTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function validateNativeQaEvidence(value: unknown) {
  const errors: string[] = [];
  if (!Array.isArray(value) || value.length !== nativeQaPlatforms.length) return { valid: false, errors: ["Evidence must contain exactly one Android and one iOS record."], evidence: [] as NativeQaEvidence[] };
  const evidence: NativeQaEvidence[] = [];
  for (const platform of nativeQaPlatforms) {
    const record = value.find(item => isRecord(item) && item.platform === platform);
    if (!isRecord(record)) { errors.push(`Missing ${platform} evidence.`); continue; }
    for (const field of ["device", "osVersion", "buildId", "testedAt"] as const) if (typeof record[field] !== "string" || !record[field].trim()) errors.push(`${platform}.${field} is required.`);
    if (typeof record.testedAt === "string" && !isIsoUtcTimestamp(record.testedAt)) errors.push(`${platform}.testedAt must be an ISO UTC timestamp.`);
    const checks = record.checks;
    if (!isRecord(checks)) { errors.push(`${platform}.checks is required.`); continue; }
    for (const check of nativeQaChecks) if (checks[check] !== "pass") errors.push(`${platform}.checks.${check} must be pass.`);
    if (!errors.some(error => error.startsWith(`${platform}.`))) evidence.push({ platform, device: record.device as string, osVersion: record.osVersion as string, buildId: record.buildId as string, testedAt: record.testedAt as string, checks: checks as NativeQaEvidence["checks"] });
  }
  return { valid: errors.length === 0, errors, evidence };
}

export function loadNativeQaEvidence(path: string | undefined) {
  if (!path) return { valid: false, errors: ["NATIVE_QA_EVIDENCE_PATH is not configured."], evidence: [] as NativeQaEvidence[] };
  try { return validateNativeQaEvidence(JSON.parse(readFileSync(path, "utf8"))); }
  catch { return { valid: false, errors: [`Could not read native QA evidence at ${path}.`], evidence: [] as NativeQaEvidence[] }; }
}
