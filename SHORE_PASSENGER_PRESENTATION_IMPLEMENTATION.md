# Shore Officer passenger summary and manifest

Implemented 6 November 2026. Scope is the Shore Officer web portal only. Existing unrelated modifications were preserved. The previously proposed database cleanup remains unapproved and unexecuted.

## Behavior

The Trip Info page displays **Passenger Summary** immediately above **Trip departure**, below the other passenger sections and the Crew card in document order. Its previous descriptive subtitle has been removed. Only passengers whose persisted attendance status is exactly `Present` are included. Local and Foreign rows show Adults, Children, **Under 6**, and Total, followed by Grand Total. Under 6 follows the user's prior explicit confirmation and existing registration data; there is no numeric age/date-of-birth information to calculate a separate under-eight group.

This follow-up changes only the summary's presentation, placement and counting filter. It uses the existing Deep Ocean navy/teal gradient, muted blue headers, cyan totals, subtle borders, existing typography and contained horizontal scrolling. Other cards, the registered manifest and all write workflows retain their implementations. A DOM target above the departure card lets the existing attendance component render this section there without a second fetch or duplicated manifest state.

The Crew/Summary/Departure area now uses one column at every breakpoint, including 1600px and 1920px desktops. Passenger Summary always fills the same width as Crew and sits below it, followed by Trip Departure; no responsive side-by-side rule remains for this area.

Stacking follow-up verification: production build passed, and the mocked Shore browser regression passed at 320/375/430/768/1024/1440/1600/1920px. Geometry assertions check that Summary is physically below Crew, Departure is below Summary, and Summary matches Crew's width. No database writes were used for this layout verification.

The existing manifest now shows a country flag before each name, nationality, Local/Foreign category, and recorded age category. Existing reference, group/relationship, attendance status, check-in time, QR search/scanning, confirmation and departure controls remain.

Both views use the same joined passenger array. The manifest still displays everyone registered; only the summary's existing reducer filters that array to saved `Present` statuses. Unsaved check-in selections, `NotChecked`, `NotPresent` and any unrecognized status are excluded. Current trip assignments are the source, so removed/transferred-out passengers are excluded even if an old attendance record existed. There is no separate cancellation/active flag on TripPassenger; no new status or database field was introduced. Shore's existing attendance endpoint supplies attendance/group information; the existing operations trip-passengers endpoint supplies country, category and age. Records join by passenger ID, not name or row position. A membership mismatch between concurrent responses retries once; a persistent mismatch displays a refresh error and preserves the previous valid snapshot. No backend endpoint, DTO, authorization rule, database field or workflow changed.

The summary and manifest refresh with the page's existing operations live events and ten-second poll, on window focus, and after attendance saves. Older read responses cannot overwrite newer snapshots or a successful finalization. Initial unavailable data displays dashes instead of false zero counts; a successfully loaded empty list displays zeros.

## Existing classification rules

- Stored `passengerType` determines Local/Foreign when available. Local registration implies Sri Lanka (`LK`) when an older record has no country. A valid country code supplies a fallback only when the stored category is missing; absent/invalid foreign countries remain **Not recorded**, with no guessed flag.
- `adult` maps to Adult; `child` to Child; `small` to Under 6. No dates of birth or numerical ages exist to recalculate ages.
- Legacy `specialneeds` records count as adults, matching `WildlifeMonitoringController`'s existing classification. Only present passengers contribute to the summary; that other portal remains unchanged.
- Unrecognized ages/categories remain **Not recorded**. An additional column/row appears only when needed so every onboard passenger remains included and row/column totals still reconcile.

## Flags

Screenshot inspection found that the shared flag component's remote CDN images were blank in the test environment. Shore therefore has its own small flag component and local SVG assets for all 249 supported ISO country codes. Shared components and other portals retain their existing implementation. No dependency was added.

The country artwork is from [Twemoji v14.0.2](https://github.com/twitter/twemoji/tree/v14.0.2/assets/svg), with the upstream [CC BY 4.0 graphics license](https://github.com/twitter/twemoji/blob/v14.0.2/LICENSE-GRAPHICS) and attribution included under `apps/web/public/shore-flags/`. SVG artwork totals approximately 593 KB. The test verifies actual image decoding as well as country labels and local image URLs.

## Production files

- `apps/web/src/screens/Shore/PassengerAttendancePanel.tsx`: summary placement, expanded manifest, safe refreshes and retention of demographic details after finalization.
- `apps/web/src/screens/Shore/ShoreTripInfo.tsx`: passes the existing live/polled trip revision to the passenger panel.
- `apps/web/src/screens/Shore/shoreAttendanceApi.ts`: joins the two existing read APIs inside the Shore client module.
- New Shore-only `ShorePassengerSummary.tsx`, `shorePassengerPresentation.ts`, and `ShoreCountryFlag.tsx`.
- Local `apps/web/public/shore-flags/` assets and attribution/license.

No Admin, Owner, Crew, Supervisor, SLTDA, other portal, mobile, shared UI, backend production, registration, booking, approval or departure implementation was modified for this task.

## Verification

- TypeScript/production web build: passed. ESLint for all six Shore files: passed with no warnings.
- Test project build: passed, zero warnings/errors.
- Edge: real SQL/API summary/manifest browser scenario, existing live QR/attendance browser scenario, and existing QR authorization/validation/finalization API test all passed (3 tests).
- WebKit: real SQL/API summary/manifest scenario passed; the real QR and saved-attendance scenario also passed on focused recheck. Its first QR-image upload attempt timed out before reaching the summary assertions; no scanner code was changed.
- Summary scenario covers Local/Foreign adult/child/small combinations, legacy special-needs classification, missing/invalid countries, country-only fallback, unknown age/category, row/column/grand totals, actual local flag rendering, and 320/375/768/1024/1440/1600px layouts. It verifies initial zero onboard counts with 12 registered passengers, mixed present/absent/unchecked records, Present-to-absent/unchecked changes including a stale checked timestamp, restoration to Present, and removal of a checked-in assignment. The new heading, removed subtitle, section adjacency/order and Deep Ocean surface are asserted.
- Real fixture edits to nationality, name and age update the open page through polling without changing the trip's total. Additions/removals, empty lists, initial read failure, refresh failure/recovery and a concurrent membership race are covered. Summary and manifest remain synchronized. No registration/attendance/departure write request is sent by presentation.
- Owner portal smoke check confirms the Shore-specific summary is absent.
- The existing mocked Shore QR suite also passed all five Shore pages at 320/375/430/768/1024/1440px, camera/QR failure and cleanup cases, group confirmation, navigation, and demographic retention after finalization. It now explicitly checks zero onboard passengers before saving an edited Present selection, and one onboard passenger after confirmation succeeds.
- All SQL changes used isolated `WWMS_ComplaintTests_<guid>` fixture databases, protected by an explicit database-name guard. No existing WWMS account, booking, trip or passenger was changed. No database cleanup was run.
- Follow-up evidence: `.runlogs/shore-onboard-summary/`, screenshots under `.runlogs/shore-passenger-summary/`, and `.runlogs/shore-onboard-summary-build.log`.
