# Owner and crew dashboard visual polish

The original dashboards were restored from Git (`f9894ff`) and given the Deep Ocean theme. The previous uncommitted dashboard redesign and its unused shared layout, panels, chart helpers, profile hook, and crew hook were removed.

## Preserved layouts and behavior

- Owner: original header and welcome/profile photo, My Boats grid, boat information buttons, ongoing trips panel or Schedule New Trips action, Register New Boats empty state, notifications button, and right-hand menu.
- Crew: original compact, centered welcome/profile card, ongoing trip or tea-break card, Upcoming Trips list, trip information buttons, notifications button, and right-hand menu.
- Existing list order, status calculations, labels, routes, APIs, loading/error/empty states, private images, and operations polling/SignalR refresh are retained. No statistics, charts, new navigation, or extra dashboard sections are added.
- `CrewLayout` itself is unchanged. Other crew pages retain their existing appearance.

## Styling

`apps/web/src/components/dashboard-ocean.css` is scoped to dashboard-only classes. It provides navy gradients, dark card surfaces, muted text, cyan actions, focus outlines, restrained hover/press effects, and four faint CSS particles. No dependencies were added.

Both dashboards render the actual `OceanWhale` from `components/auth/OceanScene.tsx` and import its existing authentication stylesheet. The SVG paths, thin gradient stroke, line drawing, halo, and slow float animation are reused. Dashboard rules only control placement, size, and subtle glow. The whale is decorative, hidden from assistive technology, and ignores pointer input.

The owner whale occupies unused hero space; the crew whale occupies the gap between the existing header buttons. Existing responsive arrangements are retained. Inner boat-card columns can shrink to prevent clipping, and text can wrap. Reduced motion disables all dashboard animation and transitions while keeping the complete whale outline visible.

## Verification

- Frontend production build passed; existing SignalR annotation warnings remain nonfatal.
- Targeted ESLint passed for both dashboard components.
- `scripts/tests/ocean-dashboards.cjs` passed in Chromium (Edge) and WebKit at 360, 390, 430, 768, 1024, 1440, and 1920px. Checks include original layout widths/columns, actual login whale SVG and animation reuse, non-overlapping decoration, menu contents/open/close, detail and notification routes, SignalR updates, loading/error/empty states, reduced motion, and unchanged styling on the crew trips page.
- The existing owner boat-image regression passed authenticated image loading, live replacement, and the missing-image placeholder.
- Desktop and mobile screenshots were visually inspected. Current screenshots and logs are under `.runlogs/dashboard-polish-*`; older `.runlogs/ocean-dashboard-*` artifacts describe the superseded design.

Browser fixtures are confined to the test script and do not alter application data. No production backend, schema, authentication, authorization, notification, or business-rule code changed. These checks use browser engines rather than physical mobile devices.
