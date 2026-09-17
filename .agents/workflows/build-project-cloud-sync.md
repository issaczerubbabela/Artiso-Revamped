# Workflow: Build Project Cloud Sync

Architecture: [docs/architecture/08-project-sync-backend.md](../../docs/architecture/08-project-sync-backend.md)

## Trigger

Implementing the offline-first sync engine (Phase 2), or modifying anything
that touches what/how data syncs.

## Preconditions

- Local IndexedDB persistence of `Project`/`Reference`/`Preset` already
  works and is correct on its own (Phase 1 exit criteria) — sync is layered
  on top of a working local model, never built simultaneously with it.
- `shared-types` schemas match the Postgres schema 1:1.

## Procedure

1. **Local write always wins first.** Every edit writes to IndexedDB
   synchronously (or as close to it as the platform allows) before any
   network call is even considered. The app must never block an edit on
   network availability.
2. **Debounce the sync queue.** Enqueue a sync job ~2s after the last edit
   to a given `Reference` (not on every keystroke/slider tick) — avoids
   flooding the network with WIP slider-drag states.
3. **Upload assets before metadata.** For a new/changed image, compute its
   content hash, check if it's already in Storage (dedupe), upload if not,
   *then* upsert the `Reference`/`Project` row referencing it. Never
   reference an asset that hasn't finished uploading.
4. **Upsert with version check.** Send the local `version` alongside the
   write; if the server's stored version is higher, treat this as a
   conflict per
   [08-project-sync-backend.md §Conflict resolution](../../docs/architecture/08-project-sync-backend.md#conflict-resolution-last-write-wins-explicit-simplifying-assumption) —
   re-fetch, do not blindly overwrite.
5. **Surface sync state, don't hide it.** Every Project shows one of
   Synced / Syncing / Offline / Error — wire this from the actual queue
   state, not a guess. "Error" must be distinguishable from "Offline" (the
   user can't fix an auth/quota error by just waiting for connectivity).
6. **Never block editing on sync state.** A Project stuck in "Error" must
   still be fully editable locally — sync retries in the background.
7. **Respect the local-vs-synced settings split** from
   [09-settings-preferences.md](../../docs/architecture/09-settings-preferences.md) —
   don't accidentally sync a device-local preference (theme, toolbar
   density) by putting it in the same table as workflow defaults.

## Files/modules touched

`packages/api-client/src/sync/*`, `packages/api-client/src/queue/*`,
IndexedDB schema/migrations, sync-status UI indicator in `apps/web`.

## Testing checklist

- [ ] Airplane-mode test: edit offline, confirm local state is correct and
      the sync queue holds the pending write.
- [ ] Reconnect test: queued writes flush, remote state matches local
      state, no duplicate asset uploads.
- [ ] Two-client test: edit the same `Reference` from two sessions close
      together, confirm the version-check conflict path triggers (not a
      silent overwrite).
- [ ] Re-import of an already-uploaded image (same content hash) performs
      zero binary re-upload.
- [ ] Sync status indicator matches actual state in all four cases,
      including a fault-injected auth/network error.

## Common pitfalls

- Syncing on every keystroke instead of debouncing — burns quota and
  network for no user-visible benefit.
- Treating "offline" and "error" as the same UI state — a user can't
  self-resolve an error by waiting.
- Building this before local-only persistence is solid — sync bugs become
  indistinguishable from local-persistence bugs if both are new at once.

## Related knowledge items

[`ki-cross-device-continuity`](../knowledge/ki-cross-device-continuity.md).
