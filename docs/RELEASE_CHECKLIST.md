# Release checklist

No app has been submitted, approved, published or deployed.

Run `npm run release:preflight` before a release candidate. It loads `apps/api/.env`, reports configuration gates without printing secrets, and does not replace the PostgreSQL integration test, store sandbox tests or physical-device sign-off.

- [ ] Resolve all dependency advisories and review the dependency lockfile.
- [ ] Apply and verify database migrations in an isolated staging environment.
- [ ] Test backup/restore; configure TLS, secrets, monitoring and shared rate limits.
- [ ] Complete account verification, recovery, export and deletion.
- [ ] Android/iOS live voice and interruption matrix passes on physical devices.
- [ ] Hard server-side daily limits work across devices, models and modules; concurrency and disconnect tests pass.
- [ ] Provider cost metering is reconciled with actual usage; prices validated with pilot economics.
- [ ] Store sandbox purchases, renewals, restore, upgrades, expiration and webhook replay protection pass.
- [ ] Recording consent, deletion and retention verified, including forced app termination.
- [ ] Diagnostic evaluation reviewed by human communication trainers; no unsupported psychological claims.
- [ ] Enterprise tenant isolation and aggregate-report privacy tests pass.
- [ ] Screen-reader, contrast, text scaling, reduced-motion and touch-target checks pass.
- [ ] Configure real app identifiers, icon/splash, company name, domain and support contact.
- [ ] Configure separate development, preview/staging and production secrets/endpoints.
- [ ] Complete Indian/destination-market privacy and store policy review with appropriate professional input.
- [ ] Prepare privacy disclosures, screenshots, store listing, reviewer account and rollback procedures.
- [ ] Obtain explicit approval before paid services, production publishing or store submission.
