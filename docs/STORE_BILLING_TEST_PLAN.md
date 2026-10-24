# Native store billing: Android first — 2026-10-24

## Decision and current verdict

Use Google Play Billing and Apple In-App Purchase, not Razorpay, for the mobile digital subscriptions.
The founder chose Android testing first; Apple Developer enrollment and an iPhone are not available yet.
Source preparation and automated checks are complete for this increment. Real store/payment acceptance is **BLOCKED**,
not passed. No money moved, billing flag was enabled, cloud build was started, or app/store submission was made.

The signed-in Play Console for LuckySoma still shows identity and contact-phone verification as Action required,
and Create app is disabled after a refresh. The founder's approval message does not establish Google approval.
No identity documents were accessed or submitted by the agent. Account verification must be completed by the owner.

## Fixes in this increment

| Before | Now |
|---|---|
| Android subscription request omitted its offer token | Selects the configured monthly base plan and supplies its store offer token; no silent trial/annual selection |
| Subscription unavailable but purchase action could remain enabled | Requires a loaded store product and Android monthly offer; displays that offer's price |
| A receipt could be claimed without provider proof of the app account | Server-owned account UUID is passed to StoreKit/Play and checked against verified provider data |
| Google order identifier was trusted from the phone | Uses the provider's latestSuccessfulOrderId |
| Missing or invalid subscription expiry could imply unlimited access | Invalid/missing expiry is rejected; pending purchases never grant access |
| Restore used the currently selected SKU for all returned purchases | Creates an intent for each known restored product; unrelated app products are ignored |
| Pending callbacks were processed like completed purchases | Pending is shown explicitly without verification/acknowledgment; later completed callbacks can retry |
| Native success still displayed development-preview wording | Distinct preview/native confirmations; server account refresh happens before native success |
| Verification success could be mistaken for active paid access | Server returns accessGranted separately; expired/revoked purchases are not presented as active |
| Both store credential sets were required even for Android-first testing | Explicit BILLING_PROVIDERS=google can isolate Android; Apple routes remain disabled |
| Preview build inherited development identifiers and simulated payments | Separate store-sandbox AAB profile requires real identifiers/API configuration and disables simulated payment |

Fresh unbound purchases without a verified account token are rejected. Legacy purchases already linked in the database
may restore only to that existing owner. No email, password or permanent provider secret is sent in a native purchase request.
Cross-account transaction, original-subscription and purchase-token lookups guard restoration and renewal claims.

The purchase action refuses a second known subscription while a store account already owns one. This prevents blindly
starting overlapping packages; **seamless in-app upgrades/downgrades and proration are not implemented by this increment**.
The Manage store subscription action opens the platform subscription controls. Cross-product plan replacement still needs
an explicit implementation decision and sandbox evidence; do not mark that acceptance case complete.

## Store catalog to configure after account approval

These are target INR prices, not proof that a storefront product exists or has been activated.

| Product ID | Target monthly price | Voice allowance |
|---|---:|---:|
| com.communicationcoach.essential.monthly | INR 299 | 15/month |
| com.communicationcoach.professional.monthly | INR 399 | 20/month |
| com.communicationcoach.executive.monthly | INR 699 | 40/month |
| com.communicationcoach.extended.monthly | INR 799 | 60/month |

Each voice session is capped at seven minutes. Free is two lifetime voice sessions and does not create a store product.
Product prefixes can be changed with EXPO_PUBLIC_STORE_PRODUCT_PREFIX, but server BILLING_PRODUCT_MAP must match exactly.
Google monthly base-plan ID defaults to monthly; change EXPO_PUBLIC_GOOGLE_BASE_PLAN_ID to the actual configured ID.
Apple products should be grouped so a person does not independently subscribe to multiple tiers of the same service.
Storefront pricing, taxes, commission and subscription terms require owner review; the app shows store pricing at purchase.

## Ordered route to genuine Android payment testing

1. Owner completes Play Console identity and phone verification; confirm that Create app becomes enabled.
2. Confirm the permanent application identifier before the first upload. The old APK's com.example preview identifier
   is not a production identifier and is not silently reused for store billing tests.
3. Create the app and configure the four subscriptions, monthly base plans, India availability and target prices.
4. Complete the merchant/payout and required agreements privately. No purchase, subscription upgrade or contract acceptance
   is authorized by source preparation. Do not paste keys, bank details or identity documents into chat or Git.
5. Provision a billing staging API/database, not the existing billing-disabled Executive-grant test API. Configure
   BILLING_PROVIDERS=google, real Google verification credentials, BILLING_PRODUCT_MAP, private webhook secret and authenticated
   real-time developer notifications. Leave production gated. Verify scheduled cleanup and other independent release gates.
6. Add the actual device's Google account as a license tester and internal-track tester. Internal-track membership alone
   does not prevent real charges. Confirm the store dialog explicitly says test purchase and uses a test payment method.
