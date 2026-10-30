# SLTDA monitoring and complaint accountability

Implemented on 20 October 2026 in the existing React, ASP.NET Core, EF Core / SQL Server, JWT and SignalR application. Runtime screens use database-backed APIs. Test data is confined to disposable integration databases.

## Delivered behavior

- `/sltda`: date-filtered passenger and case analytics, interactive metric links, passenger registration and complaint/inquiry charts, current case status distribution, recent cases and CSV export. Metric definitions distinguish all-time profiles from activity within the selected period; acknowledgment and response queues intentionally overlap.
- `/sltda/passengers`: server-paginated search by name, identifier, contact or passenger ID, type/country filtering and sorting. Profiles show registration details, historical/current trip participation, attendance, and complaint/inquiry history. Linked trip pages show boat/operator, dates, lifecycle and paginated participants. Admin has equivalent monitoring routes under `/admin`.
- Complaint lists, details, authenticated evidence downloads, review, multi-authority referrals, independent acknowledgments, official responses, follow-up remarks, resolution, closure and reopening. History is append-only through the API and includes the acting user, server time, assignment, notes and status changes.
- One complaints destination in the existing Admin, OPS, Wildlife, SLTDA and Harbour Officer header. There is no secondary complaint navigation bar. SLTDA's single header includes Dashboard, Passengers, Trip history and Complaints & inquiries, with responsive navigation, notifications and account controls. Passenger monitoring and complaint notification links remain page actions within complaint screens.
- Database notifications with actual unread counts, persistent read/unread changes and complaint/assignment navigation. User-scoped refresh events reuse `OperationsHub`; lists also refresh every 15 seconds and on focus. No complaint content is broadcast through role/all-client groups.
- Transactions commit status changes, assignments, history and notifications together. Optimistic versions and serializable transactions handle concurrent workflow actions; request IDs and unique indexes prevent duplicate assignments/events/notifications. Passenger submissions also support safe retries using an optional client-generated request UUID as the canonical complaint ID, with ownership and payload checks. Legacy submissions without that field remain supported.

## Roles and authority mapping

`SLTDA` is an Identity role created through the existing role seeder. Only Admin may create/manage SLTDA staff accounts. Public registration remains restricted to BoatOwner and BoatCrew.

`PassengerMonitoring` permits Admin and SLTDA. The complaint-handling and receiving roles are **OPS (SLCG OPS), Admin (SLCG Admin), Wildlife, SLTDA and HarbourOfficer**, as requested. ShoreCrew, ShoreWildlife and Supervisor do not have complaint access. `ComplaintAccess` checks current database membership, confirmed email and account lockout state as well as endpoint policies. Non-monitoring authorities see only assigned complaints and their own handling history. Admin and SLTDA retain monitoring access across complaints, but may respond only to assignments for their own authority. Passenger contact details and system-wide monitoring endpoints remain restricted to monitoring users.

The repository has no separate authority organization/office table. Each receiving authority therefore maps to an existing Identity role ID; its confirmed, unlocked members are the eligible recipients. Only the five roles above can receive referrals; roles with no eligible users cannot receive them. A complaint has at most one retained assignment per authority; reopening reactivates those assignments and preserves earlier responses in history. Reassignment to individual officers is not introduced. Monitoring users who receive a referral get one assignment notification rather than an additional monitoring notification for the same action. These permission and navigation adjustments require no additional schema migration and retain existing history.

SLTDA gains no boat/trip/passenger mutation permission, staff management or settings access. The previously authentication-only trip crew endpoint now explicitly permits its operational roles, preventing the new monitoring role from receiving unrelated crew identifiers and contact data.

## Lifecycle decisions

- New records start as `Submitted`; monitor review moves them to `UnderReview`.
- Forwarding creates `Pending` assignments and aggregates the overall status to `Forwarded`.
- Authorities must acknowledge before posting progress or responses. Assignment states are `Pending`, `Acknowledged`, `InProgress`, `Responded`. Subsequent remarks/responses create new events; a responded authority may resume investigation.
- Overall status becomes `Acknowledged` when all assignments acknowledge; partial responses/progress produce `InProgress`; all responses produce `Responded`. A response never resolves or closes a complaint.
- Monitors may explicitly move `UnderReview` or `Responded` to `Resolved` only with no unanswered assignments, then move `Resolved` to `Closed`.
- Monitors may reopen `Resolved` or `Closed` records. Existing assignments require fresh authority responses, their previous remarks remain in history, and receiving authorities are notified.
- Review, resolution, closure and reopening require a remark. Invalid transitions and stale versions return 409; malformed input returns 400; inaccessible records return 404 or role-level 403.

