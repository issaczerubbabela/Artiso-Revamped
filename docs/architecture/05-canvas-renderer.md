# 05 — Canvas Renderer

Package: `packages/renderer`

## Purpose

Composite the filtered working bitmap and the grid overlay into what the
artist actually sees, and own the viewport (pan/zoom) transform. This is the
module the "Canvas-First" philosophy is built on — see
[`ki-canvas-first-design`](../../.agents/knowledge/ki-canvas-first-design.md).

## Two-canvas architecture

```
┌───────────────────────────────────────────┐
│  DOM container (resizes via ResizeObserver) │
│  ┌───────────────────────────────────────┐ │
│  │ <canvas id="image-layer"> (WebGL2)      │ │  ← Image Processing pipeline output
│  │ <canvas id="grid-layer">  (Canvas2D)    │ │  ← Grid Engine geometry, stacked via CSS
│  └───────────────────────────────────────┘ │
│  DOM overlay: crop handles, selection UI    │ │  ← plain React/DOM, not canvas-painted
└───────────────────────────────────────────┘
```

Rationale for two stacked canvases rather than one: compositing the WebGL
result into a single 2D canvas each frame requires a GPU→CPU→GPU readback
(`drawImage(webglCanvas, ...)` is comparatively cheap in practice since
browsers keep it GPU-side, but mixing shader-driven image filtering and
vector line/text drawing in one context either forces the grid through WebGL
[text rendering is painful in raw WebGL] or forces the image through Canvas2D
[loses shader-based filters]). Two stacked canvases keep each renderer doing
what it's best at, matching the source app's own layer separation (§8.10).

## Viewport transform

Renderer owns a single 2D affine transform (`{ translateX, translateY,
scale }`) representing pan/zoom. Both the WebGL image draw and the Canvas2D
grid draw are re-projected through this matrix on every paint — **neither
the image pipeline nor the grid geometry is recomputed for pan/zoom**, only
the transform changes. This is the perf-critical design point that makes
60fps pan/zoom achievable on mid-range Android hardware.

```ts
interface Viewport {
  setZoom(scale: number, anchor?: {x: number; y: number}): void;
  panBy(dx: number, dy: number): void;
  zoomToFit(): void;
  reset(): void;
}
```

## Render loop

- `requestAnimationFrame`-driven, **dirty-flag gated**: a frame is only
  painted when workspace state actually changed (viewport, EditStack, grid
  config). No continuous redraw loop — conserves battery on mobile,
  consistent with the offline/mobile-first performance NFRs.
- `devicePixelRatio`-aware sizing so output is crisp on high-DPI desktop
  displays and Android devices alike.

## Input handling

Per the locked "Input devices" decision ([00](00-system-overview.md)): the
renderer exposes a platform-agnostic `Viewport` API; a single Pointer-Events
based controller drives it from both touch and mouse, plus:

| Input | Action |
| --- | --- |
| Touch pinch | `setZoom` |
| Touch drag / mouse drag (space held, or middle-click) | `panBy` |
| Mouse wheel | `setZoom` (anchored at cursor) |
| Double-tap / double-click | `zoomToFit` toggle |
| Keyboard `+`/`-` | `setZoom` (desktop only, see [06](06-workspace-interaction.md)) |

Stylus/pressure input is explicitly **not** wired into the viewport
controller — the `Viewport` API is intentionally input-source-agnostic so
adding a pressure-aware input source doesn't require touching this module.

### Annotation layer addendum (Phase 7)

A third stacked Canvas2D canvas (`AnnotationLayer`) now sits above the grid
layer, drawing arrow/circle/note/freehand annotations reprojected through
the same `Viewport` transform as the grid. It consumes already-resolved
image-space pixels (`core-engine`'s `resolveAnnotationGeometry`, the same
"image-space only" contract as `GridGeometry`) so it never recomputes for
pan/zoom. The canvas is `pointer-events: none` except in the Annotate tool
mode, where `CanvasStage` captures pointer events on it directly (reading
`event.pressure` for freehand points) and `InputController` is gesture-locked
via its existing `isGestureLocked` option so a stroke never also pans. The
in-progress stroke is drawn through the same code path as committed
annotations, so the live preview matches what's saved.

## Responsiveness

Canvas container resizes via `ResizeObserver`; on resize, the transform is
recalculated to preserve the current framing (not reset to default),
important when the layout switches chrome (side panel ↔ bottom sheet) across
the breakpoint boundary defined in [06](06-workspace-interaction.md).

## Dependencies

- Consumes: [Image Processing](03-image-processing-filters.md) shader chain
  output, [Grid Engine](04-grid-engine.md) geometry.
- Consumed by: [Workspace](06-workspace-interaction.md) (mounts it, wires
  toolbar/panel actions to its API), [Export](07-export-engine.md) (reuses
  the same draw code path at full resolution, off-screen, without the
  interactive viewport).

## Open questions

- [ ] WebGL2 baseline vs. WebGL1 fallback — confirm minimum Android WebView
  version we support still ships WebGL2 (Chromium WebView has since Android
  8/API 26; source app's own min-SDK is unknown from the APK analysis alone).

## Phase 9 addendum — mm viewport, CSS-px space, drawing-grid pass

Per [phase-9](../phases/phase-9-drawing-grid-overhaul.md) and
[`Grid-Feature-Spec.md`](Grid-Feature-Spec.md) §9–§11:

- **Viewport units:** content is the *paper* in mm; `scale` = **CSS px per
  mm**; minimum zoom = fit paper; `setRealSize(pxPerMmCss)` gives 1 mm on paper
  = 1 mm on the physical screen (calibrated via screen diagonal + native
  resolution, stored device-locally). Fit and Real size act per pane.
- **Insets (UI revamp):** `Viewport.setInsets({left, top, right, bottom})` names
  the part of the container that floating chrome covers. Fit, centring, the zoom
  anchor and the default pan limits all work in the *uncovered region*; with zero
  insets (the default) behaviour is identical to before. See
  [06-workspace-interaction.md](06-workspace-interaction.md#inset-aware-view-ui-revamp).
- **DPR:** pointer coordinates, viewport state and layout are all in CSS px;
  each canvas is sized `css × devicePixelRatio` and draws under
  `setTransform(dpr, …)`. (Previously the input layer used CSS px while the
  viewport/canvases used device px.)
- **Grid pass:** a new `DrawingGridLayer` draws in *screen space* so line width
  is constant at any zoom; one batched path per overlay in the order
  guides → squares → diagonals → radial → labels, clipped to the paper, culled
  to the visible index range, 1px lines snapped to half device pixels. Labels
  are the last pass, `pointer-events: none`.
- **Image pass:** draws the crop-aware working bitmap mapped to the paper
  rectangle; while the crop tool is open it draws the full oriented image under
  a fixed frame.
- **Per-frame work:** "the grid is never recomputed on pan/zoom" now means
  *line geometry*. Sticky label positions are recomputed each frame from the
  view (a pure, culled, thinned function).
- **Stability:** the frame callback catches draw errors so one failure cannot
  stop the loop.
- **Export:** the same layer runs with `mode: 'export'` (no viewport pinning,
  `scale = exportPxPerMm`); SVG export is generated in mm from the same pure
  segment functions.
