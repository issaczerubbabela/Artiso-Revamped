# Phase 1 — Web Core MVP

**Platform:** Web only.
**Estimated duration:** 4–6 weeks.
**Depends on:** [Phase 0](phase-0-foundations.md).

## Goal

Reproduce the source app's entire golden path — `Import → Prepare → Grid →
Draw → Export` — as a local-only (no cloud sync yet) web app, on both
Compact and Wide layouts. This phase proves the core rendering architecture
(two-canvas compositor, non-destructive `EditStack`, grid/image
independence) before any sync complexity is layered on.

## Features in scope

**Image Import** ([01](../architecture/01-image-import.md))
- [ ] File picker, drag-and-drop, clipboard paste.
- [ ] EXIF orientation correction, working-bitmap downsampling, thumbnail
      generation.
- [ ] Error states: unsupported format, corrupted file, oversized image.

**Image Editing** ([02](../architecture/02-image-editing.md))
- [ ] Crop (draggable handles, touch + mouse via Pointer Events, aspect
      ratio lock, keyboard nudge on desktop).
- [ ] Rotate (90° increments), Flip (horizontal, vertical).

**Image Processing** ([03](../architecture/03-image-processing-filters.md))
- [ ] Brightness, Contrast, Saturation sliders — WebGL shader, live preview.
- [ ] Grayscale filter only for this phase (full filter suite is Phase 3).

**Grid Engine** ([04](../architecture/04-grid-engine.md))
- [ ] Row/column configuration (presets 4×4–12×12 + custom), color,
      opacity, thickness, numbering (numbers/letters/alphanumeric),
      visibility toggle.
- [ ] Correct recalculation triggers (geometry changes only, not filter
      changes).

**Canvas Renderer** ([05](../architecture/05-canvas-renderer.md))
- [ ] Two-canvas compositor (WebGL image layer + Canvas2D grid layer).
- [ ] Pan/zoom via touch pinch/drag, mouse wheel/drag, keyboard shortcuts.
- [ ] Dirty-flag render loop.

**Workspace** ([06](../architecture/06-workspace-interaction.md))
- [ ] Adaptive chrome: bottom sheets (Compact) and side dock (Wide),
      switching at the defined breakpoints.
- [ ] Context-aware toolbar (Import-only until an image is loaded, etc.).
- [ ] Labeled-by-default toolbar icons.
- [ ] Undo/redo (linear `EditStack` pop/push).
- [ ] Full keyboard shortcut table.

**Export** ([07](../architecture/07-export-engine.md))
- [ ] PNG/JPEG export at full source resolution, include-grid toggle,
      browser download.

**Local persistence**
- [ ] IndexedDB storage of Projects/References — local-only, no cloud yet.
      This is the local half of the sync architecture in
      [08](../architecture/08-project-sync-backend.md), built first so
      Phase 2 only adds the network layer on top of an already-correct
      local model.

## Explicitly out of scope

Cloud sync, accounts, presets library, full filter suite (edge detect,
pencil sketch, threshold, posterize, sharpen, blur — Phase 3), export
profiles beyond PNG/JPEG, Android.

## Exit criteria

- [ ] A user can complete the full golden path with zero network connection.
- [ ] Adjustment slider drag reflects in the canvas in < 100ms (measured).
- [ ] Grid redraw holds 60fps during pan/zoom (measured, Compact and Wide).
- [ ] Crop/rotate/flip correctly triggers grid recalculation; adjustment
      changes do not.
- [ ] Exit an editing session and resume it (IndexedDB persistence) without
      data loss.
- [ ] All P0 accessibility targets met: touch targets ≥ 44px, labeled icons,
      keyboard navigable.
