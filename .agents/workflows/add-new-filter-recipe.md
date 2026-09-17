# Recipe: Add a New Filter or Adjustment

Use this once [build-filter-pipeline.md](build-filter-pipeline.md)'s
pipeline already exists — this is the smaller, repeatable "add one more
filter" version, e.g. adding a filter from
[Phase 6](../../docs/phases/phase-6-advanced-guides-ai-stretch.md)'s
backlog, or a filter the source spec's §6.30 proposed list suggests
(Shadow Shape, Facial Plane Map, Cross-Hatching, Value Compression, etc.).

## Steps

1. Add a new `FilterId` member (or new params on an existing one) to
   `shared-types` — this is the only schema change usually required.
2. Write the GLSL fragment shader implementing the effect, as a self-contained
   module in `packages/core-engine/src/filters/`. It must accept the working
   bitmap texture and any parameters as uniforms.
3. Register the shader in the pipeline's filter registry — a lookup from
   `FilterId` to its shader module. Do **not** modify the fixed pipeline
   ordering logic itself (color→brightness→contrast→saturation→structural);
   the new filter slots into the existing "structural filter" stage unless
   there's a specific reason it belongs elsewhere (justify that in the PR
   description if so).
4. Classify its relative performance cost (Very Low/Low/Medium/High per the
   table in
   [03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md#relative-cost-carried-from-source-spec-626-informs-render-budget))
   and wire it into `PerformanceMode` gating if High.
5. Add the UI control (toggle + any parameter sliders) to the Filters panel,
   with a label by default (no icon-only controls, per
   [`ki-simplicity-first`](../knowledge/ki-simplicity-first.md)).
6. Add it to the visual regression test-image set.
7. If it's a good candidate for a starter Preset (e.g. matches a medium in
   the recommended-settings table), consider adding it there too — but this
   is optional, not required for the filter itself to ship.

## Explicitly do not

- Change the fixed pipeline stage order.
- Touch the Grid Engine.
- Implement it as a CPU (Canvas2D pixel-manipulation) pass unless you've
  confirmed it genuinely can't be expressed as a GPU shader — CPU filters on
  large working bitmaps will blow the 100ms preview budget.

## Verification

Run through the full testing checklist in
[build-filter-pipeline.md](build-filter-pipeline.md) — this recipe doesn't
replace it, it's a scoped subset of the same procedure for a single new
filter.
