# WWMMS system audit — 2026-11-04

Status: code audit and available verification completed; production release is **not signed off** because of the unresolved items below. Flutter/mobile source is excluded. Existing uncommitted work is preserved.

## Architecture and baseline

The React/Vite web application uses ASP.NET Core REST endpoints and the authenticated
`/hubs/operations` SignalR hub. ASP.NET Identity issues JWT access tokens and rotating,
hashed refresh tokens. EF Core persists Identity, operations, passenger records,
private uploads, complaints, recovery state and GPS telemetry in SQL Server.
TrackMyCar polling/history and Gmail SMTP run only on the backend. Passenger portals
also use separate hashed bearer sessions. Vite proxies `/api` and `/hubs` to port 8080.
The legacy TypeScript server files are empty and are not the active API.

Executed baseline: frontend lint and production build passed; all 164 backend tests
passed with SQL and six live browser tests enabled. Initial sandbox-only SQL failures
were environmental; the same checks passed outside the Windows sandbox. Vite also
required permission to start its build child process. Evidence is under
`.runlogs/audit-20261104-*`. The prior `STABILIZATION_REPORT.md` describes earlier work;
its claims are not substituted for results executed in this audit.

## Initial issue list (before application edits)

| ID | Severity | Evidence / root cause | Intended action |
| --- | --- | --- | --- |
| A01 | High | `TrackMyCarSyncWorker` sends coordinates and trip data through `Clients.All`; the hub allows every authenticated role. REST fleet/boat scoping is bypassed. | Match REST role, owner and assigned-crew visibility for GPS recipients. |
| A02 | High | `TripTransfersController` moves passenger rows without checking either trip's finalized verification or existing attendance. Check-in/audit records follow the row to the wrong trip. | Reject unsafe passenger transfers without changing records. |
| A03 | High | Individual transfer selections can leave `PrimaryPassengerId` pointing to a passenger on a different trip; shore search and QR group verification depend on the primary being registered on that trip. | Preserve complete passenger groups; reject a split with a useful validation message. |
| A04 | High | Staff reset/delete/get/list use the first permitted role; an account with both Supervisor and Admin can be managed by Wildlife even though PATCH already rejects it. | Apply the existing full-role restriction consistently. |
| A05 | Medium | TrackMyCar uses `ResponseHeadersRead`; the HttpClient timeout does not bound parsing a stalled response body. | Bound headers and body with the same cancellable request deadline. |
| A06 | Medium | OPS fleet requests can finish out of order and overwrite newer location data; the monitor starts uncaught promises. | Reproduce with delayed browser responses and guard stale writes/errors. |

## 1. Overall health and coverage

The inspected deployment is healthy and its checked database invariants are clean.
Confirmed defects were fixed in source without changing the architecture, portal
layouts, CSS, existing endpoint paths, or successful response shapes. The public
Contact form now has an additive API, following the user's instruction to deliver
inquiries to **eshannethmina51@gmail.com**. Invalid scheduling/transfer requests now
receive validation or conflict responses instead of corrupting workflow state.

The source inventory contains 182 web TypeScript/TSX files, 87 backend C# files
excluding migrations/generated output, 21 controllers, 37 migrations and 104 React
route declarations including nesting, aliases and redirects. See
[inventory](.runlogs/audit-20261104-inventory.json). Compilation/lint cover the web
source broadly; code review and behavioral tests concentrate on the security and
workflow areas described here. This is not a claim that every possible interaction
on every page or every endpoint permutation was manually exercised.

The final backend suite has **179 passing tests, no failures and no skips**, including
seven live browser workflows. Eight additional frontend suites passed after resolving
the browser configuration and test synchronization issues described below. The
backend changes were subsequently rebuilt and deployed into the running Docker API
on 2026-11-04 after the user reported Contact submission failure. The previous API
image lacked the endpoint and returned 401 through its fallback authorization policy.
The deployed Contact route now returns proper validation responses through both the
API and Vite proxy; API health/readiness and the read-only database checks pass.
Gmail authentication and container STARTTLS connectivity pass. No real test email
was sent, so inbox delivery still requires verification with an actual submission.

## 2–7. Confirmed application defects and fixes

