# Artiso — Foundational Design Documents

This folder contains the Lead-Architect-level design artifacts for rebuilding
**Drawing Grid for the Artist** as a cross-platform application, derived from
[`Drawing Grid for the Artist_ Reverse-Engineered Product Specification.md`](./Drawing%20Grid%20for%20the%20Artist_%20Reverse-Engineered%20Product%20Specification.md).

**Status: PROPOSAL — awaiting approval. No implementation has started.**

## Scope decision (from the brief)

- Cross-platform, single shared codebase: **Web first, then Android**.
- Cross-device sync: a piece (reference image + its edits/grid config) uploaded
  on one device must be available on another device signed into the same
  account.
- iOS, desktop companion, AI features, and plugin marketplace are explicitly
  **out of scope** for the phases planned here (see `phases/phase-6-*.md` for
  where they'd slot in later). This preserves the source app's philosophy of
  shipping a focused tool well before broadening it.

## How to read this

1. **Architecture** (`architecture/`) — the *what* and *how* of each system
   module. Start with `00-system-overview.md`.
2. **Phases** (`phases/`) — the *when*, as an ordered execution plan. Each
   phase file is a complete milestone with scope, tasks, and exit criteria.
3. Supporting the above, two more artifact sets live outside `docs/`:
   - [`.agents/workflows/`](../.agents/workflows/README.md) — step-by-step
     build guides an agent follows when implementing a specific feature.
   - [`.agents/knowledge/`](../.agents/knowledge/README.md) — the distilled
     product philosophies every future feature must be checked against.

## Architecture index

| File | Module |
| --- | --- |
| [00-system-overview.md](architecture/00-system-overview.md) | Overall architecture, stack, repo layout |
| [01-image-import.md](architecture/01-image-import.md) | Image Import |
| [02-image-editing.md](architecture/02-image-editing.md) | Crop / Rotate / Flip |
| [03-image-processing-filters.md](architecture/03-image-processing-filters.md) | Adjustments & Filter Pipeline |
| [04-grid-engine.md](architecture/04-grid-engine.md) | Grid Engine |
| [05-canvas-renderer.md](architecture/05-canvas-renderer.md) | Canvas Renderer / compositor |
| [06-workspace-interaction.md](architecture/06-workspace-interaction.md) | Zoom / Pan / Gestures |
| [07-export-engine.md](architecture/07-export-engine.md) | Export & Share |
| [08-project-sync-backend.md](architecture/08-project-sync-backend.md) | Projects, Presets, Cross-Device Sync, Backend |
| [09-settings-preferences.md](architecture/09-settings-preferences.md) | Settings & Preferences |
| [10-mobile-android-shell.md](architecture/10-mobile-android-shell.md) | Android (Capacitor) Shell |
| [11-data-model-schema.md](architecture/11-data-model-schema.md) | Shared data model / schemas |

## Phase index

| File | Milestone |
| --- | --- |
| [phase-0-foundations.md](phases/phase-0-foundations.md) | Repo, tooling, CI/CD, design system skeleton |
| [phase-1-web-core-mvp.md](phases/phase-1-web-core-mvp.md) | Web MVP: import → crop/rotate → adjustments → grid → local save |
| [phase-2-cloud-projects-sync.md](phases/phase-2-cloud-projects-sync.md) | Auth, Projects, cloud storage, cross-device sync |
| [phase-3-filters-presets-export.md](phases/phase-3-filters-presets-export.md) | Full filter suite, presets, export profiles |
| [phase-4-android-shell-launch.md](phases/phase-4-android-shell-launch.md) | Capacitor Android shell, Play Store launch |
| [phase-5-android-parity-hardening.md](phases/phase-5-android-parity-hardening.md) | Android-specific polish, offline mode, performance |
| [phase-6-advanced-guides-ai-stretch.md](phases/phase-6-advanced-guides-ai-stretch.md) | Perspective guides, annotation, AI-assist (stretch, post-approval-gated) |

## Approval checklist

Before implementation begins, confirm:

- [ ] Stack choices in `00-system-overview.md` (Next.js + Capacitor + Supabase)
- [ ] Module boundaries in `architecture/01`–`11`
- [ ] Phase sequencing and scope in `phases/phase-0`–`6`
- [ ] Workflows in `.agents/workflows/`
- [ ] Knowledge Items in `.agents/knowledge/`