7. Configure the EAS preview environment with the final APP_IDENTIFIER, staging HTTPS EXPO_PUBLIC_API_URL and OAuth settings.
   The store-sandbox profile extends production identifier validation, uses channel store-sandbox, produces an AAB and sets
   EXPO_PUBLIC_PAYMENT_PREVIEW=false. It does not inherit the old preview API, bypass credentials or automatically submit.
8. Build the approved candidate, upload only to internal testing, opt in using its Play link, install and execute the matrix below.
   License testers can also sideload matching-package builds under Google's documented conditions; a generic preview APK is
   not evidence that billing is ready. Stop if the purchase dialog does not identify a no-charge test purchase.
9. Record order references, provider environment, server entitlement, actual plan/usage and notification effects without
   storing receipt tokens, credentials or personal data in public artifacts. Obtain owner sign-off before any public release.

## Native acceptance matrix — NOT RUN

- First purchase of every tier, cancellation of the payment sheet, decline and pending-to-completed transitions.
- Verification outage before acknowledgment, retry after recovery, duplicate callbacks and app termination/relaunch.
- Restore on the same account/device, reinstall, a second device, no purchases, and wrong app/store account.
- Accelerated renewal, cancellation with access until expiry, grace period, hold, expiration, refund and revocation.
- Stale/duplicate notifications, entitlement rollback protection, unavailable/incorrect product and identifier mismatch.
- Upgrade/downgrade policy, replacement/proration implementation, and no overlapping independent subscriptions.
- Correct module access and seven-minute/monthly allowances, including concurrent devices and month boundaries.
- End-to-end learner journey, email/recovery/OAuth, real assessment quality, native voice interruptions and progress.

Every row above remains pending real store/device evidence. HTTP tests use injected verified-store fixtures and cannot
establish Google/Apple acceptance, external credentials, real payment lifecycle behavior or paid-provider quality.

## iOS later

Enroll Apple Developer, create the final App Store Connect app and subscription group, configure signed server verification,
notifications and sandbox testers, then build for TestFlight and run the same applicable matrix on an iPhone.
Apple request/account-token preparation is covered by automated tests; no iOS build, purchase or device test occurred here.
Do not enable Apple billing merely because Android tests pass.

## Actual verification

- npm run typecheck: PASS, all four workspaces, exit 0.
- npm test: PASS 197/197, no failures/skips/cancellations/todo, exit 0; duration_ms 16689.7718.
- npm run test:regression: PASS 176/176, exit 0; duration_ms 11410.5597.
- Added 21 tests: nine pure mobile-flow tests, eleven provider/configuration/HTTP tests and one sandbox-profile release gate.
- Checked the official native converter, not only TypeScript declarations: base offers use id=basePlanId, not an empty ID.
  Corrected selection and fixtures to match; an explicit regression prevents confusing base plans with promotional offers.
- API production bundle: PASS, exit 0. Expo mobile web export: PASS, exit 0 after a scoped generated-asset write grant.
- Applied the earlier pending 202610241200_coaching_review migration only to coach_verification over strict TLS.
  All 23 migrations are present there; guarded PostgreSQL integration tests PASS 16/16, exit 0;
  duration_ms 195226.4584. This is the existing persistence suite, not a real store purchase or production upgrade.
- No new migration was added for billing. Public and coach_apk_test schemas were not migrated in this increment.
- Browser: Essential review displays INR 299 / 15 monthly / seven-minute maximum; simulation explicitly says no payment
  or paid access was granted and returns to practice. This is a labelled memory fixture with an Executive development grant,
  not proof that choosing Essential changed an entitlement. Native completion is covered by pure/API tests, not browser IAP.
  Essential review also has zero overflowing DOM elements at a 320px viewport (page width 320); viewport override reset afterward.
- ADB: emulator-5554 remains offline; no physical Android device listed. No native payment/device acceptance occurred.
- npm run release:preflight: expected BLOCKED, exit 1; email, assessment, scheduler, voice, billing, OAuth and manager
  configuration/manual native/content gates remain. None was weakened or marked complete.

Local ignored evidence: artifacts/billing-{typecheck,tests,regression,api-build,web-export,preflight}.log;
artifacts/coaching-{migration,database}.log; artifacts/billing-essential-preview.jpg;
artifacts/billing-preview-confirmation.jpg; artifacts/play-console-billing-blocked.jpg.
The additional narrow package screenshot is artifacts/billing-essential-320.jpg.

## Official references checked

- Google testing and no-charge license-test requirements: https://developer.android.com/google/play/billing/test
- Google subscription proof fields: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- Apple payment rules: https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
- Installed expo-iap 5.8.2 type contracts for offers, account binding, pending purchases and restore were inspected locally.
- Native offer normalization inspected: https://github.com/hyodotdev/openiap/blob/main/packages/google/openiap/src/play/java/dev/hyo/openiap/utils/BillingConverters.kt
