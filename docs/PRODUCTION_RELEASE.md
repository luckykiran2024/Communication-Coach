# Production release checkpoint — 2026-10-10

Requested target: GitHub luckykiran2024/Communication-Coach main and Vercel communication-coach-api,
team luckykiran2024s-projects, project prj_cHnHXpq8CSZQHlka9cxin5ti9hXO.

## Production is gated, not deployed

The founder explicitly selected Keep production gated for both email readiness and scheduler approval after the release inspection.
Latest checks pass: typecheck, 135 general tests and 114 regression tests; the prior isolated PostgreSQL result remains 9/9.

The current production deployment is dpl_Dokactk2fRYnV5nPYfwp2K4BZwdj, built from 04462c9.
Read-only Vercel environment metadata confirms the database integration, manager email and CORS variables exist,
but CRON_SECRET, EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM and ACCOUNT_EMAIL_LINK_BASE_URL are absent.
No existing secret values were decrypted, exported or committed.

New source requires an operational email sender and strong scheduler secret in production. Shipping without them
would fail startup. The every-minute scheduler also requires supported hosting or a separately approved scheduler;
its cadence must not be silently changed to daily. No subscription upgrade or paid provider activation is authorized.

To permit a safe source push while these prerequisites are outstanding:
- apps/api/vercel.json disables automatic Git deployments for main as well as the existing test-apk-ready backup branch.
- The EAS update workflow is manual-dispatch only, preserving the installed APK/OTA freeze.
- No production migrations, deployment, domain reassignment or mobile update are started by this push.

## Before a production deployment

1. Configure and verify real email delivery and the HTTPS account verification/reset destination.
2. Provision a private CRON_SECRET of at least 32 characters and approve/verify an every-minute scheduler.
3. Review the production migration target and backup/recovery plan, then apply the pending migrations in a controlled release.
4. Keep paid voice, assessment, OAuth and billing disabled until their separate live acceptance gates are satisfied.
5. Run the required checks, stage the exact production commit without assigning domains, and smoke-test the deployment.
6. Promote only a verified staged deployment. Re-enable automatic main deployments only with the matching release-gate test update.
7. Publish mobile updates only after separate explicit approval; a source push is not an APK test result.

See REMAINING_PHASES.md, TESTING_STATUS.md and KNOWN_ISSUES.md for the implementation and remaining acceptance evidence.
