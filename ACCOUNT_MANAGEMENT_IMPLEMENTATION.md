# WWMS account management and profile consistency

Implemented 2026-11-05. Existing unrelated Git changes were preserved.

## Portal behavior

- Owner and Crew settings use the same Delete My Account dialog. The former Owner action only prepared a support request; no self-service deletion API existed.
- Admin and the other authenticated web portals can open Account settings from the existing portal footer. The shared protected route is `/account`, with a safe return link to the originating portal.
- Every self-deletion description is exactly: “Delete your account permanently from the Whale-Watching & Boat Monitoring System.”
- The destructive button remains disabled unless the input is exactly `confirm`, including case and whitespace. The submit handler checks again and prevents concurrent submissions. The dialog includes a permanent-action warning, retention explanation, loading state, retryable errors, Cancel/Escape handling, native focus containment, and a sign-out success notice.
- Admin Owner/Crew view and edit labels and the boat report now say **Bio**. The frontend `address` property and API `Address` request property still map to `ApplicationUser.Bio`. Existing profile data is preserved.

## Backend and retention

`DELETE /api/auth/account` is the single self-deletion endpoint. It uses existing bearer authentication and rate limiting, obtains the account ID exclusively from the authenticated principal, rejects unknown JSON properties such as `userId`, and validates `confirm` with ordinal case-sensitive comparison. Invalid confirmation returns 400; anonymous or revoked sessions return 401; operational restrictions return 409.

Deletion runs in a retryable serializable transaction. It removes credentials, role memberships, claims, external sign-ins and Identity tokens; revokes refresh tokens; rotates security/concurrency stamps; cancels outstanding password recovery; and permanently records `AccountDeletedAtUtc`. Access-token validation, refresh, login, and recovery reject deleted accounts. Existing realtime connections for that account are aborted after commit; other accounts' connections remain open. The connection registry covers the current single API process; a future multi-instance deployment would need distributed connection revocation.

The identity row and its required identity/profile references remain for restrictive foreign keys and historical accountability. This permanently removes account access; it does not physically erase historical identity information. The email/NIC identity remains reserved. Trip, passenger, complaint, safety, and audit records are retained. This follows existing Admin role archival behavior. Owner/Crew relationship cleanup is shared with existing administrative removal through `AccountRetention`.

Existing active-boat ownership and ongoing-trip crew restrictions remain. Deleting the last active administrator is blocked to retain administrative access. These conflicts are displayed in the dialog; the user can cancel and arrange reassignment through existing workflows.

Migration `20261105104946_AddPermanentAccountDeletion` adds one nullable timestamp column to `AspNetUsers`. It does not rewrite profile fields, seed accounts, reset passwords, or delete operational records. Normal API startup applies pending EF migrations.

## Changed files

- Shared UI: `apps/web/src/account/AccountSettings.tsx`, `DeleteAccountDialog.tsx`.
- Integration: `App.tsx`, `auth/authApi.ts`, `support/PortalSupportLink.tsx`, Owner/Crew settings, and public `Login.tsx` for the success notice.
- Labels: Admin `OwnerDetailsPage.tsx`, `CrewDetailsPage.tsx`, and `components/BoatReportModal.tsx`.
- API: `AuthController`, `AccountDeletionService`, `AccountRetention`, `AccountSessionRegistry`, `AccessTokenSecurity`, `AuthService`, `JwtTokenService`, recovery eligibility, `OperationsHub`, `ApplicationUser`, DI registration, and the additive EF migration/snapshot.
- Verification: `server.Tests/AccountDeletionTests.cs`, shared harness additions in `ComplaintAccountabilityTests.cs`, and `scripts/tests/account-management.cjs`.

## Verification

- Backend build: passes with zero warnings/errors. Web production build and ESLint for affected files: pass. Existing Vite dependency annotation and bundle-size warnings remain.
- Five isolated SQL tests cover invalid confirmation variants, unknown target IDs, all 11 authenticated roles, modern and legacy access tokens, refresh/login revocation, last-Admin/active-boat/ongoing-trip conflicts, historical crew retention, transactional failure rollback, concurrent retries, additive migrations, and unchanged Bio data mapping.
- Backend regression suite: **183 passed, zero failed or skipped**, including authentication, password recovery, operational, support, and profile coverage.
- Edge browser test: passes with real API login/deletion for all 11 roles. Admin/Owner/Crew tested at 1440px and 375px, including validation, duplicate prevention, network/server errors, success/sign-out, protected-route denial, Bio edit persistence, and realtime connection revocation.
- WebKit browser test: the same complete account-management scenario passes, including desktop and mobile layouts for Admin, Owner, and Crew.
- Browser screenshots, test results, and build output are under `.runlogs/account-management/`.
- All successful deletion testing uses disposable SQL databases and fixture accounts. No existing WWMS account is deleted for verification.

## Local activation

The local API was rebuilt and restarted after verification; it is running healthy and the new migration is applied. Before/after checks preserved **31 users, 23 role memberships, 10 trips, 10 boats, 54 passenger profiles, and 1 support request**. Deleted-account count remains zero in the existing WWMS database. Runtime evidence is in `.runlogs/account-management/runtime-before.json` and `runtime-after.json`.
