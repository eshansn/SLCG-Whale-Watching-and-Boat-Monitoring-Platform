# Mandatory crew certificates

Crew registration and officer approval now require at least one available, structurally valid certificate belonging to that crew account. The existing system has a general certificate collection, with no separate certificate types or manual verification state; this change keeps that model.

## Cause and behavior

Previously, `UpdateCrewApproval` set `ApplicationUser.IsCrewCertified` without looking at `CrewCertificates`. Public registration did not collect a certificate. Profile uploads checked only a short file signature, and development seeding could automatically grant or restore approval.

Crew registration now sends a multipart request to the existing `/api/auth/register` URL. The service validates the actual upload before creating the account, then commits the account, role, and associated certificate in one SQL transaction. Storage failure rolls back the account. Boat owner registration retains the JSON contract and does not require a crew certificate. Explicit body/form binding keeps the two contracts independent. JSON crew requests, filenames, booleans, and fabricated document IDs cannot substitute for an upload.

Every approval and repeated approval checks the real crew account, existing Admin/Wildlife authorization, associated certificate records, available bytes, size, permitted MIME type, and file structure. Rejection stays available without a certificate. Failed checks return an explanatory HTTP 409 without changing approval. A serializable transaction and an update lock serialize approval requests for the same account; existing operations-change notifications run after commit. Startup seed data no longer grants crew approval.

## Validation and private storage

- Existing accepted formats remain PDF, JPEG, PNG, and WebP, with the existing 5 MB file limit. Multipart requests allow 6 MB including form overhead.
- Both registration and profile upload share the server validator. It checks the extension/MIME combination, actual bounded stream length, empty files, and file structure. Approval and staff status independently inspect the stored content again.
- PDF checks include its header, root/catalog structure, cross-reference location, and final EOF marker. Image checks include PNG chunk boundaries/checksums, JPEG frame/scan markers, and WebP RIFF/chunk boundaries. These checks catch mismatches and common corruption; they do not establish that a certificate is authentic. Officers still inspect/download the document before approving.
- Existing `CrewCertificate` rows hold private SQL bytes under generated GUID keys. The original filename is display/download metadata only; it is stripped to a basename, bounded, and checked for control characters. It never becomes a storage path. No disk filenames or new document fields are necessary.
- Crew downloads require the current crew account to own the document. Admin and Wildlife officers, already permitted to approve crew, can inspect the same private certificates. Other portal roles have no staff certificate access. Downloads use attachment responses, `nosniff`, and `no-store`; certificate content is never returned in crew-list status responses.

## Frontend

Crew signup includes a required certificate field, format/size/content-signature validation, inline errors, and an explanation that a certificate is required for approval. The selected file survives registration steps. Text input events capture their values before scheduling state updates, preventing WebKit from losing a password during entry. Existing crew can upload/re-upload through their profile, with the same client validation and clear server errors. File selection is cleared only after the asynchronous attempt finishes, including on WebKit.

Staff lists/details show Missing, Unavailable, Invalid, or Available status derived from server checks. Approval is disabled with an explanation until a valid certificate is available, including when records cannot be refreshed. Decline and private downloads remain available. The staff list has an “approved crew requiring certificate review” filter. Admin and Wildlife screens use the same status and safeguards. Other approval controls retain their existing behavior.

## Database and existing records

No schema changes or migrations were added for this task. Existing certificate storage, roles, and the `IsCrewCertified` approval flag are reused. Existing approvals, assignments, and active crew accounts are not automatically revoked or modified by the audit.

Read-only audit of the running local `WhaleWatching` database on **2026-10-30 at 06:50 UTC**, using the deployed status validator:

| Finding | Count |
| --- | ---: |
| Crew accounts | 4 |
| Approved crew | 4 |
| Approved with valid, available certificate | 3 |
| Approved with missing certificate | 1 |
| Approved with unavailable or invalid certificate | 0 |

Manual review is required for crew ID **`d0b3f66f-eb21-497d-b346-ded147114492`** (Missing). Authorized staff can identify the account using the review filter, ask the member to upload their actual certificate through their profile, inspect it, and apply the existing approval decision. Existing approval stays in place until an authorized officer explicitly decides otherwise. A reapproval attempt without a certificate is rejected. No fake documents or automatic remediation were created.

