# Phase 9 — Drawing Grid Overhaul

**Platform:** Web (Compact and Wide). Android inherits it through the shared build.

**Depends on:** [Phase 8](phase-8-collaboration-split-view.md). Requirements:
[`Grid-Feature-Spec.md`](../architecture/Grid-Feature-Spec.md) — where it
conflicts with [`04-grid-engine.md`](../architecture/04-grid-engine.md) or the
crop description in [`02-image-editing.md`](../architecture/02-image-editing.md),
the spec wins. Activated by direct user instruction, following the Phase 7/8
precedent (addenda to the architecture docs + an invariants check, per the
"pulling an item into active scope" process in
[phase-6](phase-6-advanced-guides-ai-stretch.md)).

This is a **superseding rewrite of the primary grid**, not a new grid *type*,
so [`add-new-grid-type-recipe.md`](../../.agents/workflows/add-new-grid-type-recipe.md)
does not apply as written (its "renderer needs zero changes" and
`(width, height, config)` rules assume image-space geometry).

## Decisions (made with the user)

- **Old guides are kept.** Perspective / rule-of-thirds / golden-ratio and the
  layered second guide remain as a separate *Guides* layer drawn beneath the
  new grid. The spec's "one shared style" applies to the new grid only.
- **Storage:** new `Reference` fields `paper`, `crop`, `gridSettings`, with new
  Supabase columns and merge groups. Crop is a rectangle over the
  rotated/flipped original and is never baked into the bitmap. `Display`
  (dpi, screen calibration) is device-local (`localStorage`) and never synced.
- **Legacy references auto-migrate** to A4 defaults and open straight into a
  working grid.

## Decisions (made by the implementer; revisit if wrong)

- **Lazy migration, no SQL backfill.** The new columns are nullable. Migration
  runs when a session is built and `paper` is null (it needs the image
  dimensions), and persists on the next save. This also avoids the
  `references_version_guard`, which drops writes with a non-increasing
  version.
- **One "Paper & crop" tool mode** replaces the Crop mode. Import applies
  defaults (A4, orientation from image aspect, maximal centred crop, 300 DPI,
  squares + labels on) so the golden path is still one tap and the spec's
  "grid appears after paper + crop" gate is satisfied.
- **Crop-aware working bitmap.** Crop is stored in oriented-original pixels
  (exact at export). On crop commit the working bitmap is rebuilt from the crop
  region (long edge ≤ 2048) so a small crop of a large photo stays sharp.
- **Legacy `gridConfig` stays in the schema and the column** (additive sync;
  older clients still write it) but is ignored once `paper` is set.
- **Accepted losses on migration:** a legacy *layered* guide of type
  rectangular/radial is dropped (those types are no longer guides); a legacy
  crop is trimmed, centred, to the A4 ratio — the original pixels are
  untouched, so it can be re-expanded in the crop tool.

## Invariants check

| Invariant / KI | Status |
| --- | --- |
| Non-destructive | Holds. `paper`/`crop` are data replayed at render/export; the original asset is untouched; rotate/flip stay in the EditStack. |
| Grid/image independence | Holds with a documented carve-out: sticky labels reposition on pan/zoom (separate pure function of the view); line geometry never regenerates on pan/zoom; filters never trigger grid work. See the [KI revision](../../.agents/knowledge/ki-grid-image-independence.md). |
| Pipeline order | Unchanged: rotate/flip → crop region → adjustments → filters → grid. |
| Canvas-first | Calibration is a modal over the canvas, not a route; paper/crop are panel + on-canvas frame. |
| Sequential workflow | Import → Paper & crop → Grid → Draw; grid controls are gated on paper + crop (satisfied by import defaults). |
| Simplicity first | Defaults give a good result with no configuration; units, DPI, per-axis labels and calibration are secondary controls. |
| Immediate feedback | Sliders repaint within the frame budget; labels are recomputed per pan/zoom frame, bounded by index-range culling + density thinning. |
| Cross-device continuity | `paper`/`crop`/`gridSettings` sync additively with their own merge groups; calibration is per device by design (different physical screens). |

## Checklist

- [x] Docs activation: this file, architecture addenda (`00`, `02`, `04`, `05`,
      `06`, `11`), KI revision, workflow notes, README/CLAUDE.md staleness.
- [ ] Prerequisite: restore the design-token aliases the token rewrite dropped
      (`--font-family-base`, `--shadow-dock`). *Aliases added to `tokens.css`
      in the working tree; committing them is left to the token rewrite's
      author, since that file carries their uncommitted changes. The new
      controls, zoom pill and dialog also use the rewrite's new tokens
      (`--font-family-body`, `--font-family-mono`, `--panel-*`), so that
      rewrite needs to land with this phase.*
