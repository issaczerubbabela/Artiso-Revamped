# Workflow: Build the Image Import Pipeline

Architecture: [docs/architecture/01-image-import.md](../../docs/architecture/01-image-import.md)

## Trigger

Implementing or modifying how an image enters the app (file picker,
drag-drop, clipboard paste, camera capture) — Phase 1 / Phase 4 work.

## Preconditions

- `packages/shared-types` has the `Reference`/`Asset` schemas.
- `packages/core-engine` package exists and can run headless (no DOM
  dependency) per Phase 0.

## Procedure

1. **Decode, don't assume.** Implement decode as a pure `core-engine`
   function: `decodeImage(blob: Blob): Promise<ImageBitmap>` using
   `createImageBitmap(blob, { imageOrientation: "from-image" })` so EXIF
   rotation is corrected at decode time, not left for the renderer to guess.
2. **Validate before you commit resources.** Check the blob's declared MIME
   type against the format allow-list, and probe dimensions cheaply (e.g.
   via `createImageBitmap` failure/dimension check) before allocating a full
   working-resolution copy — reject oversized/corrupt input early with a
   specific, user-facing error, not a generic failure.
3. **Downsample immediately.** Produce the working bitmap at the configured
   cap (default long-edge 2048px, see
   [Performance Mode](../../docs/architecture/09-settings-preferences.md))
   right after decode — never hold a full-resolution bitmap in the
   interactive editing path. Keep only a reference (storage key / local
   blob handle) to the original for [Export](build-export-pipeline.md) to
   re-fetch later.
4. **Generate the thumbnail** (small, e.g. 256px long edge) in the same pass
   as the working bitmap — don't re-decode the source a second time.
5. **Create the `Reference`** with an empty `editStack: []` and the default
   `GridConfig` (from the signed-in user's synced defaults if available,
   otherwise app defaults) — see
   [09-settings-preferences.md](../../docs/architecture/09-settings-preferences.md).
6. **Hand off to Workspace**, not directly to the renderer — the Workspace
   owns tool-mode state and transitions into an editing mode once the
   Reference exists.
7. **Wire the platform adapter.** Use `PlatformAdapter.pickImage()` for the
   actual source selection UI — do not call browser file-input APIs or
   Capacitor camera APIs directly from this module; that's the one seam
   platform branching is allowed to live in (see
   [10-mobile-android-shell.md](../../docs/architecture/10-mobile-android-shell.md)).

## Files/modules touched

`packages/core-engine/src/import/*`, `apps/web/.../PlatformAdapter.*`,
`apps/web/.../ImportPanel/*` (or equivalent UI component), IndexedDB
persistence call for the new `Reference`.

## Testing checklist

- [ ] Unit test: decode + downsample is a pure function, tested headlessly
      with fixture images (including a rotated-via-EXIF fixture).
- [ ] Reject-path tests: corrupted file, unsupported format, oversized
      dimensions — each produces a specific error, not a crash.
- [ ] Manual: import on both Compact and Wide layouts, and (once Phase 4
      lands) via the Capacitor camera/gallery picker.
- [ ] Confirm the working bitmap is capped correctly and the original
      reference is preserved and later retrievable by Export.

## Common pitfalls

- Applying EXIF correction in the renderer instead of at decode time —
  causes the crop/grid geometry to be computed against the wrong
  orientation.
- Holding the full-resolution bitmap in memory "just in case" — defeats the
  whole point of the working-resolution cap and risks OOM on Android.
- Branching on `Capacitor.isNativePlatform()` inside this module instead of
  inside `PlatformAdapter` — scatters platform checks across the codebase.

## Related knowledge items

[`ki-simplicity-first`](../knowledge/ki-simplicity-first.md) (import must
stay one or two taps/clicks), [`ki-non-destructive-editing`](../knowledge/ki-non-destructive-editing.md)
(original is never mutated from this point forward).
