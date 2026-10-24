# Supabase access audit — 2026-10-10

## Current status: existing public tables contained

After the founder approved proceeding, the targeted security SQL committed at 09:40:08 UTC on 2026-10-10.
All 13 existing public tables now have RLS enabled. Both anon and authenticated have zero effective table/column read/write
privileges; PUBLIC grants were also removed. Relevant sequence grants and postgres-created future table/sequence defaults
were restricted. No permissive RLS policy or FORCE RLS was added, and no customer records were fetched or changed.

The same public-key-only, zero-row User request now returns HTTP 401, PostgreSQL error 42501, instead of HTTP 200.
All 26 direct zero-row table-read probes (13 tables times two API roles) also fail with 42501. Owner zero-row read/write
checks succeed. A rollback-only rehearsal verified idempotence and denied default grants on a newly created probe table;
the probe table and rehearsal changes were rolled back before committing the reviewed operation.

New migration: apps/api/prisma/migrations/202610101500_public_data_api_lockdown/migration.sql.
This is public-schema-only: a different current_schema causes a no-op, protecting the restricted NOBYPASSRLS test runtime.
Read-only integration tests verify both isolated schemas and public remain unchanged when it runs from either test schema.
Do not remove that guard without providing and testing an explicit backend policy/ownership model for non-owner runtimes.

Only this security SQL was applied directly. No full production feature migration deploy ran and no Prisma ledger entries
were manually inserted. The idempotent migration remains available for the next approved full migration deployment.
Its live execution SHA-256 is 08ba7728f3c91717806e06b69f73a97e196c647f337c36a4c9143fd3914d15e9.

The restricted test backend still reads its own schema, and all 31 hosted functional smoke checks pass, including disposable
account creation and cleanup. Both production and isolated test API health endpoints returned HTTP 200 before and after.
Production encrypted database secrets were not retrievable through the connector; the deployed production DB role was not
independently established. A health response is not a production authenticated-data or provider acceptance test.

Remaining access-control cautions:

- supabase_admin's platform-owned default grants remain; postgres is not a member and cannot edit them. The actual app
  migration creator postgres is hardened and its new-table default-denial probe passed. Review RLS/grants for any objects
  created by another role or through future dashboard/platform operations; do not claim all future creators are covered.
- Existing public function execution defaults were not changed. No executable SECURITY DEFINER routine was found in the
  audited schemas. Any new RPC/function/view needs an explicit access review; table RLS alone is not a function boundary.
- This contains the confirmed exposure; it does not establish that historical access or compromise never occurred.
  Incident review, and any required account/session remediation, remain separate work.
- Production email, scheduler, paid provider and store-billing release gates remain unchanged. APK, OTA and deployment
  are unchanged. The other application audit gaps below remain open.

## Original critical finding: confirmed before containment

Project: nrrmhftccqsofjvoaffm. Database permissions checked at 08:53:21 UTC; public Data API checked at 08:54:19 UTC.
This was a read-only audit. No customer rows, password hashes, tokens or conversation text were fetched.
No live permissions, data, migrations, provider configuration, deployment, OTA or APK were changed.
At that checkpoint, live permission changes awaited explicit approval. The approval and containment are recorded above.

The configured database connection uses postgres in public, with BYPASSRLS. Both anon and authenticated have public schema
USAGE and effective SELECT, INSERT, UPDATE, DELETE and TRUNCATE privileges on all 13 existing public tables.
All 13 have RLS disabled and zero policies:

- AuthSession
- Conversation
- ConversationTurn
- CustomScenario
- CustomScenarioRevision
- Entitlement
- OAuthIdentity
- PurchaseIntent
- UsageReservation
- User
- UserProfile
- VoiceSession
- _prisma_migrations

GET /rest/v1/User?select=id&limit=0 using only the locally configured public/anon key returned HTTP 200 and an empty array.
No rows were requested. This confirms anonymous read access is reachable, not just a hypothetical grant concern.
Write capability was established from effective database privileges, not by attempting to alter live data.
This is evidence of exposure, not evidence that an attacker has accessed or changed data; no incident-log review was performed.

