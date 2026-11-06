// Preferences are optional. Browsers can deny even access to the storage getter.
export function tryCompleteAuthSession(complete: () => unknown): boolean {
  try { complete(); return true; } catch { return false; }
}

export function readWebPreference(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

export function writeWebPreference(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch { /* Keep this session's preferences in memory when storage is unavailable. */ }
}
