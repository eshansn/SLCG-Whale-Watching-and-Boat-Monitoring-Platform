# WWMS Support Center

The shared `/support` page uses the existing Deep Ocean typography, colors and
controls. It includes 17 expandable, keyboard-accessible FAQs in five categories
and a contact form with name, email, portal, subject, category and description.
The answers were checked against authentication, owner trip controls, Shore
attendance, crew SOS, Operations tracking and SLTDA recorded-route screens.

## Portal access

`PortalSupportLink` provides a shared support entry for Admin, Boat Owner, Boat
Crew, Operations, Shore Officer, Supervisor, SLTDA, Wildlife, Shore Wildlife,
Harbour Officer and Passenger portals. The existing owner/crew/shore Settings
help controls now open the same page; those pages do not get a duplicate footer
link. The owner's existing account-deletion request action now opens the support
form with its subject/category prepared; it does not delete an account.

The Support Center is public so a locked-out user can read login/reset guidance
and request assistance. Existing portal authentication/role guards are unchanged.
Authenticated users get their email/portal prefilled. Return links accept only
known local portal paths authorized for the current user, with a safe home fallback.
No token or personal message is put into a return URL.

## API and database

`POST /api/support/requests` persists an accepted request and returns HTTP 202 with
its reference. Invalid fields/categories/portals and honeypots return 400, reference
conflicts return 409, the IP limiter returns 429, and storage failures use the
existing safe exception response. The body is limited to 32KB; text fields have
bounded lengths. Control characters are removed and email HTML is encoded by the
existing contact email template. There is no public endpoint exposing saved tickets.

The client prevents duplicate clicks and retains the same submission ID for an
unchanged retry, including when a server response is lost. A primary-key constraint
and payload comparison make concurrent/repeated submissions idempotent. The UI
only confirms success after the backend returns the matching persisted reference.
Network/server failures retain the user's fields.

Migration `20261105100331_AddSupportRequests` adds only the `SupportRequests` table,
its notification indexes and an optional user reference. It does not alter trip,
passenger, booking, authentication or GPS tables. Deleting a user sets its support
request user reference to null rather than removing the request.

## SMTP and notification delivery

The existing `IContactEmailSender` and Gmail/MailKit SMTP configuration are reused.
Support messages have a support subject/reference, include portal, category and
issue details, and use the configured Contact recipient and requester Reply-To.
No new SMTP credentials or email addresses are hardcoded in application source.

Existing configuration keys:

- `Contact__RecipientEmail`
- `PasswordRecovery__Smtp__Host`, `PasswordRecovery__Smtp__Port`
- `PasswordRecovery__Smtp__Username`, `PasswordRecovery__Smtp__AppPassword`
- `PasswordRecovery__Smtp__FromEmail`, `PasswordRecovery__Smtp__FromName`
- `PasswordRecovery__Smtp__TimeoutSeconds`

Support acceptance is database-backed, independent of SMTP availability. A hosted
worker polls the database, leases pending notifications atomically, and retries
failures with exponential backoff capped at six hours. Restarted/expired leases
are recoverable. Requests remain stored when mail cannot be delivered. Notification
attempts/due/sent times are retained; logs omit email content and credentials.
Delivery is at least once: a process crash after SMTP acceptance but before the
sent timestamp is saved can cause a repeated notification with the same reference.

## Verification

- Five real SQL integration tests pass: all roles/public submission, validation and
  spam limits, concurrent idempotent requests, safe database failure, durable SMTP
  retry, lease concurrency/recovery, and applying the actual migration to a fresh DB.
- Chromium and WebKit API/Identity/SQL browser harnesses pass through all eleven portal entry
  and return paths, including the three existing Settings controls. It verifies all
  17 accordions, invalid/missing fields, public access, blocked portal access when
  signed out, network/server failures, duplicate-click prevention and successful
  persisted requests on desktop (1440px) and mobile (375px).
- A lost-response test commits a real request, drops the response and retries;
  the database retains one ticket. Captured notification delivery is checked for
  every request after the browser run. No mock submission success is used.
- Frontend production build, targeted ESLint and backend build pass.

Artifacts and SQL TRX results are under `.runlogs/support-center/`. The test harness
creates/deletes uniquely named disposable databases and never changes a running
portal's operational records. Browser test email delivery is captured rather than
sent to external inboxes.

Run integration tests with `WWMS_TEST_SQL_CONNECTION` set to a SQL connection that
can create/drop disposable databases. Set `WWMS_BROWSER_WEB_ROOT` to the frontend
`dist` folder and `PLAYWRIGHT_MODULE` to the installed Playwright module for the
browser test. Use the installed .NET 8 runtime for tests. Production startup applies
pending migrations through the existing database initialization path.

## Activated local API and SMTP verification

The local API container was rebuilt/restarted after verification. Startup applied
only `20261105100331_AddSupportRequests`. The SQL container was not recreated.
Before/after counts remain 31 users, 10 trips, 10 boats and 54 passengers.

A single clearly labelled live verification request was submitted through the real
frontend/API. It remains stored with reference
`980e2013-430f-4e91-bf8b-34cac32a9a92`. The configured Gmail SMTP server accepted
its support notification on the first attempt; the persisted sent timestamp is
`2026-11-05T10:31:17.0627922Z`. This verifies SMTP acceptance, not an inbox read.
Live layouts were checked at 320, 768 and 1440px. No remaining functional blockers
were found. The at-least-once email caveat above remains an intentional delivery
tradeoff; database acceptance never depends on SMTP succeeding.
