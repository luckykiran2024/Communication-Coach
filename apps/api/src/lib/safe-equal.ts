import { createHash, timingSafeEqual } from "node:crypto";

export function safeEqual(actual: unknown, expected: string) {
  if (typeof actual !== "string" || !expected || !actual) return false;
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
