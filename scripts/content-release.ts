import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { modules, scenarios } from "@coach/core";

export function scenarioCatalogHash(catalog = scenarios) {
  return createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoUtcTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function contentCatalogReady(catalog = scenarios) {
  return catalog.length >= 100 && new Set(catalog.map(scenario => scenario.id)).size === catalog.length && modules.every(module => [1, 2, 3, 4, 5].every(level => catalog.some(scenario => scenario.module === module.id && scenario.level === level)));
}

export function validateContentReviewEvidence(value: unknown, catalog = scenarios) {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["Content review evidence must be an object."] };
  if (typeof value.reviewer !== "string" || !value.reviewer.trim()) errors.push("reviewer is required.");
  if (typeof value.reviewerRole !== "string" || !value.reviewerRole.trim()) errors.push("reviewerRole is required.");
  if (value.status !== "approved") errors.push("status must be approved.");
  if (typeof value.reviewedAt !== "string" || !isIsoUtcTimestamp(value.reviewedAt)) errors.push("reviewedAt must be an ISO UTC timestamp.");
  if (value.scenarioCount !== catalog.length) errors.push("scenarioCount does not match the current catalog.");
  if (value.catalogHash !== scenarioCatalogHash(catalog)) errors.push("catalogHash does not match the current catalog.");
  return { valid: errors.length === 0, errors };
}

export function loadContentReviewEvidence(path: string | undefined, catalog = scenarios) {
  if (!path) return { valid: false, errors: ["CONTENT_RELEASE_EVIDENCE_PATH is not configured."] };
  try { return validateContentReviewEvidence(JSON.parse(readFileSync(path, "utf8")), catalog); }
  catch { return { valid: false, errors: [`Could not read content review evidence at ${path}.`] }; }
}
