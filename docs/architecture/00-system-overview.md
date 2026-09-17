# 00 — System Overview & Architecture

Status: **Proposal, pending approval**

## 1. Problem framing

Source app (`v3.0.6`, Android-only, reverse-engineered) is a single-purpose
reference-preparation tool: `Import → Prepare → Grid → Draw → Export`. It has
no accounts, no cloud, no cross-device story — everything is local to one
phone.

The new requirement adds exactly one new axis of complexity: **the same
"piece" (a reference image plus its non-destructive edits and grid config)
must follow the artist across devices**, starting with a web app and then an
Android app that shares its engine. Everything else — the canvas-first,
non-destructive, sequential-workflow philosophy — is preserved, not
reinvented. See [`.agents/knowledge/`](../../.agents/knowledge/README.md) for
the philosophies this architecture is bound by.

## 2. Platform strategy

**Decision: one web codebase (Next.js/React/TypeScript), shipped to Android
via Capacitor, rather than a separate native rendering stack (Flutter /
React Native).**

Rationale:

- The app's core value is a real-time, GPU-driven Canvas/WebGL pipeline
  (grid overlay + image filters). That pipeline is naturally expressed once
  in TypeScript/WebGL and reused verbatim on Android inside a WebView —
  Capacitor ships a Chromium WebView on Android, so rendering fidelity and
  performance characteristics carry over directly.
- "Web first, then Android" as literally stated in the brief is cheapest to
  satisfy by building one PWA and wrapping it, not maintaining two UI
  toolkits from day one.
- Native device features the app actually needs (gallery picker, camera,
  filesystem, share sheet) are all covered by official Capacitor plugins.
- Cost of this decision: raw rendering throughput on very large images
  (24MP+) is somewhat below a fully native Skia/Metal pipeline. Mitigated via
  downsampled working bitmaps (see `03-image-processing-filters.md §Working
  Resolution`) and WebGL, which is GPU-accelerated even inside a WebView.

Alternative considered and rejected: Flutter (single codebase, better raw
canvas performance, but throws away the "web first" sequencing — Flutter web
is a secondary rendering target for the Flutter team, and the brief's web
deliverable would become a fork rather than the source of truth).

iOS is not in scope for the phases planned here, but the Capacitor choice
keeps it a near-zero-rewrite addition later (same web bundle, new native
shell project).

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    UI Layer (React)                     │  │
│  │  Toolbar · Bottom sheets/panels · Dialogs · Home/Projects│ │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Workspace State (Zustand)                  │  │
│  │  active Reference, tool mode, viewport, edit stack       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            packages/renderer (Canvas2D + WebGL)          │  │
│  │  Compositor: background → image → grid lines → labels    │ │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             packages/core-engine (pure TS)                │ │
│  │  Image pipeline · Grid engine · Geometry/coords · Filters │ │
│  │  (runs in a Web Worker off the main thread)               │ │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           packages/api-client (sync + REST/tRPC)          │ │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                             │ same bundle, wrapped
┌────────────────────────────▼───────────────────────────────┐
│                apps/android (Capacitor shell)                │
│   WebView hosting the web bundle + native plugins:            │
│   Filesystem · Camera · Photos · Share · StatusBar             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    services/api (Supabase)                    │
│  Postgres (projects/references/presets) · Auth · Object       │
│  Storage (original + rendered assets) · Row Level Security     │
└─────────────────────────────────────────────────────────────┘
```

## 4. Repository layout

```
/apps
  /web                Next.js PWA — the product
  /android            Capacitor native project (generated + minimal custom code)
/packages
  /core-engine        Pure TS: image pipeline, grid engine, geometry, filters
                       (no DOM/React deps — testable headless, runs in a Worker)
  /renderer            Canvas2D/WebGL compositor consuming core-engine output
  /ui                  Shared design-system React components
  /api-client          Typed client + sync/offline-queue logic
  /shared-types        Zod schemas / TS types for Project, Reference, Preset, User
