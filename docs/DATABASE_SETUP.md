# Local Supabase database verification

The API uses Prisma 6 and reads local database credentials from `apps/api/.env`.
This file is ignored by Git. Never put passwords in the tracked `.env.example`.

Use the project's Connect panel and select Session pooler for local IPv4 access.
Replace the password placeholder with the project's PostgreSQL database password,
not the Supabase website sign-in password. Percent-encode reserved password characters.

The local connection requires TLS and strict certificate verification using
`sslmode=require`, `sslaccept=strict` and `sslcert` pointing to the bundled CA.
The ignored local URL uses an absolute certificate path for this machine.
On another machine, configure a path to its own checkout rather than copying that path.

`apps/api/prisma/supabase-ca.crt` is a public CA certificate downloaded from the
official certificate link in the Supabase Database Settings panel on 2026-10-10:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Do not disable certificate verification to work around connection errors.
See https://supabase.com/docs/guides/database/prisma and
https://supabase.com/docs/guides/platform/ssl-enforcement.

Before migrations or integration tests, use a dedicated non-production database
or an isolated schema; do not point the integration suite at real customer data.
The suite creates and deletes its own test records.

Current verification (2026-10-10): the corrected password authenticates successfully.
All 16 migrations passed in the separate `coach_verification` schema, and the
PostgreSQL integration test passed. Existing public application tables were not
migrated or used for test records. PUBLIC, anon and authenticated roles have no
access to the verification schema. Test records are removed by test cleanup.

The ignored `.env` now has `DATABASE_TEST_URL` pointing to that isolated schema.
`npm run test:database` prefers it; CI can still supply an isolated `DATABASE_URL`
when no test-specific URL is set. The application itself still uses `DATABASE_URL`.
Do not change the application URL to the verification schema.

For test-schema migrations, run `npm run db:migrate` with the process-level
`DATABASE_URL` overridden by `DATABASE_TEST_URL`; this was how the 16 migrations
were applied. Do not run the migration command against the public/live URL as
part of routine tests. Review existing data and backups before live migrations.

Rerun `npm run test:database`, `npm run typecheck`, `npm test` and
`npm run test:regression`, then record actual results in TESTING_STATUS.md.
