# WWMS email OTP password recovery

The shared `/login` page now links to `/forgot-password`. The flow is account email → six-digit email code → new password → return to login. It uses the existing ASP.NET Core Identity users, password validators, hashing and token provider. It does not sign users in automatically or change their email, roles, lockout state or portal permissions.

## Account and portal compatibility

All 11 Identity roles use the shared login and recovery endpoints: Admin, SLTDA, OPS, ShoreCrew, Wildlife, ShoreWildlife, Supervisor, HarbourOfficer, BoatOwner, BoatCrew and Passenger. Existing accounts need no password conversion. A confirmed, valid registered email, a password hash and a security stamp are required. Unknown, missing-email, invalid-email and unconfirmed accounts receive the same generic initiation response, but no email. Locked accounts can change a password without clearing their existing lockout.

Trip passengers using a QR invitation/session are a separate existing passwordless flow. A `PassengerProfile` without an Identity account does not acquire a password or receive account recovery through this feature. Existing QR/passenger session permissions remain unchanged.

## Files

| Area | Files |
| --- | --- |
| API, validation, limits, transactional recovery | `server/Auth/Recovery/PasswordRecoveryController.cs`, `PasswordRecoveryService.cs`, `RecoverySecrets.cs` |
| Gmail delivery, email presentation, durable SQL outbox, cleanup, DI | `server/Auth/Recovery/RecoveryEmailSender.cs`, `RecoveryEmailTemplate.cs`, `PasswordRecoveryWorker.cs`, `PasswordRecoveryOptions.cs`, `RecoveryRegistration.cs` |
| Identity session validation | `server/Auth/AccessTokenSecurity.cs`, updated `JwtTokenService.cs` and `Program.cs` |
| Data model | `server/Domain/PasswordRecovery.cs`, updated `ApplicationUser.cs`, `server/Data/PasswordRecoveryModelConfiguration.cs`, updated `WhaleWatchingDbContext.cs` |
| Migration | `server/Migrations/20261029102800_AddPasswordRecovery.cs`, its designer, model snapshot |
| Frontend | `apps/web/src/screens/publicweb/PasswordRecovery.tsx`, shared `components/auth/OceanAuthLayout.tsx`, `OceanScene.tsx`, `ocean-auth.css` and form components, recovery-only `recovery/RecoveryOtpInput.tsx`, `apps/web/src/auth/passwordRecoveryApi.ts`, updated `Login.tsx` and `App.tsx` |
| Languages | Existing passenger dictionaries and selectors remain intact; recovery is English-only |
| Dependencies/configuration | MailKit 4.17.0 in `server/WhaleWatching.Api.csproj`; `.env.example`, `docker-compose.yml` |
| Verification | `server.Tests/PasswordRecoveryTests.cs`, `RecoveryEmailTemplateTests.cs`, `scripts/tests/password-recovery.cjs`, `scripts/tests/README.md` |
| Local SMTP diagnostics | `scripts/check-recovery-smtp.cjs` (reads the ignored `.env`; never sends mail or prints credentials) |

The recovery page is English-only and has no language selector, icon, dropdown or language preference handling at any step. Existing passenger dictionaries, language controls and saved preferences remain available to the passenger portal without modification by recovery. Login routing, role checks, existing authentication storage and the passenger language provider retain their existing structure.

## Deep-ocean presentation update — 2026-10-30

The same environment and form components now also serve Login and Sign Up through a persistent nested route layout. See [AUTHENTICATION_UI_IMPLEMENTATION.md](AUTHENTICATION_UI_IMPLEMENTATION.md) for the shared component inventory and login/registration checks.

All recovery steps share the same scoped deep-ocean layout: abyss/navy layers, restrained light beams and drifting particles, a custom SVG whale with a one-time line drawing and gentle floating motion, a small Coast Guard/WWMS brand header, and a translucent form panel. The whale remains mounted between steps. CSS handles decoration without JavaScript animation loops or new dependencies. Reduced-motion preferences disable decorative animation and preserve the fully drawn whale.

Forgot Password, OTP verification/resend, Reset Password and Success are English-only at every viewport. Recovery does not import locale helpers or read/write saved language choices. No other portal selector or localization resource was removed. The language-control space was replaced by the recovery header/progress treatment, not an empty placeholder.

The six-digit entry supports numeric keyboards, individual labels, focus advancement, arrows/Home/End, backspace, full-code paste and first-field one-time-code autofill. Password guidance reflects the existing 12–128-character frontend bound and Identity complexity/uniqueness requirements; it does not replace server validation. Show/hide controls, loading states, inline feedback and server-confirmed completion use the same panel styling. A resend countdown restarts only after successful acceptance; failed requests keep actionable error feedback and all backend limits remain authoritative.

