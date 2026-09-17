# 06 — Workspace & Interaction Model

Package: `apps/web`

## Purpose

Owns the tool-mode state machine, the responsive chrome (which changes shape
by breakpoint), and translates user input into calls against the
[Canvas Renderer](05-canvas-renderer.md) and `core-engine` modules. This is
where the "adaptive layout by breakpoint" and "mouse+keyboard+touch" decisions
made during architecture review are implemented.

## Layout strategy: adaptive by breakpoint

**Decision (confirmed):** one codebase, two chrome modes, switched at a
breakpoint — not a separate mobile app and desktop app.

| Breakpoint | Width | Chrome |
| --- | --- | --- |
| Compact | < 768px | Bottom toolbar + bottom sheets/dialogs for tool panels (matches source app's touch-first pattern) — single column, canvas fills the rest |
| Regular (transitional) | 768–1023px | Collapsible side drawer (overlay, dismissible) instead of a bottom sheet, bottom toolbar remains for mode switching |
| Wide | ≥ 1024px | Persistent left icon rail (mode switch) + persistent right dock (active tool's config panel) — canvas keeps the remaining center space |

The same `WorkspaceState` (active tool mode, EditStack, viewport) drives
both chrome modes — only the *container component* rendering the active
panel differs (`<BottomSheet>` vs. `<SideDock>`), so no logic branches on
platform, only on `useBreakpoint()`.

This applies **per viewport width, not per OS** — a 10" Android tablet in
landscape gets the Wide chrome exactly like a desktop browser; a narrow
desktop browser window gets Compact chrome. Confirms the "treat desktop
layout as wide-viewport layout" principle raised during review.

## Tool-mode state machine (source spec §7.10, one mode at a time)

```
Idle/Home
  ├─ Import
  ├─ Crop
  ├─ Rotate/Flip
  ├─ Adjustments   (brightness/contrast/saturation)
  ├─ Filters
  ├─ Grid
  ├─ Export
  └─ Settings
```

Only one mode's controls are visible at a time (matches source spec §7.10 —
explicitly *not* a Photoshop-style simultaneous-palette model). Switching
modes never navigates away from the canvas.

## Context-aware toolbar (source spec §7.34, adopted as baseline)

| Workspace state | Enabled controls |
| --- | --- |
| No image loaded | Import only |
| Image loaded | Crop, Rotate, Flip, Adjustments, Filters, Grid |
| Grid enabled | Grid config surfaced/prioritized |
| Export mode | Export/Share options surfaced |

Disabled (not hidden) controls communicate state via Nielsen heuristic
"error prevention" — matches source spec §7.30's guidance to disable rather
than show errors.

## Toolbar redesign baseline (source spec §7.33, adopted)

Icons are **labeled by default** (not icon-only) — directly fixes the
source app's lowest-scoring usability heuristic (§9.5, "Recognition Rather
Than Recall," 6/10) at effectively zero cost. An icon-only *compact* density
option exists in Settings for returning users who no longer need labels,
but it is opt-in, not the default.

## Interaction model (extends source spec §2.19/§7.20-22 with desktop input)

| Interaction | Effect | Platform |
| --- | --- | --- |
| Tap / Click | Activate tool/button | Both |
| Touch drag | Pan (canvas) / move crop handle | Touch |
| Mouse drag (space held, or middle-click) | Pan (canvas) | Desktop |
| Pinch | Zoom | Touch |
| Scroll wheel | Zoom, anchored at cursor | Desktop |
| Double-tap / double-click | Toggle zoom-to-fit | Both |
| Slider drag | Live parameter update | Both |
| Arrow keys (handle focused) | Nudge crop handle 1px / 10px with Shift | Desktop |
| Keyboard shortcuts (table below) | Various | Desktop |

### Keyboard shortcuts (new — the source app has no keyboard, this is a
genuine desktop-only addition)

| Key | Action |
| --- | --- |
| `G` | Toggle grid visibility |
| `[` / `]` | Decrease / increase grid density |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / redo |
| `+` / `-` | Zoom in / out |
| `0` | Zoom to fit |
| `Space` (hold) + drag | Pan |
| `Esc` | Close active panel/dialog |

Not stylus/pressure-aware in this phase (per review decision) — the input
layer is pointer-event based, which leaves room to add pressure support
later without rearchitecting.

## Gesture Lock (source spec §5.4)

A setting that temporarily disables pan/zoom gesture handling on the canvas
— useful when an artist is repeatedly tapping/dragging near the canvas edge
(e.g. precise slider or crop-handle work) and doesn't want to accidentally
pan. Toggled from Settings or a quick-action; purely a workspace-state flag
consumed by the renderer's input controller.

## Undo/redo

`EditStack` is inherently a linear history — undo/redo is "pop/push the
last operation," no separate undo-stack data structure needed. This
directly addresses source spec's flagged weakness (§7.32/§9.5: "limited
undo history").

## Android back-gesture integration

When a bottom sheet/side drawer/dialog is open, Android back
(button/gesture) closes it via the same state the `Esc` key uses on
desktop — it does not exit the app unless the workspace is already at
Idle/Home. Implemented in [10-mobile-android-shell.md](10-mobile-android-shell.md).

## Dependencies

- [Canvas Renderer](05-canvas-renderer.md) — `Viewport` API.
- All editing modules ([02](02-image-editing.md), [03](03-image-processing-filters.md),
  [04](04-grid-engine.md)) — mode panels dispatch into their state.
- [Settings](09-settings-preferences.md) — Gesture Lock, Performance Mode,
  toolbar density.
