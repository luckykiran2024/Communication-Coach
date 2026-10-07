# Decision log — 2026-09-24

1. Start with a runnable foundation rather than attempting the full product in one turn, as required by the development-budget attachment.
2. Use npm workspaces and shared TypeScript contracts. Expo SDK 57 package versions are resolved through expo install, with React 19.2.3 and React Native 0.86.3.
3. Fastify 5, PostgreSQL 17 and Prisma 6.19.2 provide the initial persistence boundary. Prisma dependencies have audit advisories: upgrade/remediation is a release gate.
4. Use opaque revocable session tokens instead of client-controlled identity. Store token digests only; no permanent AI secrets ship to clients.
5. The later subscription attachment overrides the original three-tier requirement: four tiers, 20 minutes for standard tiers and 40 for Extended Practice. Proposed prices are not storefront offers.
6. Only authored practice previews are shown before AI integration. No hardcoded AI transcript is presented as real coaching.
7. Local audio check first; realtime native transport remains undecided until tested on both platforms. No paid provider calls or cloud builds were made.
8. Keep the enterprise portal a clear preview, with no fabricated organizations, learners, engagement statistics or employer-accessible coaching data.
9. Account verification, recovery, deletion and security review must precede a public pilot. Local accounts are for development only.
10. Current selected Codex model was not changed. Tool metadata lists Astra/Sol/Luna options, but no model-switch action is available for this active task. Sol is suitable for the next onboarding/API verification increment; Astra is appropriate for live voice lifecycle and hard metering decisions.
