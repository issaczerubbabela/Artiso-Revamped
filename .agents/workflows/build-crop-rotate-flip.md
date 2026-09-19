# Workflow: Build Crop / Rotate / Flip

Architecture: [docs/architecture/02-image-editing.md](../../docs/architecture/02-image-editing.md)

## Trigger

Implementing the geometric edit tools — the first stage of the pipeline.

## Preconditions

- Working bitmap and its dimensions are available from
  [Image Import](build-image-import-pipeline.md).

## Procedure

1. **Store operations as data, not pixels.** Crop appends
   `{ type: "crop", rect }` (normalized 0–1 coordinates, not pixel
   coordinates) to `EditStack`. Rotate/flip append their own discriminated
   union members. Never mutate the working bitmap in place.
2. **Normalize crop rects.** Using 0–1 normalized coordinates (not absolute
   pixels) means the same crop operation replays correctly whether it's
   applied to the working bitmap (interactive) or the full-resolution
   original (export) — this is what keeps [Export](build-export-pipeline.md)
   a faithful re-run rather than a separate implementation.
3. **Build the crop overlay as DOM, not canvas-painted.** Draggable handles
   are a React/DOM layer positioned over the canvas — this makes touch/mouse
   hit-testing and keyboard focus trivial, versus hand-rolling hit-testing
   inside canvas draw calls.
4. **Unify touch and mouse via Pointer Events** for handle dragging, same as
   [build-canvas-zoom-pan-gestures.md](build-canvas-zoom-pan-gestures.md).
   Add arrow-key nudge (1px, Shift+arrow = 10px in working-bitmap space) when
   a handle has focus — desktop-only addition.
5. **Trigger the Grid Engine recalculation contract.** Any commit of a
   crop/rotate/flip operation must invalidate cached `GridGeometry` — see
   [build-grid-overlay-renderer.md](build-grid-overlay-renderer.md) step 4.
   Do this via a single "geometry changed" event/callback, not by having
   this module reach into the Grid Engine directly.
6. **Rotate/flip are single-action, no intermediate state** — clicking
   rotate immediately appends the operation and re-renders; there's no
   "preview then confirm" step (matches source app behavior, keeps this a
   one-tap action per the simplicity philosophy).

## Files/modules touched

`packages/core-engine/src/geometry/*` (rect/rotation math),
`apps/web/.../CropOverlay/*`, `apps/web/.../RotateFlipControls/*`.

## Testing checklist

- [ ] Unit test crop-rect normalization/denormalization round-trips
      correctly at both working and full resolution.
- [ ] Rotate 4x returns to original orientation (0→90→180→270→0).
- [ ] Committing a crop correctly invalidates and regenerates grid geometry
      (integration test, not just a manual check).
- [ ] Keyboard nudge works and respects Shift modifier for the larger step.

## Common pitfalls

- Storing crop rects in absolute working-bitmap pixels — breaks the
  moment Export re-runs the stack at full resolution.
- Skipping the grid-invalidation trigger because "rotate doesn't change the
  aspect ratio much" — 90°/270° rotation swaps width and height entirely.

## Related knowledge items

[`ki-non-destructive-editing`](../knowledge/ki-non-destructive-editing.md),
[`ki-grid-image-independence`](../knowledge/ki-grid-image-independence.md).

## Phase 9 note — crop is now "image under a paper frame"

Crop is redefined by
[`Grid-Feature-Spec.md`](../../docs/architecture/Grid-Feature-Spec.md) §5 and
[phase-9](../../docs/phases/phase-9-drawing-grid-overhaul.md). Rotate and flip
are unchanged (EditStack operations, applied first). For **crop**, ignore the
normalized-rect / DOM-handle / arrow-nudge steps above:

- Crop is `Reference.crop` (pixels of the oriented original, aspect locked to
  the paper), never an EditStack operation and never baked into the bitmap.
- The frame is fixed; the user pans and zooms the image under it. The frame
  must always be fully covered (clamp pan; minimum zoom = cover).
- Orientation swap re-centres and re-clamps the crop.
- Legacy `crop` ops are folded into the initial crop on first load and then
  ignored once `paper` is set.
- Testing: cover/clamp unit tests, orientation-swap re-centre, and legacy
  fold tests for every rotate × flip combination against `applyGeometryOps`.
