---
name: immediate-feedback
description: Every slider, toggle, or gesture updates the canvas in real time — there is no apply-and-wait step.
type: knowledge-item
---

# Immediate Feedback

## Principle

Changing any control — a brightness slider, a grid density preset, a filter
toggle, a pan/zoom gesture — updates the canvas in real time, without an
explicit "apply" step or a perceptible delay.

## Origin

Source spec §3 ("Immediate Feedback: Changing sliders updates the image in
real time"), §4.15 ("Real-Time Preview... one of the application's
strengths"), and carried into the redesign roadmap's explicit NFR targets
(§10.8/§11.15: filter preview < 100ms, grid update < 16ms / 60fps).

## Why it matters

Grid-method drawing is inherently iterative — the artist is constantly
comparing the reference against their drawing and adjusting grid density,
contrast, or crop as they go. Any lag between adjusting a control and
seeing the result breaks that feedback loop and makes the tool feel like
it's fighting the artist rather than assisting them.

## Rules

- **Do** hit the concrete NFR targets: adjustment/filter preview < 100ms,
  grid redraw at 60fps during pan/zoom, carried through every phase's exit
  criteria (see [phase-1-web-core-mvp.md](../../docs/phases/phase-1-web-core-mvp.md)
  onward).
- **Do** architect for this rather than optimize for it after the fact —
  the entire shader-uniform-update-not-recompile design in
  [03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md)
  and the geometry-cache-plus-transform-only design in
  [04-grid-engine.md](../../docs/architecture/04-grid-engine.md) exist
  specifically to make immediate feedback structurally cheap, not something
  bolted on with debouncing/throttling band-aids.
- **Don't** add a debounce/throttle to a slider as the *first* response to a
  performance problem — that's treating the symptom. Find out why the
  underlying operation is slow first (wrong thread? shader recompile when a
  uniform update would do? unnecessary grid recomputation?).
- **Don't** let network/sync latency leak into the interactive path — sync
  is background and asynchronous by design (see
  [ki-cross-device-continuity](ki-cross-device-continuity.md)); nothing the
  artist does moment-to-moment should wait on a network round-trip.

## Evaluating a new feature against this KI

Ask: *"Does the user have to wait for anything — a spinner, a recompute, a
network call — between adjusting this control and seeing the result?"* If
yes, that's a bug to fix before the feature ships, not an acceptable
trade-off.