The matching backend email template uses the subject `WWMS | Your Ocean Access Verification Code`, inline navy/cyan styles, responsive presentation tables, the existing generated code, the actual UTC expiry and the existing ten-minute lifetime. It includes a plain-text alternative, ignore/share warnings and no external images, scripts, fonts or invented verification links. The sender, registered-recipient selection, MailKit/Gmail transport, APIs, authorization, OTP/reset lifetimes, rate limits, database and session controls retain their existing behavior. No new migration is required for this presentation update.

## API

All endpoints are anonymous POSTs under `/api/auth`, accept JSON, limit bodies to 4 KiB and return `Cache-Control: no-store`. They also inherit the existing authentication endpoint limiter. Use HTTPS for every production request, including frontend-to-API traffic.

| Endpoint | Request fields | Success |
| --- | --- | --- |
| `/forgot-password` | `email` | 202: `recoveryId`, `expiresInSeconds: 600`, `resendAfterSeconds`, generic message |
| `/resend-reset-otp` | `recoveryId` | Same 202 shape; replaces the current code |
| `/verify-reset-otp` | `recoveryId`, `code` (six ASCII digits) | 200: `resetAuthorization`, `expiresInSeconds: 300` |
| `/reset-password` | `recoveryId`, `resetAuthorization`, `newPassword`, `confirmPassword` | 200: success message |

Only `email` identifies an account at initiation. Delivery always uses `ApplicationUser.Email` loaded from the database, checked again immediately before SMTP. Subsequent calls derive the account exclusively from the server transaction. Extra user IDs, roles or destination-email fields grant no authority. The opaque authorization is separate from the OTP and is only returned once after successful verification.

Invalid/expired/replayed transactions return generic 400 responses. Password policy errors or mismatched confirmation also return 400 without consuming a valid authorization. Limits return 429 with `Retry-After: 60`; account limits may require longer than that before another request is accepted. Disabled recovery or processing/storage failure returns generic 503. No API response contains a code, hash, SMTP secret, recipient account metadata or provider exception.

## Security and persistence

- OTPs use `RandomNumberGenerator.GetInt32(1_000_000)` formatted to exactly six decimal digits, including leading zeros. They expire after 10 minutes.
- OTP verification uses HMAC-SHA256 with a separate server secret, bound to user ID, transaction ID and code version. Comparisons use constant-time operations. Successful verification consumes the code, so it cannot issue another authorization.
- Five incorrect attempts cancel the transaction; resending cannot reset that attempt counter. Resend also preserves the counter before the fifth attempt. A replacement never repeats the immediately preceding numeric code.
- Reset authorizations contain 32 random bytes, encoded as 43-character base64url strings, expire after five minutes and are stored only as transaction/user-bound HMACs.
- An account-state HMAC binds recovery to the registered email, confirmation state and Identity security stamp. Changing any of those invalidates outstanding recovery.
- SQL transaction-owned `sp_getapplock` locks serialize account operations across API instances. Password reset through `UserManager.ResetPasswordAsync`, authorization consumption, other-recovery invalidation and refresh-token revocation commit in one SQL transaction. Failed password changes and failed final saves roll back without consuming authorization.
- Identity's existing policy remains authoritative: at least 12 characters, 6 unique characters, uppercase, lowercase, digit and symbol. Recovery inputs have a 128-character maximum. Passwords use Identity hashing, not a new hashing scheme.
- New access JWTs carry a hash of the Identity security stamp. Bearer validation compares it with the current user on each authenticated HTTP request. Password reset rotates that stamp, rejects old access tokens and explicitly revokes all refresh tokens. Legacy access tokens without a stamp remain usable until expiry unless their account has used recovery; then those legacy tokens are rejected too. Login after recovery issues a valid stamped token.
- SignalR authenticates on connection/reconnection. Its established connections close at JWT expiry (at most the configured access-token lifetime, capped at 15 minutes); password recovery does not immediately disconnect an already established WebSocket. No hub mutation methods were added. Treat that bounded window as an operational limitation if immediate realtime disconnection is required.
- Client recovery identifiers, OTPs, passwords and authorizations remain in React memory. Cancellation, completion or leaving the page clears the flow; nothing sensitive is put in local/session storage or URLs. Completion clears existing client authentication state and returns to login without automatic sign-in. Recovery neither reads nor writes portal language preferences.

### Shared limits

