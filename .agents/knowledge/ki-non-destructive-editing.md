---
name: non-destructive-editing
description: The original imported image is never mutated; every adjustment is a serializable operation replayed at render time.
type: knowledge-item
---

# Non-Destructive Editing

## Principle

The original imported bitmap is immutable from the moment it's decoded.
Every crop, rotation, flip, brightness/contrast/saturation change, and
filter is an entry in an ordered, serializable `EditStack` — data, not
pixels — replayed against the original (or a downsampled working copy) to
produce what the artist sees or exports.

## Origin

Source spec §3.12 ("the grid functions as a non-destructive overlay"), §4.1
("the processing pipeline is non-destructive, allowing artists to
experiment... without altering the original image"), §8.7 (the app
"maintains several versions of the image": Original → Working → Processed →
Rendered), and named explicitly as a core philosophy in §3 and §11.6.

## Why it matters

Two concrete failure modes this prevents:

1. **Loss of the source of truth.** If a filter or crop mutated the stored
   bitmap directly, "reset" would be a lie — you can't reset to something
   you overwrote. The source app's own audit flags "reset options are
   coarse-grained" as a weakness (§9.5) — a proper `EditStack` makes
   fine-grained undo/redo nearly free (see
   [ki-simplicity-first](ki-simplicity-first.md) and
   [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md#undoredo)).
2. **Export/preview drift.** [Export](../../docs/architecture/07-export-engine.md)
   re-runs the same `EditStack` against the full-resolution original. If
   editing were destructive, there would be no way to re-derive a
   higher-fidelity export from what the artist saw at working resolution —
   you'd need a second, parallel implementation, which inevitably drifts.

## Rules

- **Do** represent every edit as a typed entry in `EditStack` (see
  [11-data-model-schema.md](../../docs/architecture/11-data-model-schema.md)).
- **Do** treat the original asset as read-only from the moment it's
  imported — every subsequent module operates on a working copy or replays
  operations, never writes back to the original.
- **Do** make "reset" trivially correct: it's just truncating or clearing
  the `EditStack`, never a separate reconstruction path.
- **Don't** implement any tool as an in-place pixel mutation (e.g. baking a
  filter into the working bitmap so it can't be un-toggled) "for
  performance" — the WebGL shader-chain approach in
  [03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md)
  exists specifically so non-destructive and fast aren't in tension.
- **Don't** let Export or Presets reach for a cached, pre-baked bitmap
  instead of re-running the `EditStack` — see
  [build-export-pipeline.md](../workflows/build-export-pipeline.md).

## Evaluating a new feature against this KI

Ask: *"If the artist disables this after using it, does everything else
look exactly as if it were never applied?"* If not, it's not really
non-destructive yet.