- [x] `shared-types`: `Unit`, `Paper`, `Crop`, `GridSettings`, `Display`;
      `Reference`/`Preset`/`User` additions.
- [x] `core-engine` pure functions: units, paper presets, crop clamp/recenter,
      real-size math, square grid, diagonals, radial rays, label scheme, label
      layout (pinning + density), legacy migration, framed-bitmap renderer, SVG.
- [x] `api-client` + Supabase columns (idempotent additions to
      `0001_phase2_schema.sql`, per the Phase 7/8 convention; **re-run it in the
      SQL editor**): persistence, row mappers, `framing` (paper + crop) and
      `gridSettings` merge groups.
- [x] `renderer`: CSS-px viewport with mm scale, min zoom = fit paper, Real
      size, DPR-consistent input; `DrawingGridLayer`; crop constraint and frame.
- [x] `apps/web`: store/session/import plumbing, crop-aware bitmap, per-pane
      view controls (Fit / Real size / 1:1 badge), calibration dialog, shared
      control primitives, Paper & crop panel, Grid panel + Guides section.
- [x] Paper-aware raster, SVG and PDF export (native crop resolution; SVG/PDF in
      real millimetres).
- [x] Playwright coverage of the golden path at Compact and Wide, plus paper,
      crop, grid settings, zoom/calibration and the legacy migration.
- [x] Removal of the superseded rectangular/radial generators and per-cell
      numbering. (The retired guide types still parse -- an older client can
      write them -- and draw nothing.) The rows x cols panel, the thickness button
      group and the `viewportResetSignal` were removed with the workspace rewrite.

## Exit criteria

Each maps to an item in the spec's §12 acceptance checklist. "Verified by" names
the test that guards it.

- [x] Image → paper → crop works; crop is aspect-locked and non-destructive.
      *`paper/__tests__/crop.test.ts`, `renderer/__tests__/viewport.test.ts`
      (crop constraint), e2e `paper-crop-grid.spec.ts` (panning moves the crop,
      never resizes it; nothing is baked into the EditStack).*
- [x] Portrait/landscape and presets work; custom size in mm / cm / in / px;
      choosing px shows the DPI explanation. *`units.test.ts`, `presets.test.ts`,
      e2e (custom size, unit conversion, DPI text verbatim).*
- [x] Squares start top-left; right/bottom cells are partial (cut, not
      stretched) when the size isn't a multiple. *`square-grid.test.ts`,
      `diagonals.test.ts`.*
- [x] Labels sit on all four edges only (partial cells included), are small
      translucent rectangles with centred text, stay pinned while panning and
      zooming, and thin out rather than overlap. *`label-layout.test.ts`,
      `drawing-grid-layer.test.ts`.*
- [x] Columns and rows independently use numbers or letters. *`label-scheme.test.ts`,
      e2e.*
- [x] Diagonals: one toggle, X in every square (45° in partial cells).
      *`diagonals.test.ts`.*
- [x] Radial: from the exact paper centre to the edges, adjustable step, no
      circles. *`radial-rays.test.ts`.*
- [x] One shared colour / thickness / opacity for all new-grid layers.
      *`drawing-grid-layer.test.ts`, e2e.*
- [ ] Real size (1:1) is accurate after calibration; Fit to screen works; each
      split pane has its own controls. *The maths (`real-size.test.ts`), the
      viewport behaviour and the UI flow are tested, and e2e checks the
      calibration ruler follows the density formula. **Still to do by hand:** hold
      a physical ruler to a real screen -- no automated test can.*
- [x] No live cursor readout anywhere. *e2e (moving over the paper changes
      nothing on the page).*
- [x] A pre-overhaul reference opens onto a working A4 grid. *`migrate-legacy.test.ts`
      (every rotate × flip × crop ordering), e2e `collaboration-ui.spec.ts`.*
- [x] Filters/adjustments do not regenerate the grid; paper or grid-settings
      changes do. *Structural: line geometry is a pure function of paper +
      settings; the stage only marks the frame dirty for edit-stack changes.*

## Known limitations (expected)

- Spec §13 items stay out of scope: margins (`marginMm` fixed at 0),
  per-layer styling, concentric circles, cell selection/progress tracking.
- Export is at native crop resolution with the enabled overlays, not a fixed
  paper × DPI raster (spec §13 marks that optional).
- Devices on an older client keep writing the legacy grid fields; a newer
  client ignores them once `paper` is set, so cross-version edits to the grid
  can diverge until both update.
- Annotations are stored normalized to the visible image. A migrated reference's
  crop is trimmed to the A4 ratio, so its annotations can sit slightly off.
- Clicking the other split pane within a fraction of a second of leaving the
  Paper & crop tool can drop that framing edit (the render finishes after focus
  has moved to a different reference).
