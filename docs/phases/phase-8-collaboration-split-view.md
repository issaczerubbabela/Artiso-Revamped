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
      Panes are keyed by physical side, so a swap never remounts either
      canvas and neither loses its framing.
- [x] Same reference can't be open in both panes (edits would diverge):
      `loadReference` ends the split if it loads the parked reference.
- [x] Tab strip: "Split" opens another tab beside the focused one; the
      parked tab is outlined; "Close split" and closing either pane's tab
      collapse to one pane.

**Collaborative Projects**
- [ ] Membership model + RLS (projects, references, assets, Storage)
- [ ] Merge logic: annotations union by id, last-write-wins otherwise
- [ ] Share UI: invite by email, roles, list/remove members
- [ ] Refresh on open / focus / periodic pull
- [ ] Viewer role enforced (UI and server)

## Exit criteria

- [x] Split view shows two independently pannable/zoomable references at
      Wide; tools act on the focused pane; Compact never shows a split
      (`apps/web/e2e/split-view.spec.ts`)
- [ ] An editor's changes reach the owner (and vice versa) after a refresh;
      concurrent annotations from two people both survive
- [ ] A viewer can open a shared project but the server rejects their writes
