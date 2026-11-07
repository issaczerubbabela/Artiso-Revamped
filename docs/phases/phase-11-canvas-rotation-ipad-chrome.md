# Phase 11 — View Rotation, Native-Feel Gestures & iPad Chrome

**Status: specified (2026-11-07), not started.** Full spec, user stories and
testing decisions: [issue #1](https://github.com/issaczerubbabela/Artiso-Revamped/issues/1).
Terms: [`GLOSSARY.md`](../../GLOSSARY.md). Activated by direct user instruction
after Phase 10; the user draws beside an iPad Air 11" (M4) + Apple Pencil Pro,
landscape on a stand.

**Depends on:** [Phase 10](phase-10-installable-web-app.md).

## Decisions (made with the user)

- **View Rotation only** — free-angle, view state, device-local per reference;
  never exported, synced or written to the EditStack. No image straightening.
  `Rotate (edit)` stays 0/90/180/270. (ADR to be written.)
- One gesture: pinch + pan + twist; ~10° rotation dead zone; snap to 0/90/180/270
  within 5°; angle in the zoom pill (tap resets); double-tap fits and resets;
  Lock-rotation switch; labels stay upright; 0° while the Paper tool is open;
  Presentation keeps the angle; works in real size.
- Pan momentum + zoom spring-back, no rotation momentum, all off under Reduce
  Motion — a new *motion that follows a gesture* exception in `design.md`.
- Same engine on desktop (trackpad, Ctrl+wheel, Shift+drag).
- iPad patterns inside Dark Matte Studio: popovers (Adjust, Rotate/Flip,
  Presets, Draw), side column (Grid, Filters, Export) on Wide and bottom sheet
  on Regular/Compact, sheets with peek/half/full, long-press canvas menu,
  San Francisco / SF Mono on Apple platforms, Phosphor kept, both accents kept.

## Checklist

- [ ] ADR: View Rotation is view state; `design.md` amendments.
- [ ] Viewport rotation (pure) + unit tests.
- [ ] Gesture engine with injectable clock (dead zone, snap, momentum).
- [ ] Desktop input mapping.
- [ ] Device-local angle store, zoom-pill angle, mode rules.
- [ ] Popovers, sheet heights, Regular-breakpoint sheet for large panels.
- [ ] Long-press canvas menu.
- [ ] Apple font stack, icon weights.

## Exit criteria

- [ ] Phase 11 e2e specs pass in `chromium` and `webkit`; viewport and gesture
      unit tests pass.
- [ ] Real-iPad pass on the branch preview (gesture feel, Reduce Motion, fonts,
      popovers/sheets in both orientations).
