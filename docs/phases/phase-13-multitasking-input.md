# Phase 13 — Multitasking, Paste/Drop, Orientation Memory & Shortcuts

**Status: in progress.** Issue #10 (multitasking, orientation memory,
paste/drop/HEIC) built 2026-11-07; issue #11 (shortcuts, Gestures & shortcuts
card, first-run hint) not started. Full spec:
[issue #3](https://github.com/issaczerubbabela/Artiso-Revamped/issues/3).
Terms: [`GLOSSARY.md`](../../GLOSSARY.md).

**Depends on:** [Phase 11](phase-11-canvas-rotation-ipad-chrome.md),
[Phase 12](phase-12-drawing-companion.md).

## Decisions (made with the user)

- Split View / Slide Over / Stage Manager: existing breakpoints by window width
  (Compact below 768px); no iPad-only layout.
- Landscape and portrait each remember zoom, pan and View Rotation per
  reference, device-local.
- Paste and drop open new reference tabs; HEIC accepted where the browser
  decodes it, otherwise a "convert to JPEG" message.
- Shortcuts: G, F, 0, R, ← →, Space-hold peek, ⌘Z, ⌘V (Ctrl elsewhere);
  ignored in text fields. Gestures & shortcuts card on ⌘-hold, `?` and the
  menu; one-time empty-canvas hint. No page-turner pedal.

## Checklist

- [x] Narrow-window layout verification and fixes (`e2e/multitasking.spec.ts`
      at 320, 507, 694 and 820; a resize keeps the content at the visible
      centre across breakpoints).
- [x] Per-orientation view store (migrates the Phase 11 angle)
      (`apps/web/src/state/orientation-view-store.ts`, pure logic in
      `packages/renderer/src/orientation-views.ts`).
- [x] Shared paste/drop import entry, HEIC handling
      (`apps/web/src/session/import-files.ts`, `e2e/paste-drop.spec.ts`).
- [ ] Shortcut registry + Gestures & shortcuts card + first-run hint.

## Known limitations (issue #10)

- There is no tab limit in the app, so a large drop opens that many tabs.
- Opening a HEIC original synced from another device fails with the "convert
  it to JPEG" message on a browser that can't decode HEIC.
- Playwright's WebKit on Windows stops compositing a WebGL canvas once it has
  been resized, so the e2e comparisons after a resize read the grid and
  annotation layers (Canvas2D) rather than the photo. Real Safari is checked
  on the iPad.
- A reload fits the reference at the remembered angle for the current
  orientation; the stored zoom and pan come back on the next turn of the
  device, not on reload.

## Exit criteria

- [ ] Phase 13 e2e specs pass in `chromium` and `webkit`.
- [ ] Real-iPad pass (Split View, Slide Over, Stage Manager, drag from Photos
      and Safari, HEIC from Files, hardware keyboard).
