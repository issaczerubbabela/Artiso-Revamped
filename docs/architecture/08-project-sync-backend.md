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

## Conflict resolution: last-write-wins (explicit simplifying assumption)

Each `Reference` row carries `updatedAt` and a monotonic `version` integer.
On upsert, if the server's `version` is newer than the client's locally-known
version, the client's write is rejected and the client re-fetches, applies
its local diff on top if possible, and re-submits. In practice, given this
is a **single-user, multi-device** app (not multi-user collaboration),
true concurrent edits to the same Reference from two devices at once are
rare — this is a deliberate trade-off against CRDT/OT complexity that would
be overkill for the target use case.

**Flagged for reviewer sign-off:** if "family/studio shared projects"
ever becomes a real requirement, this conflict model needs revisiting before
that feature ships.

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
