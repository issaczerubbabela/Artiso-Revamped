# 08 — Projects, Presets & Cross-Device Sync

Package: `packages/api-client` + Supabase (managed backend)

## Purpose

This module is the entire reason the app is being rebuilt rather than
staying a local-only Android app: **a piece (reference image + its
non-destructive edits + grid config) uploaded on one device must be
available on another device signed into the same account.** Everything else
in this document exists in service of that one requirement.

## Backend choice: Supabase (confirmed)

Postgres (managed) + Auth + Object Storage + Row Level Security, used
directly from `packages/api-client` via the Supabase JS client — no custom
REST/tRPC service in Phases 0–3. Rationale: fastest path to a *working*
cross-device sync MVP; RLS gives per-user data isolation without writing
authorization middleware by hand.

**Trade-off flagged for the reviewer:** this is a vendor dependency. If
compliance/data-residency requirements or a need for custom
server-side business logic emerge later, the migration path is to stand up
`services/api` (Node/Fastify, same Postgres schema, same Storage buckets
re-pointed to self-hosted S3-compatible storage) — `api-client`'s public
interface is written against our own types, not the Supabase client
directly, specifically to keep this migration realistic rather than
theoretical.

## What syncs, and what the "unit of sync" is

The sync unit is the **Project**, containing one or more **References**.

| Entity | Syncs? | Storage |
| --- | --- | --- |
| Project metadata (name, tags, timestamps) | Yes | Postgres |
| Reference (`editStack`, `gridConfig`, notes) | Yes | Postgres (`jsonb`) |
| Original image asset | Yes, once (content-hash deduped) | Supabase Storage |
| Rendered/exported output | **No** — ephemeral, regenerated on demand | Not stored server-side |
| Presets | Yes | Postgres |
| Local device preferences (theme, toolbar density) | **No**, see [09](09-settings-preferences.md) | `localStorage` only |

Rendered exports aren't synced because they're fully reproducible from
`(original asset, editStack, gridConfig)` — syncing pixels we can
regenerate would multiply storage cost for no benefit.

## Offline-first sync flow

```
Local edit (any module) → WorkspaceState
        │
        ▼
Persist immediately to IndexedDB (local-first, always succeeds, no network required)
        │
        ▼
Enqueue sync job (debounced, e.g. 2s after last edit)
        │
        ▼
        ├─ online  → upload new/changed Asset (content-hash dedupe) → upsert Reference/Project row
        │
        └─ offline → job stays queued, retried on reconnect (visible "Offline — will sync" indicator)
```

The app is **fully functional with zero network** end-to-end — import,
edit, export, save all work locally. Sync is strictly additive, per the
"sync is additive, not load-bearing" invariant in
[00](00-system-overview.md). A signed-out user gets local-only Projects
(IndexedDB) with a persistent, non-blocking "Sign in to sync across devices"
prompt — no account wall on first launch, preserving the "fast setup" need
called out for the Beginner/Student personas in the source spec.

## Conflict resolution and sharing

**Originally** this was whole-reference last-write-wins, on the assumption
of a single user across several devices. Shared Projects
([phase 8](../phases/phase-8-collaboration-split-view.md)) made that
unsafe -- two people annotating at once would silently overwrite each other --
so it was revisited, as this section used to flag it would need to be.

**Concurrency control.** Each `Reference` row carries a monotonic `version`.
The `references_version_guard` trigger drops any write whose version is not
strictly above what is stored, so a stale writer can never overwrite a newer
copy. The losing client sees the mismatch (it reads back the stored version),
pulls the server copy, **merges**, and pushes the merge at a higher version.

**Merge** (`packages/api-client/src/sync/merge-reference.ts`, pure and
unit-tested) compares the local copy, the server copy, and the last copy this
device synced (the *base*, kept in the `syncBases` IndexedDB store):

- **Annotations** are unioned by id, so both people's additions survive.
  Deletions are recorded in `removedAnnotationIds` (tombstones) so a union
  cannot resurrect them.
- **Every other field group** (geometry ops, adjustments/filters, primary
  grid, layered grid, notes) is three-way: if only one side changed a group,
  that change wins; only if both changed the *same* group does the more
  recently updated side win. That is last-write-wins, but scoped to one group
  instead of the whole reference.

The merged result is written locally with a compare-and-swap on the local
version, so an edit made while a merge was running is never overwritten (the
merge is redone from the newer copy).

**Sharing.** A Project is shared with existing accounts as `editor` (may
change its references) or `viewer` (read-only) via `project_members`. Row
Level Security is the security boundary: members can read the project, its
references, and the assets/Storage objects behind them; owner and editors can
write references; only the owner can rename, delete, or change membership
(through `SECURITY DEFINER` functions). The client's role checks only hide UI.

**Freshness** is by refresh, not push: on open, on window focus, and on a
30-second timer, the open reference is synced (which also pushes any unsynced
edit). Supabase Realtime was deliberately not adopted.

## Data flow diagram

```
┌────────────┐       ┌────────────┐
│  Device A   │       │  Device B   │
│  (web)      │       │  (Android)  │
└──────┬──────┘       └──────┬──────┘
       │  IndexedDB (local)   │  IndexedDB (local)
       │                      │
       └────────┬─────────────┘
                 ▼
        packages/api-client (Supabase JS client)
                 │
                 ▼
┌─────────────────────────────────────────────┐
│                  Supabase                     │
│  Auth  │  Postgres (RLS)  │  Storage (assets)  │
└─────────────────────────────────────────────┘
```

## Storage layout

- Bucket `originals/{userId}/{contentHash}.{ext}` — the only large binary
  data synced.
- Bucket `thumbnails/{userId}/{contentHash}.webp` — small, generated at
  import time.
- Content-hash keying means importing the same photo into two Projects (or
  re-importing after a local cache clear) never re-uploads it.

## Auth

Supabase Auth, email/password at launch; OAuth providers (Google — relevant
given the Android distribution channel) added opportunistically, not
gating Phase 2. Session persisted; RLS policies scope every table to
`owner_id = auth.uid()`.

## Dependencies

- `shared-types` — the schemas in [11](11-data-model-schema.md) are the
  source of truth for both the Postgres schema and the client-side types.
- Every editing module ([01](01-image-import.md)–[04](04-grid-engine.md))
  produces the `Asset`/`EditStack`/`GridConfig` data this module persists.

## Open questions

- [ ] OAuth provider priority (Google likely first, given Android
  distribution).
- [ ] Storage quota / retention policy per free user (not yet defined —
  needed before public launch, not before Phase 2 engineering work).