| Control | Default | ASP.NET configuration key |
| --- | --- | --- |
| Incorrect OTP attempts | 5 per transaction, retained across resends | Fixed security ceiling |
| OTP expiration | 10 minutes | Fixed |
| Reset authorization expiration | 5 minutes | Fixed |
| Minimum time between accepted sends/new requests | 60 seconds per normalized account email | `PasswordRecovery:ResendSeconds` (minimum 60) |
| Code sends, including first send | 3 per account in 15 minutes | `PasswordRecovery:SendsPer15Minutes` |
| Accepted new recovery requests | 5 per account in one hour | `PasswordRecovery:RequestsPerHour` |
| Combined recovery endpoint requests | 30 per IP per UTC minute | `PasswordRecovery:RequestsPerIpPerMinute` |

Account keys and IP window identifiers are HMACs, including decoy/unknown accounts. These counters live in SQL Server and cannot be bypassed by moving to another instance using the same database/key. The existing process-local `auth` limiter additionally allows 10 requests/minute/IP. A fixed IP window allows a boundary burst; account/code limits still apply.

Only the existing forwarded-header configuration supplies client IPs. Configure exact trusted reverse-proxy IPs and hop counts; do not trust arbitrary `X-Forwarded-For` headers or clear the known-proxy list. A proxy chain configured incorrectly can group users behind one IP or weaken IP limits. Every replica must have synchronized UTC time and identical recovery settings, secrets and database access.

### Email processing and cleanup

There was no email queue in this repository. Recovery uses the existing SQL Server and ASP.NET `BackgroundService` pattern, with no external broker or scheduler. A transaction atomically records recovery and an encrypted outbox payload. HTTP 202 means **accepted for processing**, never “delivered.” Unknown/unconfirmed requests create matching decoy records without sending mail; minimum public handler duration is 250 ms and SMTP latency is outside the request path. This reduces unnecessary enumeration signals; it is not a claim of perfect timing equivalence under all database loads.

The worker polls every three seconds, leases up to ten due records, rechecks account state/version, decrypts the code and sends to the current stored email only. A 90-second lease prevents simultaneous workers from normally sending the same record; Gmail has a 20-second total timeout by default (`PasswordRecovery:Smtp:TimeoutSeconds`, range 5–30). SMTP always uses `SecureSocketOptions.StartTls` on Gmail port 587, standard certificate validation and authenticated App Password credentials. There is no insecure fallback or protocol logger.

Failed sends retry at one and two minutes, at most three attempts while the code is still usable. Ciphertext is cleared on completion, permanent failure, replacement, verification, cancellation or expiry. Expired recovery/outbox and IP-window metadata older than one day are deleted by the worker. If recovery is disabled, the worker does not run; cleanup resumes when reenabled. Already expired records never regain validity.

Like SMTP generally, delivery is at least once: a process crash after Gmail accepts a message and before the delivery record is updated can result in the same code being emailed again. A message already in flight when replaced can arrive late; only the current code can verify. SMTP acceptance is not an inbox-delivery guarantee. Monitor sanitized warning counts and pending/failed delivery metadata; do not log recipient addresses, payloads, protocol traffic, request bodies, passwords or secrets. Production database sensitive-data logging must stay disabled. No public delivery-status endpoint reveals account eligibility.

## Gmail configuration and deployment

Recovery is **disabled by default**, so existing deployments start without Gmail credentials. Requests return a generic unavailable message until it is configured and enabled. No real credentials or `.env` contents were added to source control.

