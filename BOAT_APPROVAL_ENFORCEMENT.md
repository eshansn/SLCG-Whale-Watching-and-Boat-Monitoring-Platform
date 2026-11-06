# Boat approval enforcement for trips

Implemented 6 November 2026. No schema migration, approval field, approval-role change, historical-data rewrite, or database cleanup is introduced. Existing unrelated Git changes were preserved.

## Existing policy retained

The application's boat details explicitly state that **approval from either Admin or Wildlife is sufficient**. Both independent stored fields remain in use; this implementation does not change that policy to require both authorities. A boat is eligible when it is not soft-deleted, both stored values are recognized, and at least one authority has approved it.

| Database approval state | Trip eligibility |
|---|---|
| Admin Approved; Wildlife Pending/Rejected/Approved | Allowed |
| Wildlife Approved; Admin Pending/Rejected/Approved | Allowed |
| Neither authority Approved | Blocked |
| Soft-deleted boat | Blocked |
| Unsupported/unknown stored value in either approval field | Blocked |

The current enum contains Pending, Approved and Rejected, with no native Suspended field/action. No fictional suspension workflow was added. Unknown numeric values, including a future suspension value, fail closed even if the other authority field is Approved. Revoking the boat's only valid approval blocks further scheduling/departure. If another authority's approval remains valid, the existing either-authority policy continues to apply.

## Server enforcement

`server/Operations/BoatTripApproval.cs` supplies one reusable predicate for database filtering and loaded boat validation. Checks use current database values; client-provided approval flags are ignored.

The shared policy applies to:

- `POST /api/operations/trips`: Owner scheduling, including default or explicitly selected crew.
- `PATCH /api/operations/trips/{id}/reschedule` and `PUT /api/operations/trips/{id}/crew`: prevent alternate preparation routes from bypassing eligibility.
- `POST /api/operations/trips/{id}/start`: rechecks approval at actual departure, including Admin and reschedule-override requests.
- `POST /api/operations/patrol-trips/start`: OPS patrol creation/departure.
- `PATCH /api/operations/trips/{id}/status`: checks activating patrol transitions; tourist trips still must use the dedicated lifecycle actions.
- Transfer destination search, destination trip selection and final transfer submission: all use the same approval policy. A Wildlife-only approved boat now appears consistently as Approved in these results.

Approval reads and writes to trip/crew/schedule state occur inside retryable serializable transactions. This prevents an approval change from slipping between validation and commit. Tracked state is cleared on transaction retries. The database remains the authority even when the browser displays stale boat data.

HTTP 409 is returned for an approval conflict. Owner scheduling receives exactly:

> Your boat has not yet been approved by the relevant authorities. You must receive official approval before scheduling trips.

Departure receives:

> This boat does not currently have valid official approval from the relevant authorities. The trip cannot start until approval is granted.

Existing authentication, ownership checks, authority permissions, passenger-finalization, capacity, crew availability and coxswain checks remain. Cancellation, ending an ongoing trip, and reading historical records remain available. Transferring passengers away from an unapproved source to an approved destination remains available as a recovery operation.

## Portal behavior

- Owner scheduling displays only eligible, non-patrol boats. Submission is disabled without an eligible selection; a cached/revoked selection is checked again before submission. Missing approval displays the requested message in the existing status area.
- Shore Trip Departure disables Start Trip and displays the approval warning when the boat lacks current approval. The API independently rechecks it at departure.
- OPS patrol selection excludes unapproved vessels and distinguishes missing approval from an already-active patrol.
- Existing page layouts, colors, approval controls, routes and request/response contracts remain. No mobile code or extra dependency was introduced; existing mobile/API clients receive the same backend enforcement.

## Existing scheduled trip identified

The read-only local database audit identified one awaiting-departure trip with neither authority approval:

| Trip ID | Boat | Status | Admin / Wildlife |
|---|---|---|---|
| D1F29FDC-C6C4-4F52-B9D9-C471CEF24AED | HUHUHEUIHDW | Scheduled | Pending / Pending |

The trip and its data remain intact. It becomes departure-eligible only after valid official approval, along with the pre-existing departure requirements. Audit evidence: `.runlogs/boat-approval/live-inspection.json` and the activation before/after snapshots. This is a point-in-time inventory; approval changes through normal workflows can change eligibility later.

## Verification

- API/test project build: passed with zero warnings/errors. Production web build and ESLint for affected files: passed.
- Edge final run: **204 passed, zero failures/skips**, comprising 201 non-browser backend checks plus the new approval browser scenario and existing Shore summary/QR browser regressions.
- WebKit: the new Owner/Shore/OPS approval browser scenario passed.
- Tests cover approved, pending, rejected, unknown/suspension-like values, soft-deleted eligibility, both individual authority approvals, approvals granted after rejection, approval revoked after scheduling, fabricated client approval fields, default/explicit crew, rescheduling/crew changes, patrol/status bypass routes, and concurrent revocation.
- Transfer tests verify Wildlife-only approval in selection/results, denied transfer after revocation, unchanged passenger records on failure, and recovery from an unapproved source to an approved destination.
- Browser tests verify approved-only dropdowns, the exact Owner message, a genuine accepted scheduling request, rejection with a deliberately stale frontend approval response, direct API rejection, live revocation/reapproval, disabled Shore departure for legacy trips and OPS patrol restrictions. Owner layouts checked at 375px and 1440px.
- Rejected operations leave trip counts, departure timestamps and historical records unchanged. Successful deletion/cleanup of existing WWMS records is never used for testing; all test mutations run in disposable SQL databases.
- The existing shared test boat fixture is now explicitly Approved because its scheduled trips represent approved operational use; approval-negative tests set their own current database states.

Artifacts: `.runlogs/boat-approval/` and `.runlogs/boat-approval-web-build.log`.

## Local activation

The tested local API image was rebuilt and restarted; the existing SQL container and volume were retained. The API is running healthy, readiness returns 200, unauthenticated operations access returns 401, and the local frontend serves the new approval module. No database migration was required.

Before/after read-only verification preserved **32 users, 14 trips, 56 passenger profiles and 1 completed trip**. The identified pending-approval trip's status, schedule and approval values are unchanged. Boat count was 13 before activation and 14 afterward during live use. This task issued no live boat creation, reseeding or cleanup; the count change is recorded without attributing it to a specific actor. See `.runlogs/boat-approval/activation-verification.json` and the raw before/after snapshots.
