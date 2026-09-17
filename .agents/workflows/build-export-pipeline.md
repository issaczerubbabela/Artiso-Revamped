# Workflow: Build the Export Pipeline

Architecture: [docs/architecture/07-export-engine.md](../../docs/architecture/07-export-engine.md)

## Trigger

Implementing export/save/share, or adding a new export format/profile.

## Preconditions

- The filter pipeline ([build-filter-pipeline.md](build-filter-pipeline.md))
  and grid renderer ([build-grid-overlay-renderer.md](build-grid-overlay-renderer.md))
  both exist and are pure functions of `(bitmap dimensions, EditStack,
  GridConfig)` — export depends entirely on this purity.

## Procedure

1. **Re-run, don't reimplement.** Export must call the *exact same*
   `core-engine` functions the live preview uses (crop/rotate/flip
   application, filter shader chain, grid geometry generation) — the only
   difference is the input resolution (full original asset, not the capped
   working bitmap). If you find yourself writing export-specific filter or
   grid code, stop — that's the specific pitfall this module exists to
   avoid (see [07-export-engine.md](../../docs/architecture/07-export-engine.md#why-a-separate-full-resolution-pass)).
2. **Fetch the original asset**, not the in-memory working bitmap, as the
   export pipeline's input.
3. **Composite off-screen.** Run the WebGL filter pass and Canvas2D grid
   pass against off-screen canvases at full resolution — no viewport
   transform applied (export is always "whole image," not the current
   pan/zoom framing).
4. **Apply `ExportSettings`**: `includeAdjustments: false` means skip the
   filter pipeline stage entirely (geometry-only crop/rotate/flip, original
   tones); `includeGrid: false` means skip the grid compositing step.
5. **Encode and compress** per `format`/`quality`, then hand the resulting
   `Blob` to `PlatformAdapter.saveFile()` or `.share()` — never touch
   browser download APIs or Capacitor filesystem APIs directly from this
   module.
6. **Record export history** (what settings, when) via the same
   Projects/sync data layer used elsewhere — don't invent a separate
   history mechanism.
7. **When adding a new export profile**, add it as a named `ExportSettings`
   preset — do not add profile-specific branches inside the encode/composite
   code.

## Files/modules touched

`packages/core-engine/src/export/*`, `apps/web/.../ExportPanel/*`,
`PlatformAdapter.saveFile`/`.share` call sites.

## Testing checklist

- [ ] Export output visually matches the live preview at the moment of
      export (same crop/filters/grid), just at higher resolution — this is
      the core correctness property of this module.
- [ ] 12MP image export completes in < 5s on reference hardware.
- [ ] `includeGrid`/`includeAdjustments` toggles produce correctly
      different output.
- [ ] Each export profile (Original/Print A4/Classroom/High-Res/
      Transparent-Grid) produces distinct, correct output.
- [ ] Web download and (once Phase 4 lands) Android save-to-gallery + share
      sheet both work via the same `PlatformAdapter` call.

## Common pitfalls

- Re-deriving crop/filter/grid logic specifically for export "because
  resolution is different" — this is the #1 way export silently drifts out
  of sync with what the user actually saw and approved.
- Running the full-resolution pass on the main thread and blocking the UI —
  use a Worker or ensure the WebGL work is async/non-blocking.

## Related knowledge items

[`ki-non-destructive-editing`](../knowledge/ki-non-destructive-editing.md)
— export is the moment the non-destructive stack finally gets "baked," and
it must bake exactly what was previewed.
