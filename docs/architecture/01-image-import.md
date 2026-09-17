# 01 — Image Import Module

Package: `apps/web` (UI/pickers) + `packages/core-engine` (decode)

## Purpose

Get a photograph from wherever the artist keeps it into a `Reference` with a
decoded working bitmap, corrected orientation, and an empty `EditStack`,
handed off to the Workspace. This is the sole entry point into the app's
golden path (`Import → Prepare → Grid → Draw → Export`).

## Responsibilities

- Present a platform-appropriate source picker.
- Decode the source file into an `ImageBitmap`, applying EXIF orientation
  correction (source app's Module 1 responsibility: "handle image
  orientation").
- Produce a **working bitmap** (downsampled, capped resolution, used for all
  interactive editing) and retain a path to the **original** (full
  resolution, used only by Export).
- Generate a thumbnail for the Projects/Home library view.
- Create the `Reference` record (see [11](11-data-model-schema.md)) with an
  empty `EditStack` and hand control to the Workspace.

## Input sources by platform

| Source | Web | Android (Capacitor) |
| --- | --- | --- |
| File picker | `<input type="file" accept="image/*">` | `@capacitor/camera` `pickImages()` (gallery) |
| Drag & drop | Native HTML5 DnD onto canvas | n/a |
| Clipboard paste | `Ctrl+V` via Clipboard API | n/a |
| Camera capture | `getUserMedia` (stretch, low priority) | `@capacitor/camera` `getPhoto({source: Camera})` |

Selected via the `PlatformAdapter.pickImage()` seam — see
[10-mobile-android-shell.md](10-mobile-android-shell.md) for the adapter
pattern.

## Pipeline

```
Source (file / gallery / camera)
        │
        ▼
Read bytes → decode via createImageBitmap(blob, { imageOrientation: "from-image" })
        │
        ▼
Validate: format allow-list, dimension sanity, decode success
        │
        ▼
Downsample → Working Bitmap (long edge capped, see Working Resolution below)
        │
        ├─→ Thumbnail (e.g. 256px long edge, for library cards)
        │
        └─→ Register Asset (content-hash) → upload queued to Storage (see 08)
        │
        ▼
Create Reference { originalAssetId, editStack: [], gridConfig: defaults }
        │
        ▼
Hand off to Workspace
```

## Working resolution

Interactive editing (filters, grid preview, pan/zoom) always operates on a
downsampled **working bitmap**, not the original file, to hit the <100ms
adjustment-preview NFR on mid-range Android hardware. Default cap: **long
edge 2048px** (configurable via Performance Mode, see
[09](09-settings-preferences.md)). The original is preserved untouched and
is only re-processed at full resolution by the [Export
module](07-export-engine.md).

## Failure cases

| Case | Handling |
| --- | --- |
| User cancels picker | No-op, return to prior state |
| Unsupported format (e.g. HEIC on web) | Explicit error, suggest re-export as JPEG/PNG |
| Corrupted image | Decode failure caught, user-facing error, no partial Reference created |
| Out of memory / huge image (e.g. 100MP) | Pre-check dimensions before full decode; hard cap with a clear message rather than a WebView crash |
| Gallery/camera permission denied (Android) | Explicit rationale + link to system settings, matches spec 7.30's "disable rather than error" principle for the *rest* of the UI once no image is loaded |

## Dependencies

- `core-engine`: decode + downsample (pure function, unit-testable headlessly).
- `shared-types`: `Reference`, `Asset` schemas.
- `api-client`: queues the original for background upload (offline-first —
  import must succeed and be immediately editable with zero network).

## Open questions

- [ ] Exact working-resolution cap (2048px proposed) — validate against a
  mid-range Android WebGL context limit during Phase 1.
- [ ] Supported format allow-list for v1: JPEG, PNG, WebP. HEIC decode
  support (common on iPhone photos shared to Android/web) — evaluate a
  polyfill or defer with a clear error.
