# ADR 0002 — View Rotation is view state, not an edit

**Status:** Accepted (2026-11-07). Implemented in issue #5, Phase 11
([spec #1](https://github.com/issaczerubbabela/Artiso-Revamped/issues/1),
[phase doc](../phases/phase-11-canvas-rotation-ipad-chrome.md)).
Terms: [`GLOSSARY.md`](../../GLOSSARY.md).

## Context

The artist draws by hand beside an iPad on a stand and keeps turning their
paper as they work. The reference on screen could only be turned in 90° steps
(**Rotate (edit)**), so it stopped matching the paper. They asked for the
reference to turn to any angle, the way paper turns on a desk.

There were two ways to give them that:

1. **Straighten the image** — a free-angle rotation recorded in the EditStack
   next to Rotate (edit), applied by the image pipeline, synced, and exported.
2. **View Rotation** — an angle in the viewport transform only, like pan and
   zoom: the image, crop and grid turn together on screen, and nothing about
   the reference itself changes.

## Decision

View Rotation is **view state**:

- It lives in the viewport transform
  (`screen = translate + scale · R(rotation) · content`), which every layer
  projects through; it never touches the image pipeline or grid generation
  (invariant 2, grid/image independence).
- It is stored **device-locally, per reference**
  (`apps/web/src/state/orientation-view-store.ts`, localStorage), alongside the
  other device-local display settings. Lock rotation is device-local too.
  *Amended by issue #10 (Phase 13):* the store now keeps one view per
  reference **per orientation** (landscape / portrait) -- zoom, pan and View
  Rotation -- with the earlier single angle migrated into both. It is still
  view state under every rule below.
- It is **never written to the EditStack, never synced, never exported**.
  Exports always draw at 0°; their output is byte-identical at any angle.
- **Rotate (edit)** is unchanged: 0/90/180/270, recorded in the EditStack,
  synced and exported. The schema is untouched.

Straightening the image was **rejected**.

## Why

- **The angle describes the device, not the reference.** It says how this
  screen is turned relative to the artist's paper right now. An iPad on a
  stand and a laptop on a desk sit at different angles; syncing one device's
  angle to the other would turn the second device's view for no reason
  (user story 18).
- **An edit would be hard to reverse and would surprise without context.** A
  free-angle edit resamples the image, adds empty corners that must be
  cropped or filled, and is baked into every export. A collaborator or the
  artist's other device would open the reference tilted with no idea why.
  Undoing it means finding and removing an EditStack entry rather than
  tapping the angle in the zoom pill.
- **It keeps editing non-destructive and cheap.** Turning the view is a
  transform change at 60fps; straightening would put a resample into the
  pipeline on every angle change and couple the grid to it.
- **It was a real trade-off.** Straightening would have let an artist fix a
  photo taken slightly askew and export it level. We accepted losing that:
  the problem the artist actually has is matching a turned sheet of paper,
  and Rotate (edit) still covers "which way up" for preparation and export.
  If straightening is ever wanted, it should be a separate, explicit edit
  with its own name, not View Rotation.

## Consequences

- The Paper tool frames at 0° (a crop is an axis-aligned rectangle of the
  image) and restores the angle on exit; Presentation mode keeps the angle and
  re-fits; Real size fixes the scale only.
- A newly opened reference on a new device starts at 0°.
- Clearing site data forgets the angles; nothing else is lost.
