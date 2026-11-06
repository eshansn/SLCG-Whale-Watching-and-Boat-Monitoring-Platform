# Public whale: visible behind content

Updated: 2026-11-05 (Asia/Colombo).

The public whale now renders continuously behind Home, About, Gallery, Contact,
navigation and footer text. Page content neither cuts holes in the animal nor
restricts its swimming. It remains above the shared ocean background and below
foreground content, with `pointer-events:none` and `aria-hidden:true`.

## Cause and fix

The prior implementation measured content rectangles and used them twice:

- The whale fragment shader discarded/softened pixels inside those rectangles,
  including the body, fins, tail, eyes and contour lines. This made the whale
  disappear behind text even after the CSS text-panel backgrounds were removed.
- A layout-aware planner used the same rectangles as expanded obstacles, reserved
  space below the navbar and redirected the animal away from text.

Both mechanisms are removed. `WhaleModel.ts` no longer has mask uniforms, a
content-visibility function or fragment discards. `OceanEnvironment.ts` and
`OceanWhaleScene.ts` no longer measure, project, cache or upload content rectangles.
The scene only needs viewport dimensions and the existing static fallback sizing.
There is no content survey, collision grid, repulsion, reserved navbar region,
section preference, scroll listener or scroll progress input in the whale engine.

`WhaleMotion.ts` chooses varied autonomous destinations throughout its viewport
habitat. Recent-destination history and the existing destination cadence provide
variation. Only destination selection changed to remove content avoidance. The
existing speed variation (1.15 + sine * .16), acceleration cap (.8), angular speed
cap (.55), yaw/pitch response, turn braking, banking, quaternion integration and
behavior labels are retained. Scrolling cannot scrub the animation or set poses.

The entire `createWhaleModel` function is byte-for-byte unchanged: body topology,
procedural spine, travelling body wave, delayed head/body/tail turns, flukes, fins,
dorsal movement, face details and disposal are preserved. Only the material's
content-cutout logic was removed. Camera setup, physical scaling, perspective,
depth lighting/opacity, particles and the local wake are unchanged.

## Foreground styling and interaction

Home/About/Gallery/Contact/footer text containers remain transparent, preserving
the preceding text-panel cleanup. The remaining navbar glass fill and backdrop
blur, mobile-menu white fill/shadow, and opaque Contact input/textarea fills were
removed. Navbar text/icons use the existing ocean light text color and a subtle
text shadow for contrast. Hover states do not create a covering fill.

The original ocean gradient, atmosphere, lighting and positioning remain intact.
The original five Gallery photographs, order, crop/hover behavior and sources are
unchanged. Actual photographs, logos and action buttons remain foreground objects;
no extra invisible rectangle suppresses the whale around them.

All navigation handlers, links, responsive menu behavior, form validation/submission,
routes, backend integration and public copy are unchanged. Foreground controls stay
clickable because the decorative canvas cannot receive input. No new dependencies,
assets, sections, overlay containers or React animation state updates were added.

## Accessibility, performance and scope

The existing mobile/low-device limits (30 fps, pixel ratio 1, 703 body vertices,
24 particles) and desktop caps (60 fps, pixel ratio 1.5, 1,769 body vertices,
48 particles) remain. Hidden tabs pause; reduced motion skips/disposes the 3D scene
and uses the original illustration. Missing WebGL2/context loss fall back gracefully.
Unmount cancels frames, removes listeners/observers and disposes GPU resources.

The existing model is a stylized procedural 3D whale. This rendering fix does not
replace its asset or claim anatomical/photorealistic changes.

Pre-edit hashes and focused source comparisons verify preservation of all public
content components, App/routes, authentication styles, dependency manifests, model
geometry/articulation, and steering integration. Existing unrelated Git changes
were inspected and preserved. Current artifacts are under
`.runlogs/whale-visible-through-content/`; older directories are historical.

## Verification

With Vite on port 5173, run from the repository root:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright'
$env:WWMS_PUBLIC_BASELINE='.runlogs/public-ocean/baseline.json'
$env:WWMS_PUBLIC_WIDTHS='375,1440'
node scripts/tests/whale-motion.cjs
node scripts/tests/whale-visible-content.cjs
node scripts/tests/public-ocean.cjs
node scripts/tests/living-whale.cjs

$env:PLAYWRIGHT_ENGINE='webkit'
node scripts/tests/whale-visible-content.cjs
```

- `whale-visible-content.cjs` aligns real text with the freely swimming animal and
  compares actual composited screenshots with/without the canvas. It requires
  visible whale pixels inside Home/About heading and paragraph rectangles,
  the Gallery caption and Contact heading. It checks transparent ancestors/navbar,
  live swimming and pointer input behavior on mobile/desktop. Screenshots are
  visually inspected; no model pose or movement is substituted for this check.
- `whale-motion.cjs` runs 180 seconds of seeded production physics, rejects any
  content/obstacle/scroll input, checks exploration in all axes and unchanged
  acceleration/rotation limits, and verifies actual mesh deformation/delayed turns
  at both geometry detail levels.
- `public-ocean.cjs` checks original copy/photo sources/order, all four sections,
  bounded forward/reverse scrolling, Gallery hover/mobile tiles, navigation,
  Contact failure/retry/reset fixtures, reduced motion and route cleanup/re-entry.
- `living-whale.cjs` checks actual framebuffer pixels, stationary swimming/depth,
  hidden/resume, context loss, reduced-motion import avoidance, missing-WebGL
  fallback and constrained-device quality.

Contact responses are mocked; browser tests do not send email. Build and lint run
from `apps/web`. Build before browser tests to avoid development reloads mid-check.
The build retains existing SignalR annotation and large-chunk advisories.

Completed checks:

| Check | Result |
| --- | --- |
| Composited whale pixels through all four sections' text | Pass: Chromium and WebKit, 375/1440px |
| Public content, Gallery, navigation and Contact regression | Pass: Chromium, 375/1440px |
| Live renderer, hidden/resume, fallbacks and low-device profile | Pass: Chromium |
| Physics/articulation, 180-second seeded run | Pass |
| Model deformation and turn integration preservation | Exact source match |
| Production build and ESLint | Pass |
