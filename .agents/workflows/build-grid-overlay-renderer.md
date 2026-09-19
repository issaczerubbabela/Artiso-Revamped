# Workflow: Build the Grid Overlay Renderer

Architecture: [docs/architecture/04-grid-engine.md](../../docs/architecture/04-grid-engine.md),
[docs/architecture/05-canvas-renderer.md](../../docs/architecture/05-canvas-renderer.md)

## Trigger

Implementing grid generation, grid configuration, or the Canvas2D overlay
that draws it — Phase 1 (core grid) and Phase 6 (new grid types) work.

## Preconditions

- Working-bitmap dimensions are available from the current `EditStack`'s
  geometry stage (crop/rotate/flip already resolved).
- The two-canvas renderer architecture exists (WebGL image layer + Canvas2D
  grid layer, stacked).

## Procedure

1. **Compute geometry in image-space, never screen-space.** `GridEngine`
   takes `{ width, height, GridConfig }` and returns `GridGeometry { lines,
   labels }` in image-space coordinates. It must never know about the
   current pan/zoom transform.
2. **Cache the geometry.** Store the last-computed `GridGeometry` keyed by
   `(width, height, GridConfig)`. Do not recompute per frame.
3. **Apply the viewport transform at draw time, in the renderer, not the
   engine.** The Canvas2D grid layer reads the cached `GridGeometry` and the
   renderer's current transform matrix on every paint, projecting line/label
   coordinates to screen space just before drawing.
4. **Wire the two correct recalculation triggers** (and only these):
   - Crop/Rotate/Flip changes (dimensions changed).
   - `GridConfig` changes (rows/cols/color/thickness/numbering/visibility).
   Explicitly do **not** wire brightness/contrast/saturation/filter changes
   or pan/zoom to grid recomputation — verify this with a failing test
   first if you're unsure the wiring is correct.
5. **Numbering depends on visibility.** If `visible: false`, don't compute
   or draw labels regardless of `numberingMode` — matches source spec
   §7.28's documented control dependency.
6. **Respect the max-cell-count guard** (e.g. rows × cols ≤ 2500) before
   generating geometry — reject/clamp pathological configs at the config
   layer, not by discovering a slow frame later.

## Files/modules touched

`packages/core-engine/src/grid/*` (pure geometry generation),
`packages/renderer/src/gridLayer.*` (Canvas2D draw + transform projection),
Grid Configuration panel UI in `apps/web`.

## Testing checklist

- [ ] Unit test `GridEngine` headlessly: given dimensions + config, verify
      cell boundaries and label positions are correct for a few known
      configurations (including edge cases: 1×1, max cell count, odd
      width/height not evenly divisible by cols/rows).
- [ ] Integration test: confirm a brightness change does **not** trigger
      grid geometry recomputation (spy/assert), and a crop change **does**.
- [ ] Visual: grid stays perfectly aligned to the image during pan/zoom at
      several zoom levels (no drift/rounding error accumulation).
- [ ] Numbering mode toggling on/off while grid is hidden produces no
      visible labels and no wasted computation.

## Common pitfalls

- Baking screen coordinates into `GridGeometry` — breaks the "pan/zoom is
  transform-only" performance property this whole design exists for.
- Recomputing geometry on every pan/zoom frame "just to be safe" — defeats
  the 60fps NFR.
- Forgetting `snapToImage` — after a crop, grid must realign exactly to the
  new image bounds, not the old ones.

## Related knowledge items

[`ki-grid-image-independence`](../knowledge/ki-grid-image-independence.md)
— this workflow exists specifically to implement that principle correctly.

## Phase 9 note — superseded for the primary grid

The primary grid is rebuilt per
[`Grid-Feature-Spec.md`](../../docs/architecture/Grid-Feature-Spec.md) and
[phase-9](../../docs/phases/phase-9-drawing-grid-overhaul.md). For the primary
grid, where this workflow disagrees, the spec and the Phase 9 addenda in
`docs/architecture/04-grid-engine.md` / `05-canvas-renderer.md` win:

- Geometry is in **paper mm** (not image space), from pure functions of
  `(paper, settings, visibleRect)`; the renderer maps mm to screen through the
  view transform and draws in screen space with constant `widthPx`.
- Labels are a separate pure layout function of the view (sticky, constant
  size, density-thinned) — "never bake screen coordinates into geometry" still
  holds for *line* geometry; labels are the deliberate carve-out.
- Triggers: paper or grid-settings change recomputes lines; pan/zoom does not;
  filters do not. There is no `snapToImage` and no max-cell-count cap (use
  viewport culling instead).
- The testing checklist's "odd width/height not divisible by rows/cols" case
  becomes "paper not a multiple of `cellMm` → partial last column/row".

Everything above still applies to the **Guides layer** (perspective, thirds,
golden ratio, layered guide).
