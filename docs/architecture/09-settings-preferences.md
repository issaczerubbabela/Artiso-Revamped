# 09 — Settings & Preferences

Package: `apps/web`

## Purpose

Application-wide configuration, extended from the source spec's Stage 5,
split along one axis the source app never had to consider: **which
preferences are device-specific vs. which represent the artist's workflow
and should follow them across devices.**

## Local vs. synced split

| Category | Scope | Storage | Rationale |
| --- | --- | --- | --- |
| Theme (light/dark/system) | Device | `localStorage` | A phone in dark mode shouldn't force a desktop into dark mode |
| Toolbar size/density (desktop only) | Device | `localStorage` | Meaningless on mobile's fixed bottom toolbar |
| Pan sensitivity, gesture lock | Device | `localStorage` | Tuned to the specific screen/input hardware |
| Performance Mode | Device | `localStorage` | A budget Android phone and a desktop have different headroom |
| Live preview on/off | Device | `localStorage` | Same reasoning as Performance Mode |
| Default grid size/color/thickness/numbering | **Workflow** | Synced (user profile row) | This is "how I like to work," not a device trait |
| Default brightness/contrast/saturation | **Workflow** | Synced | Same |
| Default filter | **Workflow** | Synced | Same |
| Default export format/quality | **Workflow** | Synced | Same |
| Autosave interval, confirm-before-exit | Device | `localStorage` | Tied to how a given device behaves (e.g. mobile app backgrounding) |

## Categories (source spec §5.2–§5.11, retained)

- **General** — startup behavior (resume last project / blank workspace),
  autosave interval, confirm-before-exit.
- **Workspace** — zoom behavior, pan sensitivity, double-tap/double-click
  action, gesture lock (see [06](06-workspace-interaction.md)).
- **Grid defaults** — synced (see split table above).
- **Image processing defaults** — synced.
- **Display** — theme, canvas background, toolbar size (desktop only), text
  size, high-contrast mode.
- **Export** — default format/quality/include-grid/include-adjustments.
- **Storage** — cache usage/clear, recent-projects retention.
- **Help/About** — user guide, FAQ, report bug, version/licenses.

## Performance Mode

```ts
type PerformanceMode = "batterySaver" | "balanced" | "highPerformance";
```

Feeds directly into:

- [Canvas Renderer](05-canvas-renderer.md)'s working-resolution cap
  (lower in Battery Saver).
- [Image Processing](03-image-processing-filters.md)'s high-cost filter
  throttling (Edge Detection/Pencil Sketch degrade gracefully or preview at
  reduced resolution in Battery Saver).
- Live-preview frame gating.

Defaulted per-platform: `balanced` on Android, `highPerformance` on desktop
web — overridable by the user.

## Accessibility (source spec §9.7, scored 6.5/10 — explicit improvement target)

- Adjustable text size (Small/Medium/Large/Extra Large).
- High-contrast theme.
- Minimum 44–48px touch targets baked into the shared `packages/ui` design
  tokens from Phase 0, not retrofitted later.
- Labeled toolbar icons by default (see [06](06-workspace-interaction.md)) —
  the single highest-leverage accessibility/discoverability fix carried
  over from the source audit.

## Dependencies

- [Workspace](06-workspace-interaction.md) — Gesture Lock, keyboard shortcut
  toggling.
- [Projects/Sync](08-project-sync-backend.md) — synced default fields live
  on the user profile row.
- `packages/ui` — design tokens for text size / contrast / touch targets.

## Open questions

- [ ] Autosave interval default and options (source spec suggests
  off/1min/5min/10min/on-every-edit) — given `EditStack` writes are already
  cheap local IndexedDB writes, consider defaulting to "on every edit" and
  dropping the interval concept entirely. Flag for reviewer.