/services
  /api                 Only needed if/when we outgrow Supabase directly
                        (see architecture/08 — placeholder, not built in Phase 1-3)
/docs                  This design documentation
/.agents               Agent-facing workflows and knowledge items
```

Tooling: **pnpm workspaces + Turborepo**, TypeScript strict mode everywhere,
ESLint + Prettier, Vitest for `core-engine`/`renderer` unit tests, Playwright
for web E2E.

## 5. Module boundaries

Each module below has its own doc. The boundary rule: **`core-engine` never
imports React, DOM, or Capacitor APIs** — it operates on `ImageBitmap`/
`OffscreenCanvas`/typed arrays and plain data, so the same code is unit
tested headlessly and is portable if we ever need a native rendering path.

| Module | Package | Doc |
| --- | --- | --- |
| Image Import | `apps/web` + `core-engine` | [01](01-image-import.md) |
| Image Editing (crop/rotate/flip) | `core-engine` | [02](02-image-editing.md) |
| Image Processing / Filters | `core-engine` | [03](03-image-processing-filters.md) |
| Grid Engine | `core-engine` | [04](04-grid-engine.md) |
| Canvas Renderer | `renderer` | [05](05-canvas-renderer.md) |
| Workspace (zoom/pan/gesture) | `apps/web` | [06](06-workspace-interaction.md) |
| Export | `core-engine` + `apps/web` | [07](07-export-engine.md) |
| Projects/Presets/Sync | `api-client` + Supabase | [08](08-project-sync-backend.md) |
| Settings | `apps/web` | [09](09-settings-preferences.md) |
| Android shell | `apps/android` | [10](10-mobile-android-shell.md) |
| Data model | `shared-types` | [11](11-data-model-schema.md) |

## 6. Core architectural invariants (apply to every module)

These map directly to Knowledge Items and must not be violated by any future
feature:

1. **Non-destructive**: the original imported bitmap is never mutated. All
   edits are entries in an ordered `EditStack` (data, not pixels) replayed to
   produce a render. See [`ki-non-destructive-editing`](../../.agents/knowledge/ki-non-destructive-editing.md).
2. **Grid/image independence**: the Grid Engine consumes only image
   *dimensions*, never pixel data. Adjusting brightness must not trigger grid
   recalculation; only geometry changes (crop/rotate/resize) do.
3. **Canvas-first**: UI chrome is transient (sheets/dialogs over the canvas),
   never a navigation stack that leaves the canvas.
4. **Immediate feedback**: every slider/toggle must reflect in the canvas
   within one frame budget target (<100ms per NFR, see phase docs).
5. **Sync is additive, not load-bearing for the golden path**: the app must
   be fully usable offline on a single device; sync failures degrade to "not
   yet synced," never to data loss or a blocked workspace.

## 7. Cross-cutting NFRs (carried from the source spec's Stage 10/11)

| Requirement | Target |
| --- | --- |
| Cold start (web, warm cache) | < 2s |
| Filter/adjustment preview latency | < 100ms |
| Grid redraw | 60fps during pan/zoom |
| Export (12MP image) | < 5s |
| Peak memory (mobile WebView) | < 300MB |
| Offline usability | Full editing works with zero network |

## 8. Open decisions for reviewer sign-off

- [ ] **Backend**: Supabase (recommended, fastest to a working cross-sync
      MVP) vs. self-hosted Node/Postgres/S3 (more control, more ops burden).
      Default: Supabase; revisit if data residency/compliance needs emerge.
- [ ] **State management**: Zustand (recommended, minimal boilerplate) vs.
      Redux Toolkit.
- [ ] **Monorepo tool**: Turborepo (recommended) vs. Nx.
- [ ] Whether Phase 6 (AI-assist, perspective guides, annotation) is in scope
      at all for this engagement, or purely illustrative of long-term room to
      grow (source spec's Stage 10/11 roadmap).
