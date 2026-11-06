# WWMS stabilization report

Date: 2026-11-03 (Asia/Colombo).

Existing uncommitted dashboard work was preserved. This pass reviewed frontend routing, session handling, owner forms and shared components; backend staff permissions, passenger registration and attendance, operations/transfers, complaints, profiles/uploads, recovery, GPS/tracking and signatures; EF mappings/migrations and deployment settings. Changes below address confirmed defects. The existing portal layouts, themes, role responsibilities, approval rules and API routes remain in place.

## Confirmed defects and fixes

| Defect and evidence | Targeted correction |
| --- | --- |
| Staff PATCH accepted an owner/crew/passenger account ID and added a staff role. A disposable SQL test reproduced HTTP 200 instead of rejection. | `server/Admin/StaffController.cs` now requires the target to already hold a staff role. Tests verify unchanged identity/roles on rejection and a successful permitted Wildlife supervisor edit. |
| A refresh response arriving after logout restored the stored refresh token; an old 401 could clear a newer login. Concurrent refreshes could rotate the same token twice. | `authApi.ts` checks session generation and the originating token, shares an in-flight refresh, validates responses before storage, and cancels stale logins. `AuthContext.tsx` ignores obsolete restoration/refresh results. Browser fixtures reproduced the original failure and verify each race. |
| Returning-passenger lookup threw HTTP 500 when family members shared a phone number. | `PassengerTripController.cs` resolves the unique normalized NIC/passport first. Phone lookup detects ambiguity and returns HTTP 409 with instructions to use NIC/passport, without issuing a session or registering somebody arbitrarily. Unique phone/NIC lookups still work. |
| Boat approval accepted undefined numeric enum values, such as `999`, and persisted them. | `OperationsController.cs` restricts approval to the existing Approved/Rejected values before any writes. Tests reproduced HTTP 204 for invalid input before the fix. |
| Shore attendance accepted undefined numeric values; these counted as checked and could finalize verification. | `PassengerAttendanceController.cs` requires a defined attendance enum. Tests verify HTTP 400 with no attendance, audit or finalization writes. The existing valid check-in regression still passes. |
| New and returning special-needs registrations did not increment their trip counter. Transfers left special-needs counts on the old trip. | Passenger registration and transfer endpoints update `SpecialNeedsCount` in their existing transactions. SQL tests cover registrations, transfers and idempotent retries. No historical records were rewritten. |
| Late crew search responses replaced newer suggestions. Crew reloads could also finish out of order. | `BoatOwnerCrewPage.tsx` keys suggestions to the current token/query, ignores cancelled responses, and guards reload responses by request/token. A delayed browser fixture reproduced stale suggestions before the fix. |
| A destination-trip request for boat A could finish after selecting boat B and display A's trips under B. | `TripTransferModal.tsx` invalidates obsolete requests on selection changes/unmount and prevents stale success/error/loading updates. The focused browser check verifies B's trips remain visible after A's late response. |
| The existing crew table clipped action buttons on mobile. | Its existing container now scrolls horizontally. Column order/layout and actions are unchanged. A 390px browser check scrolls to and opens the original crew information dialog. |
| The frontend lint baseline failed with 11 errors and one warning. | Removed unused imports; used native anchor fallback in `Navbar`; typed Three.js color-space assignment; retained one-time ColorBends GPU initialization with its existing prop-update effect; fixed owner effect handling as above. Shared button exports and the Admin context/provider were separated into valid Fast Refresh module boundaries with the original import paths/exports preserved through `.ts` barrels. No lint rules were disabled. |
| NuGet identified vulnerable transitive `System.Security.Cryptography.Pkcs` 8.0.1, introduced through MimeKit. | Pinned the existing dependency to the compatible 8.0.2 security patch in `WhaleWatching.Api.csproj`. The post-patch NuGet audit reports no vulnerable packages. Microsoft identifies 8.0.2 as the patch for [CVE-2026-84008](https://github.com/dotnet/announcements/issues/468) and [CVE-2026-70162](https://github.com/dotnet/announcements/issues/454). Presence of an affected package was confirmed; exploitation through an application endpoint was not demonstrated. |

## Regression tests added or corrected

- `server.Tests/StabilizationTests.cs`: six SQL integration tests covering staff identity/roles, invalid boat/attendance statuses, shared-phone lookup and special-needs registration/transfer counters.
- `scripts/tests/session-races.cjs`: delayed authentication responses, logout/new-login isolation, concurrent refresh deduplication and invalid response storage.
- `scripts/tests/stabilization-ui.cjs`: delayed crew queries, mobile action access and changing transfer destinations while a prior request is pending.
- `complaint-accountability.cjs`: corrected two demonstrably outdated/timing-sensitive assertions. Passenger links now include the existing country flag's accessible label, so the test verifies the passenger name and exact profile URL. Forwarding now waits for saved assignment cards instead of the checkbox that was visible before submission. Application complaint behavior was unchanged.

The module-based race checks require Vite because they import the actual source modules. All fixture responses are confined to tests. SQL/API/browser integration tests create and delete uniquely named test databases, use synthetic users and a fake recovery email sender, and do not modify the running application's records.

## Commands and results

From `apps/web`:

```powershell
npm run lint
npm run build
npm ls --depth=0
npm audit --omit=dev --json
```

All passed. The build includes TypeScript checking. npm reported zero known production dependency vulnerabilities. Existing nonfatal SignalR pure-annotation build warnings remain.

From the repository root, with .NET 10 rolling forward the existing .NET 8 test target:

```powershell
$env:DOTNET_ROLL_FORWARD='Major'
$env:WWMS_TEST_SQL_CONNECTION='Server=.\SQLEXPRESS;Database=master;Integrated Security=True;TrustServerCertificate=True'
$env:PLAYWRIGHT_MODULE='C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:WWMS_BROWSER_WEB_ROOT='D:/SLCG-Whale-Watching-and-Boat-Monitoring-Platform/apps/web/dist'
dotnet restore server.Tests/WhaleWatching.Api.Tests.csproj
dotnet test server.Tests/WhaleWatching.Api.Tests.csproj --no-restore --logger 'trx;LogFileName=complete-final.trx' --results-directory .runlogs/stabilization-tests
dotnet list server/WhaleWatching.Api.csproj package --vulnerable --include-transitive --no-restore
```

Final full-suite result: **164 passed, 0 failed, 0 skipped**, including all six live API/SQL browser integrations. See `.runlogs/stabilization-complete-final.log` and `.runlogs/stabilization-tests/complete-final.trx`.

The original baseline passed 152 tests with six browser tests skipped. New focused tests first reproduced the confirmed server/session failures, then passed after correction. The NuGet audit after patching reports no vulnerable packages in the configured source.

Additional browser commands, using the Playwright environment above and Vite on port 5173:

```powershell
node scripts/tests/session-races.cjs
node scripts/tests/stabilization-ui.cjs
node scripts/tests/boat-images.cjs
node scripts/tests/complaint-detail.cjs
node scripts/tests/shore-qr.cjs
node scripts/tests/sltda-trip-map.cjs
node scripts/tests/ocean-dashboards.cjs
```

All passed in Chromium/Edge. Coverage includes all 21 existing boat-image portal routes plus the missing-image placeholder, complaint details/forwarding, QR decoding/camera lifecycle fixtures, five shore pages at six widths, recorded GPS/maps/country flags, original dashboard layouts at seven widths, session races, transfer selection and mobile crew actions. The real API/SQL browser suite additionally covers authentication and registration, OTP recovery, private certificates and approvals, complaint accountability/notifications, SLTDA maps/passengers and shore QR attendance.

`PLAYWRIGHT_ENGINE=webkit node scripts/tests/ocean-dashboards.cjs` also passed against the final frontend (set the environment variable separately in PowerShell). This verified the preserved dashboard layouts, actions, reduced motion and decoration at the same seven widths in WebKit.

Source-only `git diff --check` passed. Generated service logs contain unrelated existing formatting noise and were preserved.

## Runtime, data and limitations

- The requested Cloudflare tunnel was started. The public login form was verified in a real browser; unauthenticated protected API access correctly returned HTTP 401. Vite was restarted to clear cached paths after the module-boundary correction.
- The web server reads the frontend changes. The existing Docker API was not rebuilt/deployed during this code stabilization pass; backend fixes and the security dependency patch require the normal API rebuild/redeploy.
- No database schema changes, migrations, application-data resets, historical counter backfills, real account approvals or configuration/credential edits were made. Tests used disposable databases only.
- No real recovery email was sent. Delivery/recovery were verified using the fake email sender in the real API/Identity integration flow. Physical GPS hardware, real camera permissions on mobile devices and real SMTP delivery were not exercised.
- This pass does not establish that every possible defect is absent. The fixes above have reproduced behavior or direct audit evidence and focused regression coverage; hardware and external-service behavior remain separate verification limits.
