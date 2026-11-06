# Boat image regression checks

## Public website ocean journey

Run `node scripts/tests/public-ocean.cjs` with Vite running and `PLAYWRIGHT_MODULE`
configured. Chromium uses installed Edge; `PLAYWRIGHT_ENGINE=webkit` selects WebKit.
The default widths are 320, 375, 430, 768, 1024, 1440 and 1920px. An optional
`WWMS_PUBLIC_BASELINE` JSON capture checks preservation of the pre-change visible
copy, Gallery image sources/order, footer targets and form fields.

The suite checks four sections, independent 3D swimming during forward/reverse scroll, control/photo protection,
overflow/layout stability, every anchor, Gallery hover, Contact fixtures, reduced
motion, free idle locomotion, route cleanup and the unchanged auth whale.
It sends no real email. See [PUBLIC_OCEAN_IMPLEMENTATION.md](../../PUBLIC_OCEAN_IMPLEMENTATION.md)
for exact commands, real API/SQL regressions, screenshots and implementation details.

## System audit (2026-11-04)

See [SYSTEM_AUDIT_REPORT.md](../../SYSTEM_AUDIT_REPORT.md) for findings, verification,
production blockers, and exact .NET 8/SQL/browser commands. The audit adds:

- `server.Tests/SystemAuditTests.cs`: disposable SQL regressions for GPS audiences,
  manifest/group transfers, privileged staff, concurrent departures and scheduling.
- `GpsAuditTests.cs`: provider body deadlines and cancellation.
- `ApiExceptionHandlerTests.cs`: generic errors without response secrets or stacks.
- `ContactTests.cs` and `contact.cjs`: the real public form/API with fake SMTP,
  fixed-recipient message construction, validation, rate limiting and failures.
  `contact.cjs` must run through its xUnit harness; it never sends actual email.
- `audit-fleet.cjs`: delayed snapshots and out-of-order live GPS updates through Vite.
- `audit-runtime.cjs`: read-only probes of a running API, default port 8080.
- `audit-readonly.sql`: metadata and aggregate integrity checks; no data changes.

The Contact destination is `Contact:RecipientEmail` in the backend configuration.
It shares the existing `PasswordRecovery:Smtp` Gmail settings, independently of the
recovery enabled flag. SMTP secrets remain server-side. Gmail authentication can be
checked without sending mail using `node scripts/check-recovery-smtp.cjs`.

## Stabilization regressions

With Vite running and `PLAYWRIGHT_MODULE` configured, run
`node scripts/tests/session-races.cjs` and `node scripts/tests/stabilization-ui.cjs`.
These Edge/Chromium fixtures exercise the real source modules and never change real
accounts: delayed authentication after logout/new login, shared refresh rotation,
stale crew queries, reachable mobile crew actions, and transfer destination races.
The six SQL integration tests in `server.Tests/StabilizationTests.cs` use the
existing disposable database harness. See [STABILIZATION_REPORT.md](../../STABILIZATION_REPORT.md)
for exact commands, results, dependency audits and remaining verification limits.

## Deep Ocean owner and crew dashboards

Run `node scripts/tests/ocean-dashboards.cjs` with the web dev server available.
`WWMS_WEB_URL` defaults to `http://localhost:5173`; configure `PLAYWRIGHT_MODULE`
for your installed Playwright and `PLAYWRIGHT_ENGINE=chromium` or `webkit`.
Set `WWMS_DASHBOARD_SCREENSHOTS` to save desktop/mobile screenshots.

The browser fixture checks the restored original layouts, actual login whale SVG
and animation reuse, decoration clear of text and controls, original actions and
menus, notifications routing, SignalR updates, loading/error/empty states, seven
viewport widths, reduced motion, and unchanged styling on other crew screens.
Fixtures never replace production data sources or write to the running database.
Chromium uses the installed Edge channel; WebKit must be installed separately.
See [DASHBOARD_UI_IMPLEMENTATION.md](../../DASHBOARD_UI_IMPLEMENTATION.md) for results.

## Shore QR scanning and mobile layouts

With Vite running, run `node scripts/tests/shore-qr.cjs`. Set `PLAYWRIGHT_MODULE`
when Playwright is installed outside the project. Chromium uses `msedge` by default;
`PLAYWRIGHT_CHANNEL` overrides it. Set `PLAYWRIGHT_ENGINE=webkit` to use an installed
WebKit engine. `WWMS_WEB_URL` defaults to `http://localhost:5173`.