| ID / severity | Root cause and impact | Focused fix | Verification |
| --- | --- | --- | --- |
| A01 — High, security / GPS | The GPS worker broadcast all coordinates, active-trip identifiers and stop data through `Clients.All`. Any authenticated account could receive fleet data even when REST rejected that role or another owner's boat. | Resolve current database membership at send time and use existing `user:{id}` hub groups. Preserve REST's owner-before-crew precedence; fleet-wide access remains Admin, Wildlife, OPS and ShoreCrew. Owners receive their boats; crew receive boats with their trip assignments. Payload/event names are unchanged. | The real worker with SQL-backed ingestion originally sent `*`; after correction it sends exactly the six expected user groups in the fixture and excludes unrelated and mixed-role accounts. |
| A02 — High, transfer integrity | Passenger transfers ignored finalized manifests and moved attendance/audit associations to another trip by updating the registration row. | Reject passenger transfers when either manifest is finalized or selected passengers have attendance history. Keep crew-only transfers and previously completed idempotent retries available. | Reproduced HTTP 200 for a forbidden transfer; regression checks source/destination finalization, partial check-in history and unchanged rows/audits on rejection. |
| A03 — High, QR / boarding | Individual transfers could separate a group's primary passenger and companions. Shore QR lookup/search require the primary on the same trip. | Reject split groups and explain that the primary and all members must be selected. Whole groups remain transferable. | Reproduced a successful split. Both split directions now return 409; a whole-group transfer succeeds and the same QR verifies all members on the destination trip. |
| A04 — High, staff authorization | Staff reset/delete/get/list selected the first manageable role. Wildlife could reset an account holding both Supervisor and Admin, despite PATCH already rejecting it. | Apply full-role restrictions consistently. Wildlife cannot manage an account with staff privileges outside Supervisor/HarbourOfficer. | Reproduced a successful privileged password reset; regression verifies rejection, hidden list/detail results, unchanged password/stamp and permitted supervisor/harbour resets. |
| A05 — Medium, external timeout | `ResponseHeadersRead` left JSON body parsing outside HttpClient's timeout. A provider that sent headers then stalled could stop polling/history work indefinitely. | Use a linked deadline for headers, stream acquisition and JSON parsing. Preserve caller cancellation and sanitized error categories. Dispose parsed documents when provider-level errors occur. | A stalled-stream test failed before the fix and now yields the `timeout` category; caller cancellation still propagates and the existing provider parsing/key-redaction tests pass. |
| A06 — Medium, frontend map consistency | Old fleet responses and out-of-order GPS events overwrote newer positions. OPS Monitor also started unhandled refresh promises. | Ignore superseded fleet requests and older telemetry; preserve newer live GPS fields when a slower REST snapshot arrives. Catch monitor refresh failures. | A delayed-response browser fixture reproduced latitude regression. It now verifies old response rejection, REST/SignalR ordering and late telemetry. No layout/style changes. |
| A07 — High, trip lifecycle | The departure path did not enforce one ongoing trip per boat; simultaneous starts both succeeded. | Check availability and update lifecycle/audit fields inside a serializable transaction with EF's existing retry strategy and fresh tracked state on retry. Publish only after commit. | Reproduced two successful starts. Concurrent requests now produce one 204 and one 409; a third departure is rejected. Existing lifecycle/role tests pass. |
| A08 — High, error disclosure | Program had no generic application exception handler; unhandled errors could expose diagnostics through the development error response. | Register an ASP.NET exception handler returning a generic JSON message and correlation ID. Provider-specific sanitized 503 handling remains in place. | Real HTTP middleware tests in Development and Production verify 500 JSON without the injected secret, exception type or stack. |
| A09 — High, scheduling data validation | Trip DTO lacked count bounds and route length validation. Negative counts could be persisted, capacity estimates could exceed the boat, and oversized routes reached SQL errors. | Validate route against its existing 300-character column, reject negative/oversized counts, enforce child/special-needs subtotals and boat capacity. | Reproduced HTTP 201 for negative counts. API/SQL regression checks all invalid cases leave trip counts unchanged and valid scheduling still succeeds. |
| A10 — High, crew scheduling | The explicit crew-selection branch skipped the exact-time conflict check used by automatic assignment and crew updates. | Apply the existing active-trip/time conflict rule to explicit selections in the scheduling transaction. No new trip-duration/overlap policy is invented. | Reproduced double-booking with HTTP 201. Existing conflicting assignments now produce 409 with no extra trip; a first valid explicit assignment succeeds. |
| A11 — Medium, public contact | The public form had no handler or delivery endpoint; submission reloaded the page without delivering an inquiry. | Add `POST /api/contact` using existing MailKit/Gmail settings and the user-selected backend recipient. Validate fields/body size, enforce 3 requests/minute/IP, use a fixed subject and authenticated From, and put the visitor in Reply-To. The subsequent theme update adds escaped ocean-themed HTML alongside the plain-text alternative. Add submitting/success/error behavior to the existing form. | API/browser tests verify validation, fixed recipient, no HTML execution, rate limits, real form/API success with a fake sender, generic SMTP failure and retained input on failure. Gmail STARTTLS/authentication passed separately; no real email was sent. |

