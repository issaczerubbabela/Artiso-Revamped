# Recipe: Add a New Grid / Guide Type

Use this once [build-grid-overlay-renderer.md](build-grid-overlay-renderer.md)'s
rectangular grid engine already exists — for adding perspective, radial,
Golden Ratio, Rule of Thirds, or other guide types from
[Phase 6](../../docs/phases/phase-6-advanced-guides-ai-stretch.md).

**Before starting, confirm this item has actually been pulled into active
scope** per the process in
[phase-6-advanced-guides-ai-stretch.md](../../docs/phases/phase-6-advanced-guides-ai-stretch.md#process-for-pulling-an-item-into-active-scope) —
this recipe assumes that decision has already been made.

## Steps

1. Extend `GridConfig` (or introduce a sibling `GuideConfig` if the new type
   doesn't fit the rows/cols/color/thickness/numbering shape — e.g. a
   perspective grid needs vanishing points, not row/column counts) in
   `shared-types`.
2. Add a `type` discriminator (`"rectangular" | "perspective" | "radial" |
   "ruleOfThirds" | "goldenRatio"`) so the engine can dispatch geometry
   generation per type while keeping one `GridGeometry { lines, labels }`
   output shape that the renderer already knows how to draw.
3. Implement geometry generation as a pure, headlessly-testable function in
   `packages/core-engine/src/grid/`, same contract as the existing
   rectangular generator: input is `(width, height, config)`, output is
   image-space `GridGeometry`. **The renderer must not need to change** —
   if it does, the abstraction is wrong; revisit before proceeding.
4. Confirm the same recalculation triggers apply (geometry changes on
   crop/rotate/flip and config changes, never on filter/pan/zoom changes) —
   this is type-agnostic and should require no new wiring, only a fresh
   test.
5. Add the UI for selecting/configuring the new grid type — likely a "Guide
   Type" selector at the top of the existing Grid panel, with type-specific
   sub-controls appearing below it (e.g. vanishing-point count for
   perspective).
6. Layered grids (major+minor simultaneously, or a guide overlaid on a
   rectangular grid) are a **composition** of multiple `GridGeometry`
   results, not a new type of the same shape — handle by rendering multiple
   overlay passes, don't try to encode "layered-ness" into one config.

## Explicitly do not

- Let a new grid type require the Canvas Renderer to know its internal
  geometry rules — the renderer only ever draws `LineSegment[]`/`Label[]`,
  regardless of what generated them.
- Skip the max-geometry-complexity guard equivalent to the rectangular
  grid's max-cell-count check — a perspective or radial grid with unbounded
  line count is just as capable of tanking frame rate.

## Verification

Run through the full testing checklist in
[build-grid-overlay-renderer.md](build-grid-overlay-renderer.md), plus:

- [ ] Confirm the renderer required zero changes to draw the new geometry
      type (proves the abstraction held).
- [ ] Confirm layered/composed guides (if applicable) render in the correct
      stacking order and don't regress the single-grid case.
