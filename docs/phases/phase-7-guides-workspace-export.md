# Phase 7 — Advanced Guides, Multi-Reference Workspace, Annotation & Export

**Platform:** Web only. Android/iOS platform work stays out of scope for this
phase (see [Deferred](#deferred) below).

**Depends on:** [Phase 3](phase-3-filters-presets-export.md) (full filter
suite, Presets, export profiles). Phase 4/5 (Android shell/hardening) are
explicitly **skipped for now** by direct user decision — this phase does not
depend on them and isn't blocked by their absence.

**Activated:** by explicit user instruction, pulling most of
[Phase 6](phase-6-advanced-guides-ai-stretch.md)'s candidate list into active
scope in one pass, per that file's own "process for pulling an item into
active scope." AI-assist and platform items (iOS shell) remain deferred (see
below); each remaining item still gets its own one-page addendum note in the
relevant `architecture/` doc as it's implemented, per that process's step 1.

## Goal

Everything in Phase 6's candidate list except AI-assist and new native
platform shells: advanced grid/guide types, a desktop-first multi-reference
workspace, an annotation layer, a presentation/classroom display mode, and
PDF/SVG export. Collaborative/shared Projects is explicitly **not** included
here -- Phase 6's own text flags it as needing the last-write-wins conflict
model revisited first, which is a design decision, not an implementation
task; see [Deferred](#deferred).

## Checklist

**Guides** ([04-grid-engine.md](../architecture/04-grid-engine.md),
[.agents/workflows/add-new-grid-type-recipe.md](../../.agents/workflows/add-new-grid-type-recipe.md))
- [x] Perspective grids (one/two/three-point)
- [x] Radial grids
- [x] Golden Ratio / Rule of Thirds overlays
- [x] Layered grids (major + minor simultaneously) -- implemented as an
      optional `secondaryGridConfig` on Reference, rendered as a second
      overlay pass by `GridLayer.draw()`'s new `layers` array, per the
      recipe's "composition, not a new type" rule

**Export** ([07-export-engine.md](../architecture/07-export-engine.md))
- [ ] SVG grid-only export (vector, print-shop friendly)
- [ ] PDF export

**Workspace**
- [ ] Annotation layer (arrows, circles, notes) -- the first real use of
      stylus/pressure input, which the Canvas Renderer was deliberately left
      input-source-agnostic to accommodate
      ([05-canvas-renderer.md](../architecture/05-canvas-renderer.md))
- [ ] Presentation/classroom mode (large labels, high-contrast, locked
      gestures) for the Art Teacher persona
- [ ] Multi-reference workspace (split-view, tabs) -- desktop-first per the
      original reviewer decision; mobile stays single-reference

## Deferred

- **AI-assist** -- explicitly excluded by direct user instruction for this
  pass, not just left for later opportunistically.
- **iOS shell** -- no Mac/Xcode available in this environment; same
  practical constraint that's holding back Android in Phase 4/5, which this
  phase doesn't depend on or touch.
- **Collaborative/shared Projects** -- needs the last-write-wins conflict
  model in
  [08-project-sync-backend.md](../architecture/08-project-sync-backend.md#conflict-resolution-last-write-wins-explicit-simplifying-assumption)
  revisited first; that's a design conversation, not something to implement
  without the user weighing in on the tradeoff.

## Exit criteria

- [x] Each new grid type generates correct geometry headlessly-tested in
      `core-engine`, and the renderer requires zero changes to draw it (per
      the grid-type recipe's own verification step -- if the renderer needed
      changes, the `GridGeometry {lines, labels}` abstraction was violated).
      Verified live via `apps/web/e2e/grid-types.spec.ts`; `GridLayer.draw()`
      did change signature (single geometry -> `layers[]`) to support
      layering, which is the recipe's explicitly-allowed exception, not a
      violation of the zero-changes-per-type rule.
- [ ] SVG and PDF export produce correctly-configured output for a
      representative reference, verified by inspection (structure/content),
      not just "a file was produced"
- [ ] Annotations persist as part of a Reference's non-destructive edit
      state and survive reload/resume, same guarantee as the rest of the
      EditStack
- [ ] Presentation mode is a workspace display toggle, not a fork of the
      component tree (CLAUDE.md: "adaptive, not two apps")
- [ ] Multi-reference workspace only changes desktop/Wide-breakpoint chrome;
      Compact/mobile stays single-reference, matching the reviewer's original
      split-view deferral rationale