Existing portal/operation roles retain their responsibilities;
all 11 login roles remain covered by the existing live authentication browser test.
The changes do not grant a new role access to any existing API. Contact is a new
anonymous endpoint with its own rate limit and fixed server-side destination.

### Test reliability correction

`ocean-dashboards.cjs` consistently asserted the boat count as soon as the independent
profile and static headings rendered. Its operations request had not completed yet.
The test now waits for an existing boat-detail button before asserting the same
four-boat count. No application behavior or assertion expectation was weakened.

### Contact email theme follow-up

At the user's request, inquiry emails now match the existing recovery email and
web ocean theme: navy background, cyan accents, rounded card, branded header,
sender details and message panel. `ContactEmailTemplate.cs` uses inline styles and
presentation tables without remote fonts or images. Every visitor field is HTML
encoded, message line breaks are retained, and MimeKit emits HTML/plain-text
alternatives. The existing recipient, subject, Reply-To and SMTP settings remain.

Seven focused Contact/recovery-email tests passed, including the real Contact
API/browser fixture with fake delivery. This targeted run follows the 179-test
audit suite above; a new encoding regression was added. Browser previews passed
at 375px and 800px without horizontal overflow and were visually inspected.
Evidence: `.runlogs/contact-email-theme-tests.log` and
`.runlogs/contact-email-theme/preview-375.png` / `preview-800.png`.

## 3–4. Backend and database findings

The read-only SQL audit ran against the actual Docker `WhaleWatching` database;
local `SQLEXPRESS` was used exclusively for disposable integration databases.
No application records were deleted, reset, approved, backfilled or edited by the
audit. Ongoing background GPS polling can naturally change telemetry counts.

| Live database check | Observed result |
| --- | --- |
| Database state / compatibility | ONLINE / SQL compatibility 160 |
| Applied migrations / latest | 37 / `20261029102800_AddPasswordRecovery` |
| Tables; users; boats; trips | 36; 30; 9; 7 |
| Passenger profiles / trip registrations / GPS rows | 50 / 50 / 36,953 at audit time |
| Disabled/untrusted FKs or checks; disabled indexes | 0 for each check |
| Duplicate normalized emails, passenger identities, active GPS devices, trip registrations | 0 for each check |
| Orphan registrations; groups missing their primary on the same trip | 0 for each check |
| Completed trips missing arrival; invalid ongoing timestamps; boats with multiple ongoing trips | 0 for each check |
| Undefined trip/boat approval statuses; invalid coordinates; telemetry over 5 minutes in the future | 0 for each check |
| Passenger/child/special-needs counter discrepancies | 0 for each check |
| Certified crew without stored certificate bytes | 0 |
| FKs without a supporting leading-column index | 0 |

Evidence: [SQL results](.runlogs/audit-20261104-live-database.log). The reusable
[SQL script](scripts/tests/audit-readonly.sql) returns only aggregate counts and
schema metadata. Certificate-byte presence is not proof of authenticity or a
substitute for officer review. Counter checks compare stored values with current
registrations; they are not automatic historical repair instructions.

EF reports **no pending model changes**. Its design-time command used the existing
factory because runtime connection configuration was not supplied. Existing warnings
about required relationships to soft-deleted boats remain; historical APIs already
use explicit `IgnoreQueryFilters` where required. No new migration is needed.

## 5. Authentication and application security

Reviewed Identity password policy/hashing, lockout, JWT validation/security stamps,
refresh rotation/reuse handling, recovery transactions, role/resource scoping,
private files, CORS, rate limiting and relevant SQL access. Existing tests exercise
OTP expiry/reuse, reset authorization replay, account-state binding, concurrent
reset/refresh behavior, generic recovery responses and SMTP failure retries.

The application uses bearer JWTs and separate passenger-session headers. It does
not implement a cookie-authenticated login session; this audit did not invent cookie
or CSRF claims. SQL values in the reviewed paths use EF parameterization or
interpolated SQL parameters. The reviewed web paths use React text rendering;
this is not an exhaustive penetration-test guarantee against every XSS vector.

