---
name: cross-device-continuity
description: Cross-device sync is additive to the local, offline-first workflow — it never gates, blocks, or risks it.
type: knowledge-item
---

# Cross-Device Continuity

## Principle

Sync extends the source app's philosophy rather than compromising it: a
piece prepared on one device is available on another, but the app remains
fully usable — import, edit, export — with zero network connectivity, on a
single device, exactly as the source app was. This is the one philosophy
in this document that is **not** carried over from the source spec — it's
new, because the source app never had a cross-device story. It's included
here because it must be held to the same rigor as the others, not treated
as "just a feature."

## Origin

Derived directly from the project brief ("cross-platform application that
saves the pieces uploaded across devices") and from applying the source
app's own [Non-Destructive Editing](ki-non-destructive-editing.md) and
[Immediate Feedback](ki-immediate-feedback.md) principles consistently to a
new capability the original app's designers never had to reason about. The
source spec's own Stage 10/11 roadmap independently arrives at "Cloud Sync"
as a proposed enhancement (§5.15, §10.10), validating that this is a
natural extension of the existing philosophy rather than a foreign
addition.

## Why it matters

Sync is infrastructure the artist should rarely have to think about. If it
becomes something that can block an edit, corrupt local state, silently
lose work, or gate the app behind a login wall on first launch, it
undermines the "fast setup" need explicitly called out for the Beginner and
Student personas (source spec §2) — the exact personas the source app was
built to serve well.

## Rules

- **Do** make every edit succeed locally first, unconditionally, before any
  network involvement — see
  [build-project-cloud-sync.md](../workflows/build-project-cloud-sync.md).
- **Do** let the app be used fully signed-out, with a persistent but
  non-blocking prompt to sign in for sync — no account wall on first launch.
- **Do** surface sync state honestly (Synced/Syncing/Offline/Error) rather
  than hiding it or conflating "offline" with "error."
- **Do** treat image assets as content-hash deduplicated and originals as
  immutable once uploaded — sync should never silently create duplicate or
  divergent copies of the same reference image.
- **Don't** let a sync failure or a network condition ever block, slow, or
  visibly degrade the interactive editing experience (see
  [ki-immediate-feedback](ki-immediate-feedback.md)) — sync is strictly a
  background concern from the editing surface's point of view.
- **Don't** silently overwrite one device's edits with another's — the
  last-write-wins model in
  [08-project-sync-backend.md](../../docs/architecture/08-project-sync-backend.md#conflict-resolution-last-write-wins-explicit-simplifying-assumption)
  is an explicit, documented trade-off, not license to ignore conflicts
  entirely.

## Evaluating a new feature against this KI

Ask: *"If this device is offline right now, does the feature still work?
And if sync fails silently in the background, does the artist find out,
without it interrupting what they're doing?"*
