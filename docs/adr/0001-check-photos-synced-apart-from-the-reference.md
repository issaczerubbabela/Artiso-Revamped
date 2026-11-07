# ADR 0001 — Check Photos are synced, but kept apart from the reference

- **Status:** Accepted (2026-11-07)
- **Context:** Phase 12, Drawing Check — [issue #2](https://github.com/issaczerubbabela/Artiso-Revamped/issues/2),
  ticket [#9](https://github.com/issaczerubbabela/Artiso-Revamped/issues/9).
  Terms: [`GLOSSARY.md`](../../GLOSSARY.md) (Drawing Check, Check Photo).

## Context

The **Drawing Check** lets the artist photograph their own drawing, line the
photo up with the paper by its four corners, and lay it over the reference to
catch proportion errors. The photo is often taken on a phone while the iPad
stays on its stand, so it has to reach the iPad: it must sync.

At the same time the photo is not part of the reference. The reference is
the prepared source image — its original asset, its `EditStack`, its paper,
crop and grid — and it is shared with collaborators and exported. A
work-in-progress photo of someone's paper is none of those things:

- it must never change the reference, its edits or its exports
  ([`ki-non-destructive-editing`](../../.agents/knowledge/ki-non-destructive-editing.md));
- it is private to the person who took it, even on a shared project;
- only the latest one matters — there is no history.

## Decision

A Check Photo is its **own synced entity**, not a field on the reference and
not an `Asset`:

- **Schema:** `CheckPhotoSchema` in `packages/shared-types` — id, owner,
  reference, the image (storage key, MIME type, pixel size, byte size), the
  four paper corners in photo pixels, and timestamps.
- **Postgres:** a new `check_photos` table with a unique
  `(owner_id, reference_id)`, so there is at most one per user per reference;
  a new photo *replaces* the row (upsert on that pair). It cascades away with
  its reference.
- **Storage:** a new private `check-photos` bucket, one object per user per
  reference at `{ownerId}/{referenceId}.{ext}`, overwritten on replace.
- **Privacy:** RLS on both the table and the bucket allows reads and writes
  by the uploader only (`owner_id = auth.uid()`, first path segment =
  `auth.uid()`). Unlike reference assets there is deliberately **no**
  shared-read policy, so even the project owner cannot see a collaborator's
  Check Photo. Inserting one also requires that the uploader can see the
  reference.
- **Sync:** it rides the existing per-reference sync queue
  (`packages/api-client/src/sync/queue.ts`): after the reference itself is
  pushed or pulled, the queue pushes a pending local Check Photo change
  (upload, corner change or delete) or pulls a newer remote one. Locally it
  lives in its own IndexedDB store with a pending flag, so capture works
  offline and is replayed on the next sync. Newest `updatedAt` wins between
  devices.
- **Rendering:** the photo is straightened (homography from its corners, in
  `packages/core-engine`) and drawn as its own layer between the reference
  image and the grid. Its opacity and hold-to-swap are view state only.

It is never part of the `EditStack`, never read by export, and never merged
into the reference row.

## Consequences

- One more table, bucket and set of RLS policies; the migration
  (`supabase/migrations/0001_phase2_schema.sql`) has to be re-run.
- Reference sync and merge are untouched: a Check Photo change can never
  conflict with, or bump the version of, the reference.
- Collaborators never see each other's Check Photos (the spec's "out of
  scope: Check Photos visible to collaborators").
- Storing the photo at the working resolution (long edge ≤ 2048 px, JPEG)
  rather than the camera original keeps phone-to-iPad sync quick; the corners
  are in those stored pixels.

## Alternatives considered

- **A field on the reference row** — would sync to collaborators, bump the
  reference version on every capture, and put a private photo inside a shared
  record. Rejected.
- **Reusing `assets`** — `assets_shared_read` exposes any asset a visible
  reference uses, and assets are content-addressed and never replaced, so
  "latest only, private" would need exceptions to both. Rejected.
- **Device-local only** — would break the phone → iPad flow that motivates
  the feature. Rejected.