Live anonymous probes verified 401 on staff/fleet/passenger monitoring and all
checked passenger-session endpoints, 401 on SignalR negotiation, 404 on an unknown
trip invitation, and rejection of an untrusted CORS origin. Configured localhost
origin access remains allowed. [HTTP evidence](.runlogs/audit-20261104-runtime.log).

No passwords, OTPs, authentication tokens, SMTP credentials or TrackMyCar keys
were printed in the new audit evidence. No dependency or lockfile changes were
introduced by this pass. npm's production and full dependency audits and NuGet's
transitive audit returned no known vulnerabilities from their configured feeds.

## 6. External integrations and workflow verification

| Area | Executed verification | Boundary |
| --- | --- | --- |
| TrackMyCar | Reviewed HTTPS/auth URL handling, parser, timeout, IMEI matching, ingestion uniqueness, UTC handling, history and error redaction; real worker/SQL regression and recorded provider tests pass. Running API logs showed 121 successful synchronizations and 0 failures in the inspected window. | Physical Teltonika hardware, changing device ownership and on-water connectivity were not exercised. Log success alone is not proof of each boat's physical position. |
| Gmail / recovery | Real Gmail STARTTLS/certificate validation/authentication succeeded with the existing credential-check script. Real recovery API/Identity/SQL/browser flows use the existing fake delivery service. | No actual OTP or Contact email was sent; inbox/spam delivery remains unverified. |
| Public Contact | User-selected destination stored in `Contact:RecipientEmail`; existing `PasswordRecovery:Smtp` settings stay backend-only. New endpoint does not depend on the recovery enabled flag or recovery hash key. The API was rebuilt/deployed during the Contact follow-up. | Synchronous SMTP failures return 503; there is no durable inquiry queue or automatic resend. Real inbox delivery has not been tested. |
| QR / shore | Generated QR decoding and scanner lifecycle fixtures, wrong-trip rejection, role restrictions, check-in/idempotency, finalization and transfer invariants pass. | Real camera permission/hardware behavior on physical phones remains unverified. |
| Maps / GPS / SLTDA | Route/stop fixtures, recorded-trip boundaries, country flags, passenger lists, fleet ordering and responsive portal checks pass. | External map tile availability and large-route load behavior are not guaranteed. |
| Registration / documents / approvals | Live disposable SQL/browser flows cover all login roles, owner/crew registration, mandatory crew files, private downloads and approval enforcement; existing boat-document tests pass. | Officer authenticity decisions and real account approvals were not performed. |
| Complaints / inquiries / signatures / SOS | Existing API/SQL contracts cover role visibility, assignments, transitions, replay/concurrency, notifications, signature workflows, passenger SOS and actions; existing browser workflows pass. | No real emergency, officer signature or external responder notification was triggered. |

## 8. Files changed by this audit

Pre-existing dirty files are not all audit-authored changes. The additions to already
modified `StaffController.cs`, `OperationsController.cs`, `TripTransfersController.cs`,
README and test documentation preserve the prior edits.

- Frontend: `apps/web/src/screens/OPS/store/useDashboardStore.ts`,
  `apps/web/src/screens/OPS/OPSmonitor.tsx`, `apps/web/src/screens/publicweb/Contact.tsx`.
- Backend: `server/Admin/StaffController.cs`, `server/Gps/TrackMyCarApiClient.cs`,
  `server/Gps/TrackMyCarSyncWorker.cs`, `server/Operations/OperationsController.cs`,
  `server/Operations/TripTransfersController.cs`, `server/Program.cs`,
  `server/appsettings.json`, new `server/Errors/ApiExceptionHandler.cs`,
  `server/Contact/ContactController.cs`, `server/Contact/ContactEmailSender.cs`.
- Tests: new `server.Tests/SystemAuditTests.cs`, `GpsAuditTests.cs`,
  `ApiExceptionHandlerTests.cs`, `ContactTests.cs`; new `scripts/tests/audit-fleet.cjs`,
  `audit-runtime.cjs`, `audit-readonly.sql`, `contact.cjs`; targeted synchronization
  correction in `scripts/tests/ocean-dashboards.cjs`.
- Documentation: this report, `README.md`, `scripts/tests/README.md`.
- Generated evidence: `.runlogs/audit-20261104-*`; the existing tracked TypeScript
  build-info file was updated by the production build.

## 9. Database changes and migration strategy

