# Phase 12 — Cell Focus, Touch Lock, Pencil & Drawing Check

**Status: specified (2026-11-07), not started.** Full spec:
[issue #2](https://github.com/issaczerubbabela/Artiso-Revamped/issues/2).
Terms: [`GLOSSARY.md`](../../GLOSSARY.md).

**Depends on:** [Phase 11](phase-11-canvas-rotation-ipad-chrome.md).

## Decisions (made with the user)

- **Cell Focus**: dim the rest (default 70%, adjustable), ← → in grid order,
  auto-pan only when off screen, tap-to-focus only while focus is on; **Done
  Cells** with a count, optional skip, cleared (with Undo) on cell-size/paper
  change; device-local, per pane; unavailable without squares.
- **Touch Lock**: separate from Presentation; cell controls and Pencil hover
  still work; 1s press to unlock.
- **Pencil-only Drawing**: auto on at first pen stroke, device-local switch.
  Pressure → width only. Hover → crosshair, cell outline, label. No tilt.
- **Measurement** in the Draw panel: paper units + cells, axis snap on hold,
  never saved.
- **Drawing Check**: **Check Photo** from iPad or phone, synced, latest only,
  private to the uploader, 4-corner alignment with loupe, opacity +
  hold-to-swap. New table/storage + RLS — schema change, needs a clean
  revert-point commit first. ADR:
  [`0001-check-photos-synced-apart-from-the-reference`](../adr/0001-check-photos-synced-apart-from-the-reference.md).
- Touch shortcuts: double-tap fit/reset, two-finger tap undo (Draw),
  three-finger tap grid.

## Checklist

- [ ] Core-engine cell queries, distance, invalidation rule, homography + tests.
      (Homography + tests done with the Drawing Check, #9; cell queries and the
      invalidation rule done with Cell Focus, #7 — distance is left for
      Measurement.)
- [x] Cell Focus overlay, controls, Done Cells, persistence (#7).
- [ ] Touch Lock.
- [ ] Pencil-only routing, pressure width, hover overlay.
- [ ] Measure.
- [x] ADR + Check Photo schema, Supabase migration, RLS, sync.
- [x] Drawing Check capture, alignment, comparison.
- [ ] Touch shortcuts; canvas-menu items wired.

## Exit criteria

- [ ] Phase 12 e2e specs pass in `chromium` and `webkit`; core-engine and
      api-client tests pass.
- [ ] Real-iPad pass (Pencil hover/pressure, palm resting, camera + loupe,
      phone→iPad Check Photo).
