# Phase 3 — Full Filter Suite, Presets & Export Profiles

**Platform:** Web only.
**Estimated duration:** 3–4 weeks.
**Depends on:** [Phase 2](phase-2-cloud-projects-sync.md) — presets need the
Projects/sync data model to be persistable and syncable.

## Goal

Complete parity with the source app's full filter/preset/export feature set
(source spec Stages 4, 5, 6), closing the gap left by Phase 1's
grayscale-only placeholder, and add the reusable-preset workflow the source
app's own audit flagged as its biggest repeated-friction pain point
(source spec §9.10: "Repeated setup" — High severity, High frequency).

## Features in scope

**Full filter suite** ([03](../architecture/03-image-processing-filters.md))
- [ ] Threshold, Posterize, Pencil Sketch, Edge Detection, Invert, Blur,
      Sharpen — each as a WebGL shader pass per the fixed pipeline order.
- [ ] Performance-tiered rollout: low-cost filters first, Edge
      Detection/Pencil Sketch validated against the <100ms preview NFR last
      (they're the two flagged "High" cost in source spec §6.26).
- [ ] Seed the medium-based recommended-settings table (source spec §4.17)
      as quick-apply suggestions in the Filters panel.

**Presets** ([08](../architecture/08-project-sync-backend.md), FR-02)
- [ ] Save current grid config + filter stack + export settings as a named
      Preset ("Portrait Fine Grid", "Graphite Sketch", etc.).
- [ ] Apply, rename, edit, delete a Preset.
- [ ] Synced across devices (Presets are workflow data, per the sync-scope
      table in [08](../architecture/08-project-sync-backend.md)).
- [ ] Seed a starter library from the medium-based table in
      [03-image-processing-filters.md](../architecture/03-image-processing-filters.md#recommended-presets).

**Export profiles** ([07](../architecture/07-export-engine.md))
- [ ] Named `ExportSettings` presets: Original, Print A4, Classroom,
      High-Res, Transparent-Grid.
- [ ] Export history record (what was exported, when, with which settings).

## Explicitly out of scope

PDF/SVG export (deferred, [Phase 6](phase-6-advanced-guides-ai-stretch.md)),
Android, AI-suggested settings (source spec's "AI Reference Optimizer" —
explicitly a Phase 6/stretch item).

## Exit criteria

- [ ] Every filter from the source spec's Stage 6 reference is implemented
      and passes a visual regression check against a fixed test-image set.
- [ ] Full-resolution export re-run of the pipeline is measured < 5s for a
      12MP image on reference hardware (validates the NFR from
      [07-export-engine.md](../architecture/07-export-engine.md)).
- [ ] A user can save a Preset on one device and apply it, synced, on
      another.
- [ ] All five export profiles produce visibly distinct, correctly
      configured output.