**No schema changes or migrations are required for these fixes.** No migration was
applied to the application database. Existing unique indexes/FKs protect the checked
relationships; the transfer and lifecycle fixes add transactional application checks.
No historical data repair is indicated by the executed aggregate queries.

For a future schema release: take and verify a restorable backup, review an
idempotent migration script and preflight duplicate/orphan counts, validate it on a
restored staging copy, then apply through an explicit deployment step. Never reset
the database or automatically run destructive down-migrations. The current Program
still invokes migrations at startup; production rollout must account for that fact.

## 10. Commands executed and actual results

| Check | Result / evidence |
| --- | --- |
| `npm run lint` | Passed on final frontend; `audit-20261104-lint-final.log`. |
| `npm run build` | Passed, including TypeScript checks; `audit-20261104-build-final.log`. Existing nonfatal SignalR pure-annotation warnings remain. |
| Backend baseline | 164 passed, 0 failed, 0 skipped; `audit-20261104-backend-baseline.log`. |
| Backend final compilation + suite | 179 passed, 0 failed, 0 skipped, including seven live browser tests; `audit-20261104-backend-final.log`, `.runlogs/audit-20261104-tests/audit-final.trx`. |
| Focused reproductions | Staff/transfer, GPS audience/body deadline, fleet race, simultaneous departures, negative counts and explicit double-booking failed as documented before their fixes. Their focused checks passed afterward. Before/after logs retain the evidence. |
| Eight frontend browser suites | `session-races`, `stabilization-ui`, `audit-fleet`, `boat-images`, `complaint-detail`, `shore-qr`, `sltda-trip-map`, `ocean-dashboards` passed in Edge/Chromium. Boat images cover 21 portal routes plus the placeholder; shore covers five pages at six widths; dashboards cover seven widths. |
| Public Contact tests | Four passed: fixed-recipient message construction, real API validation/rate limiting, sanitized failure, mobile/desktop real API browser workflow with fake SMTP. Included in final suite. |
| Live API probes | 13 passed; health/readiness, anonymous access, invalid invitation and CORS. |
| Live SQL connectivity / aggregate audit | Passed as detailed above, with no application writes. |
| `node scripts/check-recovery-smtp.cjs` | Gmail STARTTLS and authentication passed; no email sent. |
| `npm audit --omit=dev --json`, `npm audit --json` | Zero known vulnerabilities in both production and full dependency sets. |
| `dotnet list server/WhaleWatching.Api.csproj package --vulnerable --include-transitive --no-restore` | No vulnerable packages reported. |
| `dotnet ef migrations has-pending-model-changes --project server --no-build` | No pending model changes; existing design-time/global-filter warnings recorded. |
| Source `git diff --check` | Passed; existing LF/CRLF notices are informational. |

The backend's default .NET 10 SDK host initially needed major-version roll-forward.
Final tests explicitly use the available **.NET 8.0.29 host**. The running API reports
**.NET 8.0.33**. No runtimes or dependencies were installed for this audit.

Reproduce the final backend run from the repository root in PowerShell:

```powershell
$env:WWMS_TEST_SQL_CONNECTION='Server=.\SQLEXPRESS;Database=master;Integrated Security=True;TrustServerCertificate=True'
$env:PLAYWRIGHT_MODULE='C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:WWMS_BROWSER_WEB_ROOT='D:/SLCG-Whale-Watching-and-Boat-Monitoring-Platform/apps/web/dist'
dotnet test server.Tests/WhaleWatching.Api.Tests.csproj --no-restore --logger 'trx;LogFileName=audit-final.trx' --results-directory .runlogs/audit-20261104-tests -- RunConfiguration.DotNetHostPath=D:/SLCG-Whale-Watching-and-Boat-Monitoring-Platform/.tools/dotnet8/dotnet.exe
```

Build the frontend before the live browser tests. The listed module/runtime paths
are this machine's installed tools; adjust them on another machine. Fixture-only
source-module suites also require Vite at port 5173. Tests create and remove uniquely
named disposable databases; the configured production database is never their target.

Environment/test failures were investigated, not counted as successful checks:
Windows sandbox restrictions blocked SQL integrated encryption, Vite child processes
and direct browser launch. The relevant commands passed after authorized execution
outside that sandbox. The first boat-image run selected a missing bundled Chromium
binary; rerunning with installed Edge passed all cases. The dashboard count race
reproduced twice before the targeted test correction and final successful run.

## 11. Remaining issues and verification limits

