# Boat image regression checks

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
## Password recovery flow

`password-recovery.cjs` is launched by the xUnit test
`PasswordRecoveryTests.Browser_LivePasswordRecovery_MobileDesktopAndEnglishOnlyFlow`.
It drives the production frontend against the real API/Identity services, a disposable
SQL database and a fake email sender. Never run it against a real user deployment.
See [PASSWORD_RECOVERY_IMPLEMENTATION.md](../../PASSWORD_RECOVERY_IMPLEMENTATION.md)
for configuration, SQL test setup, browser requirements and the security test inventory.

