# Phase 6 — Advanced Guides, Multi-Reference, AI-Assist (Stretch)

**Platform:** Web + Android.
**Estimated duration:** Not estimated — this phase is a backlog of
independently-shippable items, not a single milestone, and is explicitly
**not committed scope** for this engagement. It exists so later feature
work has a documented landing spot consistent with the source spec's own
Stage 10/11 roadmap, rather than being bolted on ad hoc.

**Depends on:** [Phase 5](phase-5-android-parity-hardening.md) — a solid,
released core product.

## Why this phase exists

The reviewer explicitly deferred multi-reference/split-view here (see
[00-system-overview.md](../architecture/00-system-overview.md#8-open-decisions-for-reviewer-sign-off)),
and the source spec itself frames perspective guides, annotation, and AI
assistance as v4.5/v5.0 territory, not core-loop territory. Each item below
must be re-approved individually before implementation — this file is a
menu, not a plan.

## Candidate items (source spec §3.18, §5.15, §6.30, §10.7, §10.10, §11.5)

**Guides**
- [ ] Perspective grids (one/two/three-point).
- [ ] Radial grids.
- [ ] Golden Ratio / Rule of Thirds overlays.
- [ ] Layered grids (major + minor simultaneously).

**Workspace**
- [ ] Multi-reference workspace (split-view, tabs) — **desktop-first**
      per the reviewer's decision, given free screen space; mobile stays
      single-reference until proven otherwise.
- [ ] Annotation layer (arrows, circles, notes) — first real use case for
      stylus/pressure input, which the current
      [Canvas Renderer](../architecture/05-canvas-renderer.md) was
      deliberately left input-source-agnostic to accommodate.
- [ ] Presentation/classroom mode (large labels, high-contrast, locked
      gestures) for the Art Teacher persona.

**AI-assist** (source spec §11.11, three-phase roadmap: smart
brightness/contrast/grid recommendation → contour extraction/shadow
grouping/perspective estimation → pose/facial landmarks/material
recognition) — **always optional, never AI-dependent**, per source spec
§10.2's own stated product principle.

**Export**
- [ ] PDF export.
- [ ] SVG grid-only export (vector, print-shop friendly).

**Platform**
- [ ] iOS shell (near-zero-rewrite given the Capacitor architecture, see
      [10-mobile-android-shell.md](../architecture/10-mobile-android-shell.md#deferred)).
- [ ] Collaborative/shared Projects (requires revisiting the last-write-wins
      conflict model in
      [08-project-sync-backend.md](../architecture/08-project-sync-backend.md#conflict-resolution-last-write-wins-explicit-simplifying-assumption)
      before it can be built safely).

## Process for pulling an item into active scope

1. Write a one-page addendum to the relevant `architecture/` doc describing
   the change (these docs are living, not frozen after initial approval).
2. Confirm it doesn't violate any invariant in
   [00-system-overview.md §6](../architecture/00-system-overview.md#6-core-architectural-invariants-apply-to-every-module)
   or contradict a [Knowledge Item](../../.agents/knowledge/README.md).
3. Add a dedicated phase file (`phase-7-*.md` etc.) with the same structure
   as Phases 1–5 before implementation starts.
