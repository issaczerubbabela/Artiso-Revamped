# 02 — Image Editing Module (Crop / Rotate / Flip)

Package: `packages/core-engine` (geometry math) + `apps/web` (interactive UI)

## Purpose

Geometric transforms are always the **first stage** of the `EditStack`
(confirmed by the source spec's pipeline order, §4.2/§6.2:
`Crop/Rotate/Flip → Global Adjustments → Filters → Grid`). Unlike filters,
these operations change the image's **dimensions**, which is the one thing
the Grid Engine cares about — see the grid/image independence invariant in
[00](00-system-overview.md#6-core-architectural-invariants-apply-to-every-module).

## Operations

| Operation | Data shape | Notes |
| --- | --- | --- |
| Crop | `{ type: "crop", rect: { x, y, w, h } }` (image-space, normalized 0–1) | Rect in normalized coords so it survives re-render at working vs. export resolution |
| Rotate | `{ type: "rotate", degrees: 0\|90\|180\|270 }` | Quick 90° increments, matches source app; freeform straighten is a Phase 6 stretch item |
| Flip | `{ type: "flip", axis: "horizontal"\|"vertical" }` | Horizontal confirmed in source app; vertical included since it's nearly free to support |

All three are appended to `Reference.editStack` (see
[11](11-data-model-schema.md)) — never applied destructively to the working
or original bitmap.

## Interaction

- **Crop**: draggable-handle overlay drawn in the Canvas Renderer's UI layer
  (DOM, not canvas-painted, for easy touch/mouse hit-testing). Desktop adds
  arrow-key nudge (1px / Shift+arrow = 10px) once a handle is focused;
  optional aspect-ratio lock (free / 1:1 / 4:3 / match original).
- **Rotate**: single button cycling 0°→90°→180°→270°, per source app.
- **Flip**: single toggle button per axis.

Pointer handling is unified across mouse and touch via the Pointer Events
API (one code path, no separate touch/mouse handlers) — consistent with the
"Input devices" decision in [00](00-system-overview.md).

## Recalculation contract

Any crop/rotate/flip change:

1. Recomputes effective working-bitmap dimensions.
2. **Invalidates and regenerates** Grid Engine geometry (rows/cols cell
   boundaries) — this is the one case where the grid *must* recompute.
3. Does **not** re-run the filter pipeline's shader parameters — filters are
   dimension-independent and simply re-run against the new geometry.

```
Crop/Rotate/Flip change
        │
        ▼
Recompute working-bitmap dimensions
        │
        ├─→ Grid Engine: regenerate cell geometry  ──▶ Canvas Renderer
        │
        └─→ Filter pipeline: re-run (unchanged params) on new geometry ──▶ Canvas Renderer
```

## Dependencies

- `core-engine` geometry utilities (pure math: rect transforms, rotation
  matrices).
- [Grid Engine](04-grid-engine.md) — recalculation trigger.
- [Canvas Renderer](05-canvas-renderer.md) — draws the crop overlay and the
  transformed working bitmap.

## Open questions

- [ ] Freeform (arbitrary angle) rotate/straighten — confirm this stays in
  Phase 6, not pulled forward.

## Phase 9 addendum — crop becomes "image under a paper frame"

Per [`Grid-Feature-Spec.md`](Grid-Feature-Spec.md) §5 and
[phase-9](../phases/phase-9-drawing-grid-overhaul.md), the free-form,
baked-in crop described above is replaced:

- The user picks a **paper size** (preset or custom, mm/cm/in/px, portrait or
  landscape). The crop frame is **locked to the paper's aspect ratio** and
  never resizes; the user pans and zooms the image underneath it. The frame
  must always be fully covered by the image (pan clamped; minimum zoom = image
  just covers the frame).
- Stored as `Reference.paper` + `Reference.crop`. `Crop` is `{x, y, w, h}` in
  pixels of the **oriented original** (after rotate/flip), so export replays
  it exactly at full resolution. Crop is **never baked** into the EditStack.
- **Rotate/flip stay EditStack operations** and apply *before* the crop
  rectangle. Pipeline order is unchanged: rotate/flip → crop region →
  adjustments → filters → grid.
- Toggling portrait/landscape swaps width/height, keeps the crop centred and
  re-clamps it.
- On crop commit the working bitmap is rebuilt from the crop region (long edge
  ≤ 2048) so small crops of large photos stay sharp; the full oriented image
  is used only while the crop tool is open.
- **Legacy references:** `crop` ops in an existing EditStack are folded into
  the initial `crop` (tracking the rect through later rotate/flip ops) on
  first load; paper defaults to A4. The stored EditStack is left intact for
  older clients and its crop ops are ignored once `paper` is set.
- The normalized 0–1 crop rect, DOM handle overlay, free aspect presets and
  arrow-key nudge described above are retired. The grid's recalculation
  trigger for crop changes no longer applies: the grid depends on paper size,
  not on the crop rectangle.