API and camera fixtures are confined to the browser suite. Actual ZXing decoding
is used for generated QR PNGs and, where supported, canvas camera streams. These
are automated engine checks, not physical Safari/Chrome camera tests.

For live API/SQL checks, set `WWMS_TEST_SQL_CONNECTION` and run the backend test
`ShoreQr_ValidatesTripAndRoleBeforeAttendance_AndPreventsDuplicateCheckIns`.
To run `Browser_LiveShoreQrUploadAndConfirmedAttendance`, also build the web app,
set `WWMS_BROWSER_WEB_ROOT` to the absolute `apps/web/dist` path and configure
Playwright as above. The harness creates/deletes a disposable database and API;
it never updates the application's database. See `SHORE_PORTAL_IMPLEMENTATION.md`
for results and the remaining physical-device checks.

## SLTDA trip GPS and passenger flags

Run `node scripts/tests/sltda-trip-map.cjs` with Vite running. It accepts the same
`PLAYWRIGHT_MODULE`, `PLAYWRIGHT_CHANNEL` and `WWMS_WEB_URL` settings below.
Fixtures exercise completed/ongoing/unstarted trips, absent or invalid GPS points,
single readings, missing arrival times, mismatched trips, retries/loading, route
request reuse, mobile layout, flags, country variations, and passenger filters.
Only test requests are intercepted; application code uses real GPS records.

`MonitoringTripTracking_UsesOnlyRecordedBoatAndTripWindow_AndPreservesCountry`
in the backend suite verifies device/time-window isolation, chronological points,
lifecycle times, distance availability, country projection and authorization in
a disposable SQL database. Set `WWMS_TEST_SQL_CONNECTION` to enable it.

For live browser-to-API-to-SQL coverage, build the web app, set
`WWMS_BROWSER_WEB_ROOT` to the absolute `apps/web/dist` path, set
`PLAYWRIGHT_MODULE` and `WWMS_TEST_SQL_CONNECTION`, then run the backend test
`Browser_LiveSltdaTripMapAndPassengerCountry`. This creates a disposable API and
database; only basemap graphics are stubbed, while GPS/passenger/auth APIs are real.

## Complaint detail crash regression

With Vite running and Playwright available, run `node scripts/tests/complaint-detail.cjs`.
Set `PLAYWRIGHT_MODULE` if Playwright is installed outside the project and
`PLAYWRIGHT_CHANNEL` to override the default `msedge` browser.
The checks cover SLTDA and Admin complaint details with both legacy individual
authorities (without `roleIds`) and grouped authorities, assignment filtering,
forwarding payloads, refresh, mobile layout, and return navigation. All API writes
are intercepted fixtures, so no existing complaint is changed.
Both authority formats must show one SLCG choice and confirmation, with forwarding
to both receiving roles. Partial and complete referrals and inactive recipients
are also covered; internal role names remain hidden in the selector and assignment labels.

For an optional check against an existing local complaint, set `WWMS_TEST_EMAIL`
and `WWMS_TEST_PASSWORD` for a monitoring account and pass `--live`. This mode
logs in, opens a complaint, and refreshes it without changing complaint records.
Both modes accept `WWMS_WEB_URL` (default `http://localhost:5173`).

## Boat image behavior

The latest uploaded `VesselPhotographOrDiagram` document is the boat display
image, including while that document awaits approval. Document approval and
history remain separate from image selection. The image endpoint reads the same
stored bytes as document download; no second image file is created. Its URL
contains the document ID, so replacements change the URL.

Boat and vessel-map responses derive their `imageUrl` from documents. This also
covers existing boats with missing or stale legacy `Boat.ImageUrl` values, without
a data migration. Boats without an aerial image return no image URL. JPEG and PNG
are accepted for aerial photographs/diagrams; other certificates still accept PDF.

## Backend

Run `dotnet test server.Tests/WhaleWatching.Api.Tests.csproj` using .NET 8.
Set `WWMS_TEST_SQL_CONNECTION` to a SQL Server connection string to enable the
three image integration tests. The login must be able to create/drop databases.
Each test creates a uniquely named `WWMS_BoatImageTests_*` database and deletes it
afterward; the database named in the supplied connection string is not used.
Without that variable these integration tests are explicitly skipped.

The tests cover large uploads, replacements before approval, retained history,
matching image/document bytes, existing boats, placeholders, invalid uploads,
owner scoping, and image-only access for Shore Wildlife.

## Web

With Vite running and Playwright available, run:

```sh
node scripts/tests/boat-images.cjs
```

Optional environment variables:

- `WWMS_WEB_URL`: Vite URL (default `http://localhost:5173`).
- `PLAYWRIGHT_MODULE`: installed Playwright module path.
- `PLAYWRIGHT_CHANNEL`: installed browser channel, such as `msedge`.
- `WWMS_TEST_PATH`: run one portal route only.

The browser suite mocks API and SignalR responses. It verifies authenticated image
rendering and replacement events across 21 portal screens, plus the owner upload
control and the no-image placeholder. It never writes to the running database.
## Deep-ocean Login and Sign Up

`deep-ocean-auth.cjs` is launched by
`PasswordRecoveryTests.Browser_LiveDeepOceanAuthentication_LoginRegistrationAndRoleRouting`.
It uses real authentication APIs/Identity and disposable SQL, testing all 11 login
roles, session restoration, both public registration types, errors and responsive
layouts. Unrelated portal datasets are isolated as unavailable fixtures. See
[AUTHENTICATION_UI_IMPLEMENTATION.md](../../AUTHENTICATION_UI_IMPLEMENTATION.md)
for setup and the exact coverage. It never registers accounts in the running app database.

## Password recovery flow

`password-recovery.cjs` is launched by the xUnit test
`PasswordRecoveryTests.Browser_LivePasswordRecovery_MobileDesktopAndEnglishOnlyFlow`.
It drives the production frontend against the real API/Identity services, a disposable
SQL database and a fake email sender. Never run it against a real user deployment.
See [PASSWORD_RECOVERY_IMPLEMENTATION.md](../../PASSWORD_RECOVERY_IMPLEMENTATION.md)
for configuration, SQL test setup, browser requirements and the security test inventory.

## Mandatory crew certificates

`crew-certificates.cjs` is launched by
`ComplaintAccountabilityTests.Browser_LiveCrewCertificates_UploadReviewDownloadAndApprove`.
It tests real private uploads/downloads, all existing accepted file formats, staff
certificate states, upload failure/retry, legacy review, and Admin/Wildlife approval
against a disposable SQL database. `deep-ocean-auth.cjs` also checks mandatory crew
certificate registration and the unchanged owner JSON registration flow.

Use the same SQL/browser environment variables documented above, with either
`PLAYWRIGHT_ENGINE=chromium` or `PLAYWRIGHT_ENGINE=webkit`. These scripts never
upload certificates or approve accounts in the running deployment.
See [CREW_CERTIFICATE_IMPLEMENTATION.md](../../CREW_CERTIFICATE_IMPLEMENTATION.md)
for the server test inventory and read-only staff audit command.

## Living public whale

`whale-motion.cjs` verifies seeded free exploration without content/obstacle inputs,
bounded steering, depth and delayed spine deformation.
`whale-autonomy.cjs` checks stationary exploration without masks/obstacles,
live head/body/tail response, navbar styling, all sections and responsive resizing.
`whale-visible-content.cjs` compares actual composited pixels to verify the whale
remains visible behind Home/About text, the Gallery caption and Contact heading.
`whale-free-swim.cjs` verifies zero whale scroll listeners, independent motion during
forward/reverse/fast scrolling, Home/About overlay absence and initial visible pixels,
preserved backgrounds and responsive resizing. `public-ocean.cjs`
checks responsive content preservation, four sections, reverse scrolling, Gallery,
navigation, Contact fixtures, reduced motion and scene cleanup. `living-whale.cjs`
verifies real WebGL swimming/perspective, actual animal pixels, visibility,
context loss, missing-WebGL fallback and constrained-device quality. Use the existing
Playwright variables above; both Chromium/Edge and WebKit are supported.

See [PUBLIC_OCEAN_IMPLEMENTATION.md](../../PUBLIC_OCEAN_IMPLEMENTATION.md) for commands,
the optional content baseline, recording options and verification limits. No real
email is sent by these scripts.

## Support Center

`SupportTests.cs` covers durable requests, validation/spam limits, idempotency,
notification retries/leases and the real SQL migration. Its browser test launches
`support-center.cjs` against a disposable API/Identity/SQL instance and checks all
eleven web portal help/return paths, 17 accordions, responsive form validation,
real acceptance, network/server failures and lost-response retries. Set
`WWMS_TEST_SQL_CONNECTION`, `WWMS_BROWSER_WEB_ROOT` and `PLAYWRIGHT_MODULE`; select
Chromium or WebKit with `PLAYWRIGHT_ENGINE`. Browser-harness mail is captured.
See [SUPPORT_CENTER_IMPLEMENTATION.md](../../SUPPORT_CENTER_IMPLEMENTATION.md)
for configuration, database changes and the separate live SMTP verification.