The initial implementation added `PassengerComplaint.Kind`, distinguishing `Complaint` and `Inquiry` in the existing passenger form. The redesign verified that the passenger's choice persists through the API, SQL database, lists and analytics. Both use the same record, relationships and handling workflow. Records from the former complaint-only submission flow retain their original Complaint classification. Any other stored classification is explicitly reported as Unclassified, remains filterable, and is never guessed or rewritten. Case type remains independent of workflow status.

## SLTDA analytics redesign

The dashboard heading is now **Passenger activity**. It uses the existing logo, Geist typography, restrained navy/indigo surfaces, contextual Lucide icons and distinct metric accents. The four primary cards open matching passenger, trip or open-case lists. Complaint and inquiry totals are separate links beside their chart; status and queue links retain the reporting period. Trip history is a real server-paginated, read-only list with search, dates, lifecycle filters and existing trip detail links.

Reporting defaults to the last 30 inclusive Sri Lanka calendar days. Presets cover 7, 30 and 90 days, with a custom range up to 366 days and daily, Monday-based weekly or calendar-month grouping. Registration counts use passenger profile creation timestamps; trip participation registrations are separately labeled. Trips use scheduled departure timestamps. Case counts use submission timestamps; status distribution shows the **current** state of cases submitted within the period, not a fabricated historical resolution trend. All-time passenger totals are explicitly labeled and remain unchanged by the date filter.

The new analytics endpoint aggregates dates and statuses in SQL and returns bounded, zero-filled chart buckets. It does not download full passenger/case tables. Matching drill-down filters use the same Colombo day boundaries. URL parameters preserve the selected range, interval and list filters across reload and browser navigation. CSV export contains the actual aggregate metrics, time buckets and status counts, with period, timezone and generation time.

