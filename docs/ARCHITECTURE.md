# Architecture

## Implemented boundary

Expo Router → HTTPS JSON API → Fastify → Store interface → Prisma → PostgreSQL.

The mobile client owns form state, accessibility, permissions and native audio presentation. The API owns account identity and profile writes. Clients cannot supply an owner ID: authenticated sessions determine ownership. Raw passwords are scrypt-hashed with random salts. Random bearer tokens are stored as SHA-256 digests, expire after seven days and are revocable. Native tokens use SecureStore; browser preview tokens are ephemeral in memory.

Profile timezone is immutable after first save. A PostgreSQL row lock serializes concurrent profile writes so two devices cannot change it by racing. An eventual support-mediated timezone change must preserve allowance accounting.

The portal is currently a public, non-sensitive scenario preview. It has no learner data or tenant administration endpoints. Employer access to personal transcripts is not implemented or implied.

## Conversation boundary

`POST /v1/me/conversations` creates an owner-scoped `CREATED` record only after the authenticated profile is authorized for the requested scenario. Learner-only text turns may be saved and explicitly completed; recent sessions and `GET /v1/me/conversations/:id` remain owner-scoped. This establishes the persistence contract for later voice sessions without generating simulated assistant turns or unlocking provider access.

## Shared learning content

packages/core defines validated profile contracts, three learning modules, six versioned scenario definitions and task-specific rubric identifiers. Recommendations use function plus the learner's selected goal, not inferred ability. Career level is collected, but career-level scenario variants and history adaptation are not yet implemented.

Scenario content is JSON outside application components. The assessment contract limits feedback to two priorities and validates exact quotes against learner turns. This is a structural safeguard, not a validated AI evaluator; audio claims are rejected by the current text-only contract.

## Voice decision

The implemented POC is limited to consent, native recording, local playback, foreground interruption handling and authenticated backend readiness. It is not the required live AI connectivity POC.

The proposed live transport is native WebRTC, behind a provider interface. Browser navigator.mediaDevices examples are not copied into React Native. Final transport selection remains gated on a real Android/iOS proof of concept.

Before enabling billable voice, implement atomic user/day reservations, provider-side termination, maximum session deadlines, idempotent settlement and usage reconciliation. Expiring a connection credential alone does not end an established connection. Client countdowns cannot enforce an allowance. A server control channel must terminate the provider session on exhaustion, including when a client disappears.

The current increment adds the first part of that boundary: `UsageReservation` rows, atomic allowance checks, settlement that releases unused reserved seconds, a stable profile-timezone `/v1/me/voice-usage` response, and mobile display of remaining configured time. It is currently a 20-minute development allowance and does not unlock live voice or represent a paid entitlement.

`startLiveConversation` now provides the provider-independent lifecycle coordinator. It reserves the requested allowance before moving through `AUTHORIZED` and `CONNECTING`; only a successful provider connection reaches `ACTIVE`. Any provider error settles the reservation to zero and moves the record to `FAILED`. Provider termination, active-session persistence and client connection credentials remain disabled until a native provider is selected and tested.

No permanent provider key is in mobile code. No AI SDK, credential issuing route or paid provider call is enabled yet.

## Planned storage evolution

Add organizations/memberships and tenant-scoped content before enterprise routes. Add versioned scenario/rubric storage, conversations/turns, diagnostics/evidence and progress before AI assessment. Add subscriptions, entitlements, reservations, usage ledger and provider costs before paid voice. Add consent and retention records before optional cloud audio storage.

The current migration contains only User, UserProfile and AuthSession. Unimplemented tables are intentionally not represented as working features.

## Operational baseline

Fastify includes body limits, rate limiting, security headers, origin allowlist and redacted request logging. It does not trust forwarded IP headers by default. Before deployment behind a proxy, configure narrowly scoped proxy trust and shared rate-limit storage. Serve through TLS, use a secret manager and add monitoring, backup/restore and alerting. See RELEASE_CHECKLIST.