Re-run the audit from the repository root with `node scripts/audit-crew-certificates.cjs`. It uses locally configured administrator credentials, prints only counts and affected account IDs, and never prints credentials or certificate contents. Normal authenticated session issuance occurs; crew records are read only.

## Files changed for this task

Backend:

- `server/Profiles/CrewCertificateValidation.cs`: shared upload/stored-content validation and derived staff status.
- `server/Profiles/CrewProfileController.cs`: shared upload validation and private download headers.
- `server/Auth/Dtos/RegisterRequest.cs`, `server/Auth/AuthController.cs`, `server/Auth/AuthService.cs`: multipart crew registration, preserved JSON owner registration, atomic persistence.
- `server/Operations/OperationsController.cs`: certificate enforcement and serialized approval transaction.
- `server/Admin/CrewController.cs`: derived certificate status and private access for existing authorized approvers.
- `server/Data/IdentitySeeder.cs`: remove automatic crew approval.

Frontend:

- `apps/web/src/screens/publicweb/SignUp.tsx`, `apps/web/src/auth/authApi.ts`, `apps/web/src/components/auth/ocean-auth.css`: required upload and multipart request in the existing registration design.
- `apps/web/src/screens/BoatCrew/certificateValidation.ts`, `BoatCrewProfile.tsx`, `crewApi.ts`: shared client validation, upload errors, and file-input handling.
- `apps/web/src/operations/operationsApi.ts`: derived certificate status contract.
- `apps/web/src/screens/Admin/AdminRecordsContext.tsx`, `adminData.ts`, `BoatCrewPage.tsx`, `CrewDetailsPage.tsx`: server status, review filter, and approval safeguards.
- `apps/web/src/screens/Admin/components/ApprovalControls.tsx`, `CrewCertificateNotice.tsx`: optional approval blocking and explanatory status.
- `apps/web/src/screens/Wildlife/WildlifePages.tsx`: equivalent safeguards for the existing alternate crew detail component.

Tests and audit:

- `server.Tests/CrewCertificateTests.cs`, `CrewProfileTests.cs`, `ComplaintAccountabilityTests.cs`.
- `scripts/tests/crew-certificates.cjs`, `scripts/tests/deep-ocean-auth.cjs`, `scripts/audit-crew-certificates.cjs`.

## Verification

Automated SQL integration checks cover missing/valid registration; metadata without bytes; malformed, oversized, empty, and unrelated files; unauthorized/nonexistent/non-crew approval; failed upload; atomic registration rollback; rollback after approval SQL writes; private ownership; simultaneous/repeated approval; and existing approved records requiring review. No real user credentials, certificates, or email delivery are used in those fixtures.

Executed verification:

- Full backend suite: **152 passed, 6 browser tests skipped, 0 failed**. The skipped browser tests require explicit browser configuration; the two affected flows were separately executed below. Result: `.runlogs/crew-test-results/crew-full-suite.trx`.
- Chromium live browser suite: both affected flows (signup/login and crew upload/review/approval) passed. Result: `.runlogs/crew-test-results/crew-browser-chromium.trx`.
- WebKit live browser suite: **2 passed, 0 failed**, covering the same flows. Result: `.runlogs/crew-test-results/crew-browser-webkit.trx`.
- Browser coverage includes mandatory/malformed certificate signup, both registration contracts, all 11 login roles, eight signup viewport widths from 320 to 1920 pixels, all four accepted file formats, upload failure/retry, private PDF download bytes, staff status/disabled approval, legacy review, and live Admin/Wildlife access. Screenshots are in `.runlogs/crew-browser-chromium` and `.runlogs/crew-browser-webkit`.
- Production frontend build and TypeScript build passed. Targeted ESLint and JavaScript syntax checks passed. Build output retains existing dependency annotation/bundle-size warnings.
- Local API rebuilt with the enforcement and registration binding fix; readiness endpoint returned `Healthy`. The final audit confirmed the counts above and did not change any crew approvals.
