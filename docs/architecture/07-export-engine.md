# 07 — Export Engine

Package: `packages/core-engine` (full-res re-render) + `apps/web` (platform
output)

## Purpose

Bake the `EditStack` (crop/rotate/flip/adjustments/filters) and optionally
the grid overlay into a final raster output at **full source resolution**,
then save or share it. This is the one place the app deliberately steps
away from the downsampled working resolution used everywhere else.

## Why a separate full-resolution pass

The live Workspace always renders a **working bitmap** capped at ~2048px
long edge for interactive performance (see
[01-image-import.md](01-image-import.md#working-resolution)). Export must
re-run the *exact same* `core-engine` pipeline (geometry → adjustments →
filters → grid) against the **original, full-resolution** asset so the
export is a faithful, higher-fidelity match of what the artist saw — not a
separate code path that could drift out of sync. This is a specific
pitfall called out in
[`.agents/workflows/build-export-pipeline.md`](../../.agents/workflows/build-export-pipeline.md).

```
Original Asset (full resolution)
        │
        ▼
Re-run EditStack: Crop/Rotate/Flip → Adjustments → Filters   (same core-engine functions as live preview)
        │
        ▼
Grid Engine: regenerate geometry at full-res dimensions
        │
        ▼
Composite (image layer + grid layer, offscreen, no viewport transform)
        │
        ▼
Encode (PNG/JPEG) → Compress (quality setting)
        │
        ▼
Platform output: download / save to gallery / share
```

## Export settings (source spec §5.8 / §10.7 FR-07)

```ts
type ExportSettings = {
  format: "png" | "jpeg";           // PDF / SVG-grid deferred, see Phase 6
  quality: number;                   // 0-100, JPEG only
  includeGrid: boolean;
  includeAdjustments: boolean;       // false = export original geometry-only crop, no filters baked in
  profileId?: string;                // e.g. "print-a4", "classroom", "high-res", "transparent-grid"
};
```

Export **profiles** are just named presets over `ExportSettings` (source
spec's "Original / Print A4 / Classroom / High-Res / Transparent-Grid" list)
— stored the same way as filter/grid [Presets](08-project-sync-backend.md),
no separate data model needed.

## Platform output

| Platform | Mechanism |
| --- | --- |
| Web | `Blob` → `<a download>` for direct save; Web Share API where supported |
| Android | `@capacitor/filesystem` (save to Photos/gallery) + `@capacitor/share` (native share sheet) |

Both go through the same `PlatformAdapter.saveFile()` / `.share()` seam
described in [10-mobile-android-shell.md](10-mobile-android-shell.md).

## Performance target

12MP image export in **< 5s** (NFR carried from source spec §10.8/§11.15).
Full-resolution filter passes run on the same WebGL shader chain as the
live preview — GPU-bound, not CPU-bound — so this target is expected to hold
even on mid-range Android hardware; validated empirically in Phase 3 (see
[phase-3-filters-presets-export.md](../phases/phase-3-filters-presets-export.md)).

## Dependencies

- `core-engine`: same crop/filter/grid functions as live preview, parameterized
  by resolution.
- [Grid Engine](04-grid-engine.md), [Image Processing](03-image-processing-filters.md).
- `shared-types`: `ExportSettings`.
- [Projects/Sync](08-project-sync-backend.md): export history record (what
  was exported, when, with which settings) for the Recent/History view.

## Deferred

PDF export, SVG grid-only export (vector, useful for print-shop workflows),
layer-separated export. Listed in source spec §5.8/§11.5 as future — slot
into `ExportSettings.format` without touching the pipeline.
