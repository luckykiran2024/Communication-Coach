// Configuration evidence supplements, and never replaces, real candidate acceptance.
export const requiredReleaseCapabilities = ["assessment", "voice", "billing", "accountEmail", "identityDeletion", "moderation", "scheduler", "launchEnabled"];
export function releaseRuntimeConfigured(ready) {
  return ready?.status === "ready" && ready.storage === "postgres" && ready.releaseConfigured === true
    && requiredReleaseCapabilities.every(name => ready.capabilities?.[name] === true);
}

export function stagingCandidateConfigured(ready, commit) {
  return releaseRuntimeConfigured(ready)
    && ready.environment === "staging"
    && ready.supabaseProjectRef === "szebsownsnvyrpwlbyau"
    && ready.projectId === "prj_5Ue9vRNMQ7RufENdOPKUXk8BBmzl"
    && typeof commit === "string" && /^[a-f0-9]{40}$/.test(commit)
    && ready.commit === commit;
}