The coach_apk_test and coach_verification schemas deny USAGE to both API roles. This blocks direct Data API access there;
it is not a blanket security certification for either environment. No executable SECURITY DEFINER routines were found in the
audited public/coach schemas. Data API schema settings were not available via the audited connection's session setting;
the zero-row HTTP probe independently confirms public.User is exposed.

## Root cause and safe remediation scope

Tables created through Prisma SQL migrations did not enable RLS or remove inherited Supabase API privileges.
Default ACLs for postgres and supabase_admin also grant new public tables/sequences to anon/authenticated.
An RLS-only fix to today's tables would not prevent future migrations from reintroducing exposure.

The proposed security change must:

1. Restrict existing application tables, migration metadata, column-level grants and relevant sequences against direct access
   by anon, authenticated and PUBLIC. Enable table RLS as defense in depth; do not add permissive client policies.
2. Revoke applicable future-object default grants for the actual migration creator, and identify any defaults owned by a
   role that the operator cannot change. Verify the results rather than assuming a REVOKE succeeded.
3. Confirm the deployed backend's database role before modifying live grants. The local postgres connection has BYPASSRLS;
   this does not prove that every hosted runtime uses the same role. Do not FORCE RLS on the server-owned tables blindly.
4. Leave Supabase's auth/storage schemas and the restricted isolated-test runtime unchanged. Blanket RLS in coach_apk_test
   could block its non-owner, NOBYPASSRLS backend role; do not apply public hardening there indiscriminately.
5. Apply only the reviewed access-hardening operation, not all pending feature migrations, and verify API-role denial plus
   legitimate backend access afterward. Preserve the production feature/deployment gates.

Supabase documents grants and RLS as complementary access controls, including function-specific protections:
[Securing your API](https://supabase.com/docs/guides/api/securing-your-api) and
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

At the audit checkpoint, real customer testing was blocked pending containment. If real accounts were stored
there, assess logs and session invalidation/password-reset requirements after containment; this audit cannot establish compromise.

## Other audit claims checked in source: found, not fixed

| Finding | Verified boundary |
| --- | --- |
| Failed/stuck AI review | Completion accepts CREATED/INTERRUPTED only; assessment errors set FAILED. There is no feedback-retry route or ASSESSING lease recovery in the cleanup path. |
| Paid-call abuse | Voice and AI completion lack an email-verification requirement. No per-user daily assessment budget/reservation was found; request rate limiting is not a paid-call quota. |
| Billing-off production plan | activePlan uses DEV_PLAN_ID, default Executive, whenever billing is disabled. productionConfigurationErrors does not reject that combination with paid providers. |
| Scheduler readiness | A cleanup route/config exists, but a working every-minute hosted scheduler remains an unverified release prerequisite, not a completed operational fix. |
| Economics | The pasted rupee estimates were not independently validated. No paid provider calls or new cost measurements were made. |
| Phase 10 | Still specification only; every-function/every-career-stage runtime personalization is not implemented. |

No implementation for these follow-up gaps was included in this audit. Existing green tests do not demonstrate their absence.

## Evidence

Local ignored files: artifacts/supabase-access-audit.json and artifacts/supabase-rest-audit.json.
The database audit used a READ ONLY transaction and queried PostgreSQL catalogs/effective privileges only.
The public HTTP probe used limit=0 and rejected service-role/secret keys. Credentials were not printed or added to Git.
These local artifacts are operational evidence, not committed customer exports.

Containment evidence: artifacts/supabase-access-before-lockdown.json, artifacts/supabase-rest-before-lockdown.json,
artifacts/supabase-lockdown-receipt.json and artifacts/supabase-lockdown-tests.log. Current audit JSON files contain the
post-lockdown results. Hosted smoke evidence is in artifacts/supabase-lockdown-hosted-smoke.log.

To repeat the read-only integration checks against this specific approved project in PowerShell:

```powershell
$env:DATABASE_ACCESS_AUDIT_CONFIRMED = 'true'
npm run test:database-access
Remove-Item Env:DATABASE_ACCESS_AUDIT_CONFIRMED
```

The command loads apps/api/.env privately, refuses a different project/schema, and never fetches customer records.
It is separate from the ordinary unit suites because those must not silently connect to a live database.
