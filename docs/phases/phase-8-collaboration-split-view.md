# Phase 8 — Split View & Collaborative Projects

**Platform:** Web only (split view is Wide-breakpoint only).

**Depends on:** [Phase 7](phase-7-guides-workspace-export.md). Split view
extends Phase 7's multi-reference tabs; collaboration extends Phase 2's
sync. Both were deferred there and activated by direct user instruction.

## Decisions (made with the user)

- **Split view:** both panes fully editable; tools and panels act on the
  focused pane.
- **Sharing:** invite an existing Artiso account by email as a **viewer**
  (read-only) or **editor**.
- **Merge model:** annotations merge by id (two people's additions union);
  everything else stays last-write-wins per field group.
- **Freshness:** refresh on open, on window focus, and on a periodic pull.
  No Supabase Realtime.

## Checklist

**Split view**
- [x] Two references side by side at the Wide breakpoint, each with its own
      pan/zoom. The workspace store stays the live session of the *focused*
      pane, so every panel and action is unchanged; the other pane's session
      is parked as a `PaneSession` snapshot (`splitParked`) and drawn by a
      second `CanvasStage`. Clicking the parked pane swaps them
      (`focusSplitPane`), flushing the outgoing pane's pending edit first.
      Panes are keyed by physical side, so a swap never remounts a canvas
      and neither loses its framing.
- [x] Same reference can't be open in both panes (edits would diverge):
      `loadReference` ends the split if it loads the parked reference.
- [x] Tab strip: "Split" opens another tab beside the focused one; the
      parked tab is outlined; "Close split" and closing either pane's tab
      collapse to one pane.

**Collaborative Projects**
- [x] Membership model + RLS (projects, references, assets, Storage):
      `project_members`, a `SECURITY DEFINER` `member_role()` helper to avoid
      policy recursion, per-command policies, and the
      `invite_project_member` / `list_project_members` /
      `remove_project_member` RPCs (no direct write policy on memberships).
- [x] Merge logic (`mergeReferences`, pure): annotations union by id minus
      `removedAnnotationIds` tombstones; every other group three-way against
      the last-synced base (`syncBases`), last-write-wins only where both
      sides changed the same group. Geometry and tonal edits are separate
      groups. The version guard is now strict (`<=`), the sync queue merges on
      a stale push, and the merge is written with compare-and-swap so it can't
      overwrite an edit made while it ran.
- [x] Share UI: Share dialog (invite by email as "Can view"/"Can edit", list
      and remove members) on your own projects; shared projects show a role
      badge and a Leave action instead of Rename/Delete.
- [x] Refresh on open / window focus / every 30s (`live-refresh.ts`); merged
      results are adopted into the open workspace (a collaborator's
      crop/rotate reloads the bitmap, everything else swaps in place, and an
      edit still waiting to persist is never overwritten).
- [x] Viewer role: server RLS rejects writes; the client also disables the
      editing tools, shows "View only", and the store refuses every edit.
- [ ] Verified live against the real Supabase project with two accounts
      (needs the migration re-run and a second confirmed account -- see
      below).

## Verification

- `packages/api-client/src/sync/__tests__/merge-reference.test.ts` -- the
  merge rules.
- `packages/api-client/src/sync/__tests__/sharing-rls.test.ts` -- runs the
  real migration in PGlite (Postgres compiled to WASM) and exercises every
  policy and RPC as owner / editor / viewer / outsider. Weakening the viewer
  policy makes it fail, so it does catch regressions. Only Supabase's own
  `auth`/`storage` schemas are stubbed.
- `apps/web/e2e/split-view.spec.ts`, `collaboration-ui.spec.ts` -- split
  view, viewer enforcement, shared-project cards, tombstone persistence, and
  loading rows saved before the newer fields existed.

**Not yet verified:** the network round trip with two real accounts
(supabase-js against the live project: RPC calls, Storage downloads by a
collaborator, and a real two-browser edit/merge). The pieces are each tested,
but not end to end.

## Known limitations

- Freshness is a 30s pull, not live: a collaborator's change can take up to
  that long (or a window focus) to appear.
- Inviting reveals whether an email has an Artiso account (the error says so)
  -- fine between people who know each other, worth revisiting for wider use.
- Collaborators edit existing references; importing into someone else's
  shared project isn't supported (each import still creates its own
  project).
- A parked split pane is refreshed by sync but not while it is being dragged
  or edited (it can't be -- only the focused pane takes input).

## Exit criteria

- [x] Split view shows two independently pannable/zoomable references at
      Wide; tools act on the focused pane; Compact never shows a split
      (`apps/web/e2e/split-view.spec.ts`)
- [x] Concurrent annotations from two people both survive a merge, and a
      deletion is not undone by one (`merge-reference.test.ts`)
- [x] A viewer's writes are rejected by the server
      (`sharing-rls.test.ts`), and the client is read-only for viewers
- [ ] An editor's changes reach the owner (and vice versa) end to end against
      the live Supabase project
