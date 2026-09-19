# 04 — Grid Engine

Package: `packages/core-engine` (geometry) + `packages/renderer` (Canvas2D
draw)

## Purpose

The application's defining subsystem (source spec Stage 3): divide the
reference image into a configurable spatial coordinate system that helps
artists transfer proportions accurately, without ever touching image pixel
data. See [`ki-grid-image-independence`](../../.agents/knowledge/ki-grid-image-independence.md).

## Grid config model

```ts
type GridConfig = {
  rows: number;              // e.g. 4–20
  cols: number;
  color: string;              // hex, includes preset swatches (black/white/red/blue/green/yellow) + custom picker
  opacity: number;             // 0-100
  thickness: "veryThin" | "thin" | "medium" | "thick" | "extraThick";
  numberingMode: "off" | "numbers" | "letters" | "alphanumeric" | "roman" | "custom";
  visible: boolean;
  snapToImage: boolean;        // always realign to image bounds after crop/rotate
};
```

Density presets seed `rows`/`cols`: 4×4, 6×6, 8×8, 10×10, 12×12, Custom
(source spec §5.5).

## Generation pipeline (source spec §3.5, formalized)

```
Working Bitmap Dimensions (image-space, NOT pixel content)
        │
        ▼
Compute drawable bounds
        │
        ▼
Cell Width  = boundsWidth  ÷ cols
Cell Height = boundsHeight ÷ rows
        │
        ▼
Generate line geometry (image-space coordinates)
        │
        ▼
Generate label positions (if numberingMode != "off")
        │
        ▼
Emit GridGeometry { lines: LineSegment[], labels: Label[] }  →  Canvas Renderer
```

`GridGeometry` is expressed in **image-space** coordinates, not screen
pixels. The [Canvas Renderer](05-canvas-renderer.md) applies the current
pan/zoom transform matrix at draw time. This is what makes zoom/pan "grid
scales together with the image" (source spec §3.13) cheap: panning/zooming
never re-runs grid generation, only the transform.

## Recalculation triggers

| Change | Grid recomputes? |
| --- | --- |
| Crop / Rotate / Flip | **Yes** — dimensions changed |
| Grid config (rows/cols/color/thickness/numbering) | **Yes** |
| Brightness / Contrast / Saturation / Filter | **No** |
| Pan / Zoom | **No** — transform-only, geometry cached |

## Rendering layer order (source spec §3.12 / §8.10, fixed)

```
Top
  Grid Labels
  Grid Lines
  Reference Image (post-filter)
  Canvas Background
Bottom
```

Rendered via **Canvas2D**, not WebGL — grid lines and text need to stay
crisp (not texture-filtered/blurry) at arbitrary zoom levels, and Canvas2D's
vector line/text APIs are the right tool. See
[05-canvas-renderer.md](05-canvas-renderer.md) for why the image layer
(WebGL) and grid layer (Canvas2D) are two stacked canvases.

## Numbering modes (source spec §5.5, §3.11)

Numbers only / Letters only / Alphanumeric (A1, B2…) / Roman numerals /
Custom labels. Purpose: "See cell B3" communication for teaching and
progress-tracking (source spec §3.11) — numbering toggles independently of
grid visibility but requires the grid to be visible to render (dependency
noted in source spec §7.28).

## Performance

- Cap maximum cell count (e.g. rows × cols ≤ 2500) to avoid pathological
  label-rendering cost.
- Geometry is cached and only regenerated on the triggers above — never
  per-frame.
- Label text metrics (font measurement) cached per `numberingMode` +
  cell-size bucket to avoid re-measuring every cell every recompute.

## Dependencies

- Consumes working-bitmap dimensions from [Image Editing](02-image-editing.md).
- Explicitly independent of [Image Processing/Filters](03-image-processing-filters.md).
- Feeds [Canvas Renderer](05-canvas-renderer.md).

## Deferred (source spec §3.18, not in scope for Phases 0–5)

Perspective grids, radial grids, Golden Ratio / Rule of Thirds overlays,
dynamic/adaptive density, layered grids (major+minor simultaneously), live
camera grid. All slot into `GridConfig` as additional grid *types* later
without breaking this module's contract — see
[phase-6-advanced-guides-ai-stretch.md](../phases/phase-6-advanced-guides-ai-stretch.md).

## Phase 9 addendum — drawing-grid model (supersedes the primary grid above)

The primary grid is being rebuilt per [`Grid-Feature-Spec.md`](Grid-Feature-Spec.md)
([phase-9](../phases/phase-9-drawing-grid-overhaul.md)). Where this addendum
and the sections above disagree, **this addendum and the spec win**.

- **Model:** `GridSettings` in **millimetres** — `cellMm`, `showSquares`,
  `showDiagonals`, `showRadial`, `radialStepDeg`, per-axis `labels`
  (`numbers | letters`), and one shared `style {color, widthPx, opacity 0–1}`.
  It replaces `rows/cols/thickness/numberingMode/snapToImage` for the primary
  grid. The old rectangular and radial `GridConfig` types remain parseable for
  back-compat and are migrated on load; they are no longer drawn or editable.
  (Perspective, radial and the other Phase 7 types listed under "Deferred"
  above have shipped; only perspective, rule of thirds and golden ratio
  survive, as the Guides layer below.)
- **Geometry:** origin top-left of the *paper*; squares are fixed size from the
  top-left and the last column/row is **partial** (cut by the paper edge, never
  stretched); border lines at `k = 0…cols`. Diagonals are the 45° diagonals of
  each full virtual square, clipped to the paper. Radial rays run from the
  exact paper centre to the edge at `k · radialStepDeg`; no concentric circles.
- **Inputs:** paper size (mm) and settings only — never pixels. The crop that
  maps image pixels onto the paper lives upstream (see
  [02](02-image-editing.md)).
- **Labels** are drawn on all four edges only (none inside cells), as small
  translucent rectangles, pinned to the viewport with constant on-screen size
  and density thinning. Their layout is a *separate* pure function of the view
  (`layoutLabels`), not part of cached line geometry.
- **Recalculation triggers:** paper size/orientation or any `GridSettings`
  change → recompute line geometry. Pan/zoom → **no** line recompute; labels
  are re-laid-out (cheap, index-range culled). Filters/adjustments → no.
- **Layer order:** image → guides → squares → diagonals → radial → labels.
- **Performance:** the 2500-cell cap is replaced by viewport index-range
  culling plus a screen-density guard (skip squares/diagonals when cells are
  too small to read).
- **Kept as Guides layer:** perspective, rule of thirds, golden ratio and the
  layered second guide, generated over the paper rectangle (mm) and drawn
  beneath the new grid with their own style.
