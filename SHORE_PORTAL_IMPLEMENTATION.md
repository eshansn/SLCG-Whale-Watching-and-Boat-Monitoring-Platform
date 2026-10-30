# Shore Officer QR scanning and mobile layouts

Implemented 29 October 2026 in the existing React/TypeScript ShoreCrew portal.

## Root causes

- The scanner relied on native BarcodeDetector and had no software decoder when
  that API was missing. Opening a camera alone did not provide cross-browser decoding.
- Its effect depended on an inline callback, so parent renders could restart it.
  A camera permission request could resolve after cleanup without stopping the new
  stream. Overlapping asynchronous detection callbacks could submit the same QR twice.
- Camera errors were reduced to a generic message; there was no QR image fallback.
- Implicit/minimum-width grid tracks allowed wide tables and nested cards to push
  Shore content outside the viewport. Fixed dialog layouts and a shrinking manual QR
  field were difficult to use on narrow screens. Mobile navigation showed icons only.

## Changes

- Added @zxing/browser 0.2.1. PassengerQrScanner lazily loads BrowserQRCodeReader
  for camera frames and uploaded images, without relying on BarcodeDetector.
- Camera access starts only after Scan Passenger QR is pressed. Mobile constraints
  prefer the environment-facing camera without requiring it on desktop.
- Added stop/restart, secure-context and permissions-policy checks, denied/missing/
  busy-camera instructions, and cleanup on decode, stop, close, backgrounding, errors
  and unmount. Late permission results are released. Decoder cleanup errors cannot
  prevent owned media tracks from being stopped.
- Added local QR image decoding (15 MB maximum), manual QR validation and the existing
  authorized passenger search. Image bytes stay in the browser; only decoded QR text
  is sent to the existing verification endpoint.
- Added atomic guards for duplicate decoded frames, concurrent verification and
  repeated save/finalization clicks. Unchanged attendance cannot be resubmitted from
  the confirmation button. Server-returned already-checked/finalized states remain
  visible and authoritative.
- Preserved the existing wwms:passenger:<token> format, scan/group/search/save/finalize
  endpoints, role policies and trip rules. Scanning never marks attendance. Officers
  select attendance and confirm it; success is shown only after a successful save.
- Introduced ShoreDialog, using native modal focus handling and Escape dismissal,
  focus restoration, body scroll locking and a scrollable dynamic-viewport height.
- Added explicit constrained grid tracks, contained table scrolling, readable mobile
  navigation labels, comfortable touch targets, wrapping and safe-area padding.
  Inputs use 16px text on mobile to avoid Safari focus zoom. Existing branding remains.

## Files

- apps/web/src/screens/Shore/components/PassengerQrScanner.tsx — decoder and lifecycle.
- apps/web/src/screens/Shore/components/ShoreDialog.tsx — scanner/confirmation dialogs.
- apps/web/src/screens/Shore/PassengerAttendancePanel.tsx — validation, search, review,
  save guards, authoritative states and responsive manifest/group presentation.
- apps/web/src/screens/Shore/shoreAttendanceApi.ts — optional search cancellation.
- apps/web/src/screens/Shore/shore.css — styles scoped to the Shore portal.
- ShoreDashboard.tsx, ShoreTrips.tsx, ShoreTripInfo.tsx, Shoresettings.tsx and
  components/ShoreNavbar.tsx — mobile layouts, dialogs and navigation.
- apps/web/package.json and package-lock.json — decoder dependency.
- scripts/tests/shore-qr.cjs and server.Tests/ComplaintAccountabilityTests.cs — browser,
  live API/SQL, authorization, trip validation and duplicate-attendance regression tests.

The shared notification screen was inspected and tested through /shore/notifications;
its source and other portals were unchanged. No production backend endpoints, business
logic, permissions, database schema or migrations were changed for this task.

## Verification

- Targeted ESLint for src/screens/Shore: passed. TypeScript build: passed.
- Production npm run build: passed. Existing SignalR annotation and large-bundle
  warnings remain. ZXing is split into a lazily loaded decoder chunk.
- Repository-wide npm run lint: 11 errors and 1 warning in untouched components,
  public Navbar, AdminRecordsContext and BoatOwner screens. No Shore errors remain.
- Backend suite with disposable SQL databases: 130 passed, 3 browser tests skipped
  without browser configuration. Report: .runlogs/shore-test-results/shore-qr.trx.
- The new Browser_LiveShoreQrUploadAndConfirmedAttendance test was run separately
  with its prerequisites in Chromium and WebKit; both passed. It decodes a real QR
  PNG, calls live verification/search/save APIs and confirms persisted attendance
  and one audit entry in a disposable database.
- Fixture browser suites passed in Chromium and Windows WebKit across all five
  Shore pages at 320, 375, 430, 768, 1024 and 1440 pixels. They cover QR PNG decoding,
  invalid QR/image handling, duplicate guards, manual lookup, simulated camera errors,
  unsupported environments, permissions policy and responsive navigation/dialogs.
- Scanner-focused reruns passed at a 320 x 360 keyboard-sized viewport.
- Chromium synthetic camera streams verified rear-facing constraints, actual ZXing
  frame decoding, repeated-frame deduplication, stop/restart and stream cleanup after
  successful scans, late permission responses, close and route unmount.

## Deployment and physical-device limits

Camera access requires HTTPS (including a secure tunnel) or localhost. A plain HTTP
LAN URL is not a secure camera deployment. No camera permission is requested on
portal load. The repository contains no restrictive camera Permissions-Policy header
or portal embedding iframe to change. An embedding host must explicitly permit the
portal origin in its camera policy and provide iframe allow="camera"; the application
detects policy denial and offers image upload/search instead of bypassing it.

No physical Android, iPhone/iPad, macOS Safari or desktop camera was available here.
Windows Playwright WebKit lacks canvas camera streams; its camera errors were
simulated and its QR uploads used the real decoder. Engine tests do not establish
physical Safari/Chrome camera compatibility. Physical-device checks remain:

1. Open the HTTPS portal and confirm no camera prompt appears before Scan QR.
2. Allow/deny/retry camera access; confirm rear-camera preference where available.
3. Scan a real passenger QR, confirm group/trip data, then save attendance.
4. Verify invalid, wrong-trip, already-checked and finalized-trip handling.
5. Close/reopen the scanner and navigate away; confirm the camera indicator turns off.
6. Test image upload, manual search, keyboard scrolling and portrait/landscape layouts.
