# Workflow: Build Canvas Zoom/Pan & Gesture Handling

Architecture: [docs/architecture/05-canvas-renderer.md](../../docs/architecture/05-canvas-renderer.md),
[docs/architecture/06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md)

## Trigger

Implementing or modifying the viewport (pan/zoom) or the input handling that
drives it — touch, mouse, wheel, or keyboard.

## Preconditions

- Renderer's `Viewport` interface (`setZoom`, `panBy`, `zoomToFit`, `reset`)
  exists as a stub if not yet implemented.

## Procedure

1. **One input controller, Pointer Events only.** Do not write separate
   `touchstart`/`mousedown` handlers — use the unified Pointer Events API so
   touch and mouse drive the exact same code path. This was a deliberate
   architecture decision (input devices review) — don't reintroduce a
   touch/mouse fork.
2. **Implement gestures in this order, each independently testable:**
   - Single-pointer drag → `panBy`.
   - Two-pointer pinch (distance delta) → `setZoom`, anchored at the pinch
     midpoint.
   - Wheel event (desktop) → `setZoom`, anchored at cursor position.
   - Double-tap / double-click (detect via timing between two pointerup
     events at roughly the same location) → toggle `zoomToFit` / previous
     zoom level.
3. **Add desktop keyboard shortcuts** per the table in
   [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md#keyboard-shortcuts-new--the-source-app-has-no-keyboard-this-is-a-genuine-desktop-only-addition) —
   these are net-new, the source app has no keyboard input to preserve
   parity with, so this is a pure desktop UX addition, not a port.
4. **Respect Gesture Lock.** Before dispatching any pan/zoom gesture, check
   the workspace's `gestureLock` flag (Settings) — when locked, pan/zoom
   input is ignored (but tap/click on UI controls still works).
5. **Transform-only, never geometry-recompute.** Confirm that none of the
   above gesture handlers call into `GridEngine` or the filter pipeline —
   they only ever call `Viewport` methods. See
   [build-grid-overlay-renderer.md](build-grid-overlay-renderer.md) for why.
6. **Resize handling.** On container resize (breakpoint change, window
   resize, device rotation), preserve the current framing rather than
   resetting the viewport — recompute the transform to keep the same
   image region centered/visible.

## Files/modules touched

`packages/renderer/src/viewport.*`, `packages/renderer/src/inputController.*`,
`apps/web/.../useKeyboardShortcuts.*`.

## Testing checklist

- [ ] Pinch-zoom and wheel-zoom both anchor correctly (image point under the
      cursor/pinch-center stays fixed).
- [ ] Pan works identically via touch drag and mouse drag (space-held or
      middle-click).
- [ ] Gesture Lock correctly suppresses pan/zoom but not other input.
- [ ] Breakpoint transition (Compact ↔ Wide) does not reset zoom/pan state.
- [ ] 60fps maintained during continuous pan/zoom on reference hardware.

## Common pitfalls

- Handling touch and mouse as separate code paths — doubles maintenance and
  is exactly what Pointer Events was chosen to avoid.
- Anchoring zoom at the canvas center instead of the cursor/pinch point —
  feels wrong to anyone used to standard image-viewer zoom behavior.
- Not accounting for `devicePixelRatio` when converting pointer coordinates
  to image-space, causing a zoom-anchor drift on high-DPI displays.

## Related knowledge items

[`ki-canvas-first-design`](../knowledge/ki-canvas-first-design.md),
[`ki-immediate-feedback`](../knowledge/ki-immediate-feedback.md).

## Phase 9 note — mm scale, Real size, CSS-px input

Extends this workflow per
[phase-9](../../docs/phases/phase-9-drawing-grid-overhaul.md) and
[`Grid-Feature-Spec.md`](../../docs/architecture/Grid-Feature-Spec.md) §10:

- `scale` is **CSS px per mm** on the paper; minimum zoom = fit paper. Pointer
  coordinates, viewport state and layout are all CSS px (the DPR pitfall above
  is resolved by construction; canvases draw under `setTransform(dpr, …)`).
- Add **Fit** and **Real size (1:1)** per pane, plus a "1:1" badge. Real size
  uses the device-local calibration (`physicalPpi`, `pxPerMmCss`) and keeps the
  viewport centre fixed; if uncalibrated, open the calibration dialog first.
- "Gestures never call the GridEngine" stays true for line geometry.
  Repositioning sticky labels on every pan/zoom frame is expected and is not a
  geometry recompute.
- Testing: `setRealSize` keeps the centre, min-zoom clamp = fit paper, and
  pan/zoom anchoring at `deviceScaleFactor: 2`.
