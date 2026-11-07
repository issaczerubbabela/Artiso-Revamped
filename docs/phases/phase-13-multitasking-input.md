# Phase 13 — Multitasking, Paste/Drop, Orientation Memory & Shortcuts

**Status: specified (2026-11-07), not started.** Full spec:
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

- [ ] Narrow-window layout verification and fixes.
- [ ] Per-orientation view store (migrates the Phase 11 angle).
- [ ] Shared paste/drop import entry, HEIC handling.
- [ ] Shortcut registry + Gestures & shortcuts card + first-run hint.

## Exit criteria

- [ ] Phase 13 e2e specs pass in `chromium` and `webkit`.
- [ ] Real-iPad pass (Split View, Slide Over, Stage Manager, drag from Photos
      and Safari, HEIC from Files, hardware keyboard).
