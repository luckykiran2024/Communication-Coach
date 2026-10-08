import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64) as Buffer;
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [salt, expected] = encoded.split(":");
  const actual = await derive(password, salt, 64) as Buffer;
  const stored = Buffer.from(expected, "hex");
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}