| ID / severity | Root cause / status | Required follow-up |
| --- | --- | --- |
| R01 — High, passenger identity | `VerifyReturningPassenger` issues a passenger session from a known NIC/passport **or** unique phone number plus the trip invitation. An identifier lookup is not independent proof of identity. The route also lacks a dedicated brute-force limiter. This is an existing authentication design gap, separate from secure staff password recovery. | Define a returning-passenger proof using an existing trusted session/personal QR, staff verification, or verified contact challenge. Add rate limits and tests for impersonation/enumeration. This workflow/API change was not invented during a compatibility-preserving audit. |
| R02 — High, production configuration | Compose is a development deployment: Development environment, SA database access, sample initial-account password fallbacks and automatic startup migrations. These are source/deployment findings, not a claim that those fallback passwords are active. | Provision a least-privilege app login and controlled migration principal, use production secret provisioning and hosting, verify no known seed credentials remain, and review migration scripts before rollout. No real credentials/accounts were changed. |
| R03 — Resolved in Contact follow-up, deployment state | The API was rebuilt and restarted without recreating SQL Server or changing its volumes. The old image is retained as `whale-watching-api:before-contact-20261104`. The current live JWT signing key was preserved because the local Compose setting differed. | Health/readiness, 13 API access/CORS probes, Contact routing through the frontend proxy and SQL integrity checks pass. Users/boats/trips/passenger totals and all 37 applied migrations are unchanged. Resolve local/live signing-key configuration drift deliberately before future redeployments; no keys were printed or files with credentials edited. |
| R04 — Medium, broader transaction/concurrency coverage | Other workflows such as staff role editing and profile editing perform multiple Identity saves; departure/end/decline/reschedule combinations and crew changes during departure do not all have failure-injection/concurrency coverage. Boat/crew approval revalidation at departure needs an explicit operational policy. | Add rollback and competing-transition integration cases, then extend transaction/conditional-write guards where reproduced. Do not infer approval responsibilities or change status rules without the policy. The new start/start regression does not establish coverage of all pairs. |
| R05 — Medium, performance | Some operations/directory/document lists are unpaginated; staff listing does per-user role queries, document lists materialize file bytes, and long route queries can return many points. Current data volumes are too small for a production performance claim. | Benchmark realistic fleet/telemetry volumes; add projections/paging and query limits where contracts allow. Preserve full-quality report/history exports. |
| R06 — Medium, upload hardening | Crew certificates/boat documents have stronger content checks than profile photos and complaint evidence, which rely more on MIME/size. Evidence downloads use attachment/octet-stream protection. No active-content exploit was demonstrated. | Add structural image validation/scanning according to accepted-format policy, and test malformed/oversized filenames and image content without breaking valid existing uploads. |
| R07 — Medium, external end-to-end verification | SMTP authentication and provider logs are verified, but real inbox delivery, physical tracker/camera behavior and external map-service failure recovery remain unverified. | Use authorized test mailboxes/devices and controlled staging exercises. Contact uses synchronous SMTP and can fail without a persisted queue; do not promise delivery during outages. |
| R08 — Medium, logout/revocation | Web logout clears local state; there is no server logout endpoint to revoke a stolen refresh-token family. Existing password/staff stamp changes and refresh reuse detection remain available controls. | Define per-device versus all-device logout, add server revocation and stolen-token tests, and preserve mobile API compatibility. |
| R09 — Low, event metadata / soft-delete warnings | General `operationsChanged` and some wildlife events still broadcast resource identifiers to all authenticated connections, although GPS payloads are now scoped. Required relationships to soft-deleted boats emit EF warnings. | Review notification metadata scope and add historical soft-delete regressions before changing visibility. Current GPS recipient rules intentionally match existing REST historical crew visibility. |

## 12. Before production deployment

1. Resolve R01's returning-passenger identity policy and R02's production configuration.
2. Review the deployed source changes; no database reset, schema migration,
   historical backfill, dependency replacement or UI redesign is part of this release.
3. Verify the Contact recipient and server-side Gmail configuration; run an authorized
   inbox-delivery test after deployment. The audit sent no real messages.
4. Repeat role/resource-access, transfer/finalization and simultaneous-departure smoke
   checks against the deployed build using controlled accounts and records.
5. Exercise physical GPS/camera and SMTP/map outage behavior; add the transaction and
   realistic-load tests identified above. Maintain a verified backup/rollback path.

The automated checks support the focused fixes listed here. The remaining design,
deployment and external-verification items prevent a blanket production-ready claim.
