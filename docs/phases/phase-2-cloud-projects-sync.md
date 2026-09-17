# Phase 2 — Cloud, Projects & Cross-Device Sync

**Platform:** Web only (the payoff shows up fully once Android exists in
Phase 4, but the sync engine itself is platform-agnostic and validated here
first via two browser sessions / two devices on the web app).
**Estimated duration:** 4–5 weeks.
**Depends on:** [Phase 1](phase-1-web-core-mvp.md) — requires a correct
local `EditStack`/`GridConfig` model to sync.

## Goal

Turn the local-only Phase 1 app into the actual product requirement: **a
piece uploaded on one device is available on another.** This is the single
most important phase relative to the stated brief.

## Features in scope

**Auth** ([08](../architecture/08-project-sync-backend.md))
- [ ] Supabase Auth: email/password sign-up/sign-in/sign-out.
- [ ] Fully usable, non-blocking signed-out state (local-only Projects) with
      a persistent "Sign in to sync" prompt — no account wall on launch.
- [ ] Session persistence across app restarts.

**Projects**
- [ ] Home/Projects screen: list, create, rename, delete, thumbnail.
- [ ] A Project holds one or more References (multi-reference *within* a
      project is a data-model allowance; the multi-reference **workspace
      UI** — viewing more than one at once — is deferred to
      [Phase 6](phase-6-advanced-guides-ai-stretch.md) per the reviewer
      decision).

**Sync engine**
- [ ] IndexedDB → Supabase upload pipeline: debounced sync queue, content-hash
      asset dedupe, background upload on reconnect.
- [ ] Per-project sync status indicator (Synced / Syncing / Offline / Error).
- [ ] Last-write-wins conflict resolution via `version` field (see
      [11](../architecture/11-data-model-schema.md)).
- [ ] Two-tab / two-browser manual test: edit a Reference in tab A, confirm
      it appears (after sync) in tab B.

**Settings sync split**
- [ ] Implement the local-vs-synced split table from
      [09](../architecture/09-settings-preferences.md) — grid/adjustment
      defaults synced to the user profile row, device prefs stay local.

## Explicitly out of scope

Full filter suite (Phase 3), Android (Phase 4), any collaborative/shared
Project access beyond a single owner (flagged as an open question in
[08](../architecture/08-project-sync-backend.md), not built here).

## Exit criteria

- [ ] Sign up, import + edit a Reference, sign in on a second browser
      profile/device, see the same Reference with identical `EditStack`/
      `GridConfig` within the debounce window.
- [ ] Airplane-mode test: edit offline, reconnect, confirm sync completes
      without data loss or duplicate assets.
- [ ] Re-importing an already-uploaded image does not re-upload the binary
      (content-hash dedupe verified).
- [ ] Sync status indicator accurately reflects state in all four cases
      (synced/syncing/offline/error) — manually fault-injected for the
      error case.
