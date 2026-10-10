import { createHash } from "node:crypto";
import type { Store } from "../store";
import { ApiError } from "./errors";

export function sharedRateLimitStore(store: Store, now: () => Date, namespace = "communication-coach") {
  return class SharedRateLimitStore {
    private namespace = `${namespace}:global`;
    constructor(_options: unknown) {}
    incr(key: string, callback: (error: Error | null, result?: { current: number; ttl: number }) => void,
      windowMs = 60000) {
      const hash = createHash("sha256").update(`${this.namespace}:${key}`).digest("hex");
      void store.incrementRateLimit(hash, windowMs, now()).then(result => callback(null, result), () => {
        callback(new ApiError(503, "Rate-limit storage is unavailable."));
      });
    }
    child(routeOptions: unknown) {
      const options = routeOptions as { path?: string; prefix?: string; method?: string | string[] };
      const child = new SharedRateLimitStore(routeOptions);
      child.namespace = `${namespace}:${options.method ?? "route"}:${options.prefix ?? ""}:${options.path ?? ""}`;
      return child;
    }
  };
}