Recharts `3.10.1` and React-matched `react-is` `19.2.7` were added after checking the installed React and the [official Recharts installation guidance](https://recharts.github.io/en-US/guide/installation/). Charts load in a separate lazy bundle. Existing `framer-motion` and `lucide-react` are reused. No framework upgrade, new animation library or analytics schema migration was needed.

After the 126-test regression run, the local Docker API was rebuilt and restarted with the analytics endpoints. `/health/ready` returned 200, and an unauthenticated analytics request returned 401. The Vite frontend at `http://localhost:5173/sltda` now uses the updated local API.

Accessible data tables accompany both charts. Loading skeletons, explicit zero-activity states and retryable API errors prevent fabricated fallback metrics. Existing cached values on refresh failure are labeled as last available data. Short page/card/chart transitions honor reduced-motion preferences. The mobile menu supports Escape and focus return, custom date controls fit narrow viewports, focus rings are visible, and secondary text contrast was improved. Existing JWT policies, current membership checks and read-only monitoring permissions apply to the added endpoints.

## Database and rollout

Migration: `20261020034257_SltdaComplaintAccountability`.

- Adds `Kind`, `Status`, `UpdatedAtUtc`, and concurrency `Version` to `PassengerComplaints`.
- Adds `ComplaintAssignments`, `ComplaintEvents` (also the response/remark history), and `ComplaintNotifications`, with foreign keys and delete restrictions protecting retained history.
- Adds unique complaint/authority, actor/request and event/recipient indexes, plus passenger search, status and notification indexes.
- Backfills existing records with their original submission timestamp, a new workflow version and a `Submitted` history event. No passenger, trip, boat or complaint records are copied or deleted; historical authority activity is not invented.
- The down migration refuses to remove tables containing complaint history. Retain/export audit records before considering rollback.

The API already applies pending migrations and required role seeds at startup. For a controlled rollout, configure the existing SQL Server connection and apply:

```powershell
dotnet ef database update --project server
```

Then restart the API and deploy the web build. Startup creates the SLTDA role. Create an SLTDA account through **Admin → Staff**, or configure `IdentitySeed__SltdaEmail` and `IdentitySeed__SltdaPassword` before startup to provision a new initial monitoring account. As with the existing seeder, an existing account is not silently promoted or password-reset. No credentials were added to source or `.env`.

Migration application and repeat application were verified against disposable SQL databases, including upgrading a real record from the preceding migration. During the later staff-creation fix, the local Docker API was rebuilt and restarted on 20 October 2026. Its normal startup applied `20261020034257_SltdaComplaintAccountability` to the local application database; startup completed and `/health/ready` returned 200. User-created operational records were retained. Other environments still need the rollout above.

## APIs

| Method | Route | Scope / behavior |
|---|---|---|
| GET | `/api/passenger-monitoring/dashboard` | Admin/SLTDA live totals and recent events |
| GET | `/api/passenger-monitoring/analytics` | Admin/SLTDA; inclusive `from`/`to` calendar dates, `interval=daily|weekly|monthly`; aggregate metrics, trends, current statuses and recent cases |
| GET | `/api/passenger-monitoring/passengers` | Paginated search, sort, type/country and inclusive registration date filters |
| GET | `/api/passenger-monitoring/passengers/{id}` | Passenger registration/profile DTO |
| GET | `/api/passenger-monitoring/passengers/{id}/trips` | Paginated registration/trip history |
| GET | `/api/passenger-monitoring/trips/{id}` | Read-only trip detail and paginated participants |
| GET | `/api/passenger-monitoring/trips` | Read-only paginated trip search, scheduled-date, lifecycle and sorting filters |
| GET | `/api/complaint-workflow` | Resource-scoped list; search/status/kind (including Unclassified)/passenger/authority/date/sort and workflow queue filters |
| GET | `/api/complaint-workflow/authorities` | Monitoring users; current role records and eligible user counts |
| GET | `/api/complaint-workflow/{id}` | Scoped detail, assignments, full timeline, allowed monitor transitions |
| POST | `/api/complaint-workflow/{id}/actions` | `forward`, `assignment`, or `status`; actor comes from authentication |
| GET | `/api/complaint-workflow/{id}/evidence/{imageId}` | Authorized attachment download |
| GET | `/api/complaint-notifications` | Recipient-scoped paginated notifications plus unread total |
| GET | `/api/complaint-notifications/unread-count` | Recipient's actual unread count |
| PUT | `/api/complaint-notifications/{id}/read` | `{ "read": true }` or false; recipient only |
| POST | `/api/complaints` | Existing passenger-session multipart submission; optional `Kind` and retry `RequestId` |

Collections use `page` (default 1), `pageSize` (default 20, maximum 100). Complaint dates are start-inclusive/end-exclusive; the UI translates whole Sri Lanka calendar dates accordingly. All server timestamps are UTC `DateTimeOffset`; monitoring screens display Asia/Colombo time. Historical joins retain soft-deleted boat records without restoring them operationally.

Workflow action bodies require `requestId`, the current complaint `version`, and `action`. `forward` supplies `authorityRoleIds` and optional `note`; `assignment` supplies `assignmentId`, `status` and a response/progress `text`; `status` supplies overall `status` and `text`. Retrying an identical action must reuse its original body and ID. A changed payload using the same ID returns 409.

The legacy `GET /api/complaints` array contract is retained for monitoring users, capped at 100 records. Wildlife's former global complaint access is intentionally replaced by the assigned-complaint API. New screens use the paginated workflow endpoints and load evidence on demand.

## Source changes

New backend files:

- `server/Complaints/ComplaintAccess.cs`, `ComplaintRules.cs`, `ComplaintWorkflow.cs`, `ComplaintQueries.cs`, `ComplaintWorkflowController.cs`, `PassengerMonitoringController.cs`, `ComplaintNotificationsController.cs`.
- `server/Domain/ComplaintWorkflow.cs`, `server/Data/ComplaintModelConfiguration.cs`.
- `server/Complaints/PassengerAnalyticsController.cs`, `MonitoringAnalytics.cs`.
- Migration and designer for `20261020034257_SltdaComplaintAccountability`.

Modified backend files:

- `server/Auth/PortalRoles.cs`, `PortalPolicies.cs`; `server/Program.cs`.
- `server/Admin/StaffController.cs`; `server/Data/IdentitySeeder.cs`, `WhaleWatchingDbContext.cs`.
- `server/Domain/PassengerRecords.cs`; `server/Passenger/ComplaintsController.cs`; `server/Operations/OperationsController.cs` (trip-crew authorization).
- `server/Migrations/WhaleWatchingDbContextModelSnapshot.cs`.

New frontend files:

- `apps/web/src/screens/Complaints/complaintApi.ts`, `useComplaintData.ts`, `useComplaintPortal.ts`, `ComplaintComponents.tsx`, `ComplaintListPage.tsx`, `ComplaintDetailPage.tsx`, `ComplaintNotificationsPage.tsx`.
- `apps/web/src/screens/SLTDA/SltdaLayout.tsx`, `SltdaDashboard.tsx`, `PassengerMonitoringPage.tsx`, `PassengerProfilePage.tsx`, `MonitoringTripPage.tsx`.
- `apps/web/src/screens/SLTDA/AnalyticsCharts.tsx`, `AnalyticsControls.tsx`, `analyticsApi.ts`, `TripHistoryPage.tsx`, `sltda.css`.
- `apps/web/src/screens/SignaturePortal/SignaturePortalHeader.tsx` reuses the existing signature portal header across Harbour complaint and signature pages.

Modified frontend files:

- `apps/web/src/App.tsx`, `auth/types.ts`, `screens/publicweb/Login.tsx`, `screens/Admin/staffApi.ts`.
- `apps/web/src/screens/Passenger/complaintsApi.ts`, `PassengerOnboardingPage.tsx`.
- `apps/web/src/screens/OPS/components/Navbar.tsx`, `screens/SignaturePortal/SignaturePortalPage.tsx`.

Tests: `server.Tests/ComplaintAccountabilityTests.cs` and `scripts/tests/complaint-accountability.cjs`. Existing `apps/web/public/sltda-logo.png` is reused. Unrelated working-tree edits were preserved.

## Verification

- Full xUnit suite: **126 passed, 0 failed, 0 skipped**, with SQL integration and the real browser workflow enabled. The recipient-policy test verifies all five permitted roles can acknowledge/respond to their own assignments, excluded roles are rejected, and monitoring recipients do not receive duplicate referral notices. Staff management is also covered through real HTTP requests for all staff roles.
- Analytics HTTP/SQL coverage verifies Colombo midnight boundaries, real Complaint/Inquiry/Unclassified grouping, zero-activity days, daily/weekly/monthly buckets and partial edge buckets, matching passenger/trip/case drill-down totals, pagination, historical boat records, denied roles and invalid ranges/intervals. Browser coverage verifies chart rendering and interval changes, accessible data tables, CSV download, date-preserving card links, persisted Inquiry filtering, empty/error states without fake metrics, responsive navigation, reduced-motion mode and mobile overflow at 390px and 320px. The custom date picker is checked inside the 320px viewport.
- HTTP tests use real JWT validation and SQL queries. They cover both monitoring roles, forbidden roles and operational writes, removed memberships, unrelated complaints/assignments/notifications, multi-authority referrals, acknowledgments, repeated/follow-up responses, explicit closure/reopening, scoped history, live counts, inquiries and existing submission, filtering/pagination, stale versions, concurrent duplicate actions/submissions and transaction rollback after a simulated failure following SQL writes.
- Migration test upgrades the previous schema with a retained complaint and confirms repeated application is safe. Existing registration, trip, image/document, country, attendance-related, authentication and other regression tests remain passing.
- Headless Edge / Playwright uses the built React app, real authentication/refresh tokens, live HTTP APIs, SignalR and a disposable SQL database. It verifies passenger history, review/referrals to OPS and Wildlife, notification navigation, scoped official/follow-up responses, closure/reopening, read persistence after reload, unauthorized routes and mobile overflow. It also checks the five-recipient selector, a single header with no additional complaint navigation bar in Admin, OPS, Wildlife, SLTDA and Harbour screens, and access to monitoring/updates from page actions. No API/SignalR mocking or interception. Dashboard, Admin and mobile screenshots were inspected.
- `npm run build`: passed. Existing SignalR annotation and large-bundle warnings remain.
- ESLint for every changed/new frontend source file: passed.
- Repository-wide `npm run lint`: **13 errors, 2 warnings in untouched files** (`ColorBends.tsx`, public `Navbar.tsx`, UI `button.tsx`, `AdminRecordsContext.tsx`, owner crew/profile/transfer screens and `PassengerAttendancePanel.tsx`). These are outside this change.
- `dotnet ef migrations has-pending-model-changes`: no pending model changes. EF reports the pre-existing required-navigation/boat-query-filter warnings; the design-time factory is used without application secrets.

Test reports and screenshots are under `.runlogs/sltda-test-results/` and `.runlogs/sltda-browser/`, including `final-regression.trx`, `sltda-dashboard.png` and `sltda-mobile-empty.png`. To reproduce the SQL tests, set `WWMS_TEST_SQL_CONNECTION` to a SQL login allowed to create/drop databases and run `dotnet test server.Tests/WhaleWatching.Api.Tests.csproj`. The supplied database name is replaced with a unique disposable test name. For browser coverage also set `PLAYWRIGHT_MODULE` to an installed Playwright package, `PLAYWRIGHT_CHANNEL` if needed (tested with `msedge`), and `WWMS_BROWSER_WEB_ROOT` to the absolute `apps/web/dist` directory after building the web app. `WWMS_BROWSER_SCREENSHOTS` optionally chooses a screenshot output directory. Browser coverage is explicitly skipped when its prerequisites are not configured. This host has a .NET 10 SDK and a local .NET 8 runtime; verification used `DOTNET_ROLL_FORWARD=Major` for the SDK-launched test/EF tools. Normal .NET 8 environments do not need that override.

## Operational limits

No new paid email/SMS service, external analytics service, organization hierarchy or officer reassignment process is introduced. In-app delivery remains available through persisted records if SignalR refresh fails. The local Docker API has completed its startup rollout; provision any required SLTDA account through Admin → Staff. Regression-test accounts were created only in disposable test databases. The unrelated repository lint failures remain outstanding.

## Staff creation validation fix

The Admin → Staff 500 error was reproduced from the running API log and through an HTTP integration test. `CreateStaffRequest` placed DataAnnotations on generated record properties using `[property: ...]`; ASP.NET requires validation metadata on the positional record constructor parameters. The same issue affected `UpdateStaffRequest` and `ResetStaffPasswordRequest`.

Those three request records now put validation attributes on their constructor parameters, preserving the existing limits and authorization. Real HTTP tests create every permitted staff role, follow the 201 Location, confirm persisted membership, check duplicate rejection, edit staff, reset passwords, and verify invalid email/password/phone input returns 400 without creating a user. The live browser test also creates an SLTDA account through Admin → Staff in its disposable test database. The local API container was rebuilt and restarted with the fix and passed its readiness check. No schema change is needed for this validation fix itself; the container startup also applied the previously pending complaint migration described above.

## Trip GPS history and passenger flags — 28 October 2026

SLTDA trip information now includes a recorded route map, distinct start/end markers,
zoom/pan controls, full-route bounds and a legend. The timeline shows actual departure,
arrival, elapsed duration, coordinates, recorded distance and last GPS update using
Sri Lanka time. Ongoing routes identify the latest recorded position without a final
endpoint. Empty, single-point, loading, error and unavailable-basemap states are handled.

Frontend: `MonitoringTripPage.tsx` and `PassengerMonitoringPage.tsx` integrate
`SltdaTripTracking.tsx`, `tripTracking.ts` and `PassengerNameFlag.tsx`. The existing
`TripRouteMap.tsx` and `CountryFlag.tsx` have optional monitoring behavior; their
other callers retain their defaults. No dependencies or portal redesign were added.
GPS requests are briefly cached per session and trip, bounded to 32 entries. Ongoing
trips refresh every 15 seconds; completed routes do not poll independently.

`GET /api/passenger-monitoring/trips/{id}/tracking-summary` uses the existing
PassengerMonitoring policy and current-account checks, then reuses TripTrackingService
and TripTrackingCalculator. Points belong to the selected boat's configured GPS device,
fall within its actual trip lifecycle and are ordered chronologically. Monitoring never
uses UpdatedAtUtc as an arrival time or a current boat position as a historical endpoint.
An inactive trip without a recorded arrival has no safe history window and returns
an empty route. Existing operational tracking retains its default behavior.

Trip participants now return the existing CountryCode field. Small flags precede names
in both SLTDA passenger lists, reusing the existing ISO country list and flag component.
Case, surrounding whitespace and known country names are normalized for display;
missing/invalid countries show a neutral globe. No nationality is inferred from names,
contact data or local/foreign classification. No schema migration is required.

Verification: targeted ESLint and TypeScript passed; production build passed with
existing SignalR annotation and bundle-size warnings. Backend regression suite:
129 passed, 2 browser tests skipped without browser configuration. The new browser
test was then run separately with its prerequisites and passed against a live API
and disposable SQL database. Fixture browser coverage also passed for routes, markers,
timeline, failure/retry/loading, mobile layout, request reuse, country flags and filters.
The local Docker API was rebuilt/restarted, is healthy, and its tracking and participant
endpoints returned HTTP 200. See `scripts/tests/README.md` for reproduction commands.

Limits: historical routes require stored telemetry and an identifiable GPS device;
the current model does not retain device reassignment history. Missing departure,
arrival or country records are displayed as unavailable instead of guessed. Route
endpoints identify first/last recorded GPS samples, which can differ from an unrecorded
physical departure/arrival location. Basemap tiles and flag images use existing providers.