Use an authorized sending account with Google Two-Step Verification and an App Password. Availability depends on account/organization policy; do not substitute the normal Google account password. Google documents restrictions and password-change revocation in [Sign in with App Passwords](https://support.google.com/accounts/answer/185833). MailKit documents mandatory upgrade behavior in [SecureSocketOptions](https://mimekit.net/docs/html/T_MailKit_Security_SecureSocketOptions.htm). The design follows the [OWASP forgot-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Compose reads these `.env` variables and maps them into the ASP.NET section:

| Compose `.env` variable | ASP.NET environment variable | Value |
| --- | --- | --- |
| `PASSWORD_RECOVERY_ENABLED` | `PasswordRecovery__Enabled` | `true` after configuration |
| `PASSWORD_RECOVERY_HASH_KEY` | `PasswordRecovery__HashKey` | Stable, cryptographically random base64 secret of at least 32 bytes |
| `SMTP_HOST` | `PasswordRecovery__Smtp__Host` | `smtp.gmail.com` |
| `SMTP_PORT` | `PasswordRecovery__Smtp__Port` | `587` |
| `SMTP_USERNAME` | `PasswordRecovery__Smtp__Username` | Authorized Gmail account |
| `SMTP_APP_PASSWORD` | `PasswordRecovery__Smtp__AppPassword` | Authorized 16-character Google App Password; display spaces are stripped |
| `SMTP_FROM_EMAIL` | `PasswordRecovery__Smtp__FromEmail` | Sending account or its authorized sending alias |
| `SMTP_FROM_NAME` | `PasswordRecovery__Smtp__FromName` | `WWMS Account Security` |

Generate the HMAC key with `openssl rand -base64 32` or an approved secret manager. Keep it separate from SQL Server and do not reuse the JWT key or App Password. All replicas must use the same stable value. Rotating it intentionally invalidates outstanding recovery and resets hashed rate-limit identities; coordinate rotation during maintenance.

When running `dotnet` directly, use the right-hand environment names above or `dotnet user-secrets` with colon-separated keys, such as `PasswordRecovery:Smtp:AppPassword`. ASP.NET does not read the repository `.env` automatically. These values must never use a `VITE_` prefix.

Enabled configuration is validated at application startup: base64 key size, Gmail host/port, addresses, App Password length, timeout and limit ranges. Invalid enabled configuration fails startup. Validation checks shape, not live Gmail credentials or account authorization. Gmail connectivity and mailbox delivery require a controlled deployment smoke test.

To check the configured Gmail connection without sending email, run `node scripts/check-recovery-smtp.cjs`. It reads the local ignored `.env`, requires STARTTLS with normal certificate validation, authenticates, then disconnects. Output contains only success or a sanitized failure stage/status. Credentials are never passed through command-line arguments. This check does not replace an authorized recovery delivery test against a confirmed account.

1. Back up the existing SQL database and use the established migration process. With the intended `ConnectionStrings__SqlServer` configured, run:

   ```powershell
   dotnet ef database update --project server/WhaleWatching.Api.csproj
   ```

   Normal API startup also applies migrations before starting endpoints and workers. The additive migration creates `PasswordRecoveries`, `PasswordRecoveryDeliveries`, `PasswordRecoveryRateWindows` and nullable `AspNetUsers.PasswordResetAtUtc`, with indexes and foreign keys. It does not rewrite passwords or roles. It was tested both against an existing Identity schema and on repeated application.

2. Set the Gmail/key settings server-side. Protect and persist the Data Protection key ring outside the database, with access restricted to the API identity. Compose already mounts `api-data-protection` at `/home/app/.aspnet/DataProtection-Keys`; preserve that volume across restarts. Every API replica must share the key ring and the stable `WWMS` application name. For production, use an approved encryption-at-rest mechanism for the key ring and backups. Losing the key ring makes queued mail unreadable; affected users can submit new requests.

3. Rebuild/restart the backend and build/deploy the frontend through the existing process. For the local Compose API:

   ```powershell
   docker compose up -d --build --no-deps api
   ```

   Do not leave older API replicas serving traffic after enabling recovery: older code cannot enforce the new JWT stamp checks or shared recovery flow. Single-instance startup migration is the existing local pattern; use a dedicated migration step for multi-instance deployment.

4. Terminate public TLS at the trusted proxy, keep frontend/API traffic on HTTPS, configure exact allowed origins and trusted proxy addresses, allow outbound `smtp.gmail.com:587`, and verify `/health/ready`. Confirm backups cover the database and protected key ring.

5. Perform the manual smoke tests below with an authorized test mailbox before enabling recovery for users. Seed/demo addresses such as `@wwms.test` are not deliverable mailboxes. Confirmed existing accounts must have their actual registered emails managed through existing account administration; recovery cannot change them.

## Automated verification

`PasswordRecoveryTests.cs` uses the existing xUnit framework, disposable GUID-named SQL databases, real Identity services, live HTTP and a mock email sender. It never contacts Gmail or sends real email. The browser test alone maps a test-only fake inbox and clock controls on its isolated loopback host; these endpoints are absent from production `Program.cs`.

Coverage includes correct/wrong/expired/replayed OTPs; leading-zero formatting and context-bound protected values; five-attempt cancellation; resend cooldown, old-code replacement and fifteen-minute limits; hourly and shared SQL/IP limits; concurrent verification/reset; cross-account and tampered reset grants; wrong server key; weak/mismatched password retry; failed-save rollback; old/new password login; all 11 roles and forbidden cross-role access; old refresh/stamped/legacy access revocation; account email/confirmation/stamp changes; missing or invalid stored email; preserved lockout; generic public responses; stored-email-only delivery; SMTP retry/failure; leases; ciphertext tampering; cleanup; malformed/oversized requests; disabled configuration; and Identity migration compatibility/model consistency.

Example PowerShell commands (SQL test credentials/connection are environment-specific):

```powershell
$env:WWMS_TEST_SQL_CONNECTION='Server=.\SQLEXPRESS;Database=master;Integrated Security=True;TrustServerCertificate=True'
dotnet test server.Tests/WhaleWatching.Api.Tests.csproj
```

For live browser tests, build the frontend, set `WWMS_BROWSER_WEB_ROOT` to the absolute `apps/web/dist` directory and `PLAYWRIGHT_MODULE` to an installed Playwright module path. Chromium uses installed Edge; `PLAYWRIGHT_ENGINE=webkit` selects installed WebKit:

```powershell
dotnet test server.Tests/WhaleWatching.Api.Tests.csproj --filter FullyQualifiedName~PasswordRecoveryTests.Browser_LivePasswordRecovery
```

Browser checks cover the real API/SQL recovery flow, mock email, invalid code, backend cooldown, resend and resend failure, six-box numeric entry/paste/backspace, password confirmation, show/hide, successful reset, no automatic login, browser state cleanup, new-password login, role boundaries, cancellation, code expiration, English-only recovery with each existing passenger language preference preserved, reduced motion, network errors and horizontal layout at 320, 360, 375, 390, 430, 768, 1024 and 1440 pixels. The actual email template is previewed with a synthetic code without sending mail. Desktop WebKit is not a physical iPhone or iPad test, and browser HTML previews do not replace Gmail client rendering checks.

Validation results are stored in `.runlogs/recovery-test-results/`:

- Complete backend suite with SQL enabled after the ocean update: **149 passed, 0 failed, 4 browser tests skipped**. This includes the two email-template checks. Recovery browser checks were run separately below; the other three browser skips belong to existing complaint, SLTDA and shore suites.
- Live recovery browser test: **1 passed in Chromium and 1 passed in WebKit**, using mock SMTP and isolated SQL/Identity services.
- Recovery-specific TypeScript/ESLint checks and frontend production build: **passed**. Email-template tests check generated leading-zero code preservation, UTC expiry, ten-minute wording, HTML encoding and absence of external assets/scripts.
- Migration upgrade/reapplication tests, EF pending-model check and `git diff --check`: **passed**.
- Authorized local deployment smoke test on 2026-10-29: database backup/checksum verification succeeded; the recovery migration and all three tables were verified; `/health/ready` returned 200; Gmail STARTTLS authentication succeeded; recovery was enabled; an existing confirmed account's recovery request returned 202; the worker recorded SMTP acceptance on the first attempt and cleared the encrypted delivery payload. No password was changed. Inbox receipt still requires the recipient to check their mailbox.
- Full-repository lint: **11 preexisting errors and one warning** in ColorBends, Navbar, button, AdminRecordsContext and BoatOwner files; recovery adds no lint violations. Vite retains existing SignalR annotation and bundle-size warnings.

## Manual smoke tests

1. Configure an authorized Gmail sender and a confirmed WWMS test account with a mailbox you control. Start the API with recovery enabled and open Login → Forgot password on mobile and desktop.
2. Enter that account's email. Confirm the generic processing message and that the branded six-digit code arrives only at the account's stored address. Check expiry and ignore/share warnings. Repeat with an unknown or unconfirmed email: public responses must look the same, and no mail should be sent there.
3. Try a wrong code, then the correct code. Resending before 60 seconds must be blocked even through a direct API call. Resend after the cooldown; the old code must fail. Five wrong attempts must require a new request.
4. Verify a fresh code, submit mismatched/weak passwords, then a valid password. Confirm failures do not spend the reset authorization, success returns to login, the old password fails, the new password succeeds, and the original role retains only its existing portal permissions.
5. Use a pre-reset access/refresh token against the API and confirm rejection. Replaying the OTP or authorization must fail. Waiting 10 minutes before OTP verification or five minutes after verification must require a fresh valid step.
6. Test keyboard-only navigation, browser Back/refresh, cancellation, password visibility and narrow screens. Recovery must stay English-only with no language controls even when a non-English passenger preference is saved; that preference must remain unchanged for the passenger portal. Sensitive recovery state must not appear in storage, URLs or logs.
7. In a controlled test deployment, block SMTP or use a deliberately invalid App Password: the API may acknowledge durable processing, but must never claim delivery. Confirm sanitized warnings, bounded retries and expired-payload cleanup. Restore valid credentials and verify a new request arrives.

The local deployment is configured and enabled, and its authorized SMTP/recovery delivery smoke test passed as described above. Other deployments still require their own authorized Gmail credentials, stable shared secrets/key storage, migrations and delivery checks. Automated test suites continue to use fake SMTP; the separate local live check confirms SMTP acceptance, not inbox receipt.
