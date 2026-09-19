# Artiso — Agent Instructions

This is a from-scratch rebuild of **Drawing Grid for the Artist** as a
cross-platform (web, then Android), cross-device-synced reference
preparation tool for artists. It is **not** a drawing app — it's a
companion the artist keeps open *next to* their physical paper/canvas while
they draw by hand, using a customizable grid to transfer proportions
accurately. Every decision in this codebase should be made with that use
case in mind: the app is glanced at, not stared at.

**Status: implementation-ready.** Design docs are approved. Build against
them, don't re-derive architecture from scratch.

## Read this first, every session

1. **What to build and how it fits together** →
   [`docs/architecture/`](docs/architecture/) — start with
   [`00-system-overview.md`](docs/architecture/00-system-overview.md), then
   read the specific module doc(s) for whatever you're touching (01–11,
   indexed in [`docs/README.md`](docs/README.md)).
2. **What order to build it in** → [`docs/phases/`](docs/phases/) —
   `phase-0` through `phase-9`. Work belongs to the phase it's scoped to;
   don't pull a later phase's feature forward without flagging it to the
   user first. Phases 7 and 8 (guides, multi-reference tabs, split view,
   collaboration) shipped after being pulled forward from `phase-6` by
   explicit instruction. **Phase 9** (drawing-grid overhaul, requirements in
   [`docs/architecture/Grid-Feature-Spec.md`](docs/architecture/Grid-Feature-Spec.md))
   is the active phase; where the spec conflicts with
   `architecture/04-grid-engine.md` the spec wins.
3. **How to build a specific feature** →
   [`.agents/workflows/`](.agents/workflows/) — step-by-step procedures for
   each module, plus two reusable recipes (add a filter, add a grid type).
   If a workflow exists for what you're doing, follow it; don't improvise a
   different approach without a reason.
4. **What must never be violated** →
   [`.agents/knowledge/`](.agents/knowledge/) — seven Knowledge Items
   (Canvas-First, Non-Destructive Editing, Sequential Workflow, Simplicity
   First, Immediate Feedback, Grid/Image Independence, Cross-Device
   Continuity). Check new work against these before calling it done, the
   same way you'd check it against a lint rule.
5. **The original product spec** →
   [`docs/Drawing Grid for the Artist_ Reverse-Engineered Product
   Specification.md`](<docs/Drawing Grid for the Artist_ Reverse-Engineered Product Specification.md>) —
   the source of truth for *why* a given behavior exists when a doc above
   cites it (e.g. "source spec §4.17").
6. **The visual design system** → [`docs/design.md`](docs/design.md) — the
   full color/type/material/control-mapping spec behind the condensed
   version in this file's Design Language section below.

## Stack (decided, see `docs/architecture/00-system-overview.md`)

pnpm + Turborepo monorepo, TypeScript strict everywhere. Next.js (static
export) for `apps/web`. Capacitor wraps the same build for `apps/android`.
Supabase (Postgres + Auth + Storage + RLS) for cross-device sync. WebGL for
the image/filter pipeline, Canvas2D for the grid overlay, two stacked
canvases composited by `packages/renderer`. `packages/core-engine` is pure
TypeScript with no DOM/React dependency — testable headlessly, runs in a
Worker.

Still open (don't assume an answer, ask if it blocks you): Zustand vs.
Redux Toolkit for state management, Turborepo vs. Nx. Default to Zustand +
Turborepo per the architecture doc's recommendation unless told otherwise.

## Design language — Dark Matte Studio (locked)

**This replaces the previous "minimal, modern, quiet" design language in
full** — that palette, IBM Plex Sans, and the neutral+one-accent rule are
retired. The full spec (colors, type, material recipes, control-mapping
rules) lives in [`docs/design.md`](docs/design.md); this section is the
condensed version for quick reference. If the two ever disagree,
`docs/design.md` wins.

- **The canvas dominates, full-bleed.** The reference photo fills the
  entire viewport edge to edge; chrome floats *over* it as inset matte
  panels (16px margin, rounded corners), never a hard-edged sidebar that
  eats into the image. See
  [`ki-canvas-first-design`](.agents/knowledge/ki-canvas-first-design.md)
  (unchanged by this revision).
- **Matte, not glass.** Panels (rail, dock, top bar, zoom pill) are opaque
  matte surfaces — `rgba(19,20,22,.86)` with only `blur(10px)`, a hairline
  border, and a soft drop shadow. No frosted/heavy-blur glass anywhere in
  the chrome. See `docs/design.md` §5 for the exact recipe.
- **Two accents, one rule.** Cyan (`#34E2E2`) is the general interactive
  accent (selection, slider fill, focus, links). Amber (`#FFB454`) is
  reserved *only* for the active-tool glow — it never appears anywhere
  else. Don't add a third accent.
- **The canvas surface itself is "Drafting Board."** A warm graphite-brown
  base with a soft desk-lamp glow (upper-left) and a fine dot-paper texture
  underneath, independent of the artist's own configurable grid overlay.
  See `docs/design.md` §6.
- **One type system, three roles.** Space Grotesk for headings, Manrope for
  body/UI, JetBrains Mono for numeric readouts (thickness, opacity, zoom %,
  coordinates) — self-hosted for the offline/Android build. Three sizes
  only: label / body / heading.
- **Icon-only by default, tooltip on hover/focus.** This reverses the
  previous "labeled icons by default" rule —
  [`ki-simplicity-first`](.agents/knowledge/ki-simplicity-first.md) has been
  updated to match; read it before touching toolbar/rail components.
- **Control type follows data shape, not habit.** Continuous values
  (thickness, opacity, zoom) get a slider with a live monospace readout,
  never a button group. Exact counts get a stepper. A small exclusive set
  (≤5 options) gets segmented icon buttons. Free color gets swatches.
  Booleans get a switch. See `docs/design.md` §4 for the full table — this
  was a real bug in the previous grid-thickness control (a button group
  standing in for a slider) and the rule exists specifically to stop it
  recurring.
- **No animated transitions.** Hover/active/open/close states are instant
  swaps — the material carries the "modern" feeling, not motion. Canvas
  pan/zoom is still direct-manipulation and must track input 1:1 (unaffected
  by this rule — it was never "animation" in this sense, see
  [`ki-immediate-feedback`](.agents/knowledge/ki-immediate-feedback.md)).
- **Adaptive, not two apps.** Persistent floating rail + dock on wide
  viewports (≥1024px), bottom matte toolbar + bottom matte sheet below
  768px, a dismissible overlay drawer in between — one component tree,
  chrome swaps by breakpoint, same structure as before, restyled. See
  [`06-workspace-interaction.md`](docs/architecture/06-workspace-interaction.md).
- **Immersive/fullscreen mode.** Rail and dock collapse to a 4px edge hint
  that reveals on hover/cursor-near-edge; only an exit-fullscreen pill and
  the current-tool chip remain visible while actively drawing.
- **Every touch target ≥44px**, regardless of density — unchanged,
  non-negotiable.

Light theme colors are defined in `docs/design.md` §2 (contrast-corrected
derivations of the dark palette) but have not been visually verified as an
artboard yet — treat them as provisional until that pass happens.

When a screen or component's look-and-feel isn't fully specified by the
above, default to the confirmed Dark Matte Studio material and the
control-mapping table in `docs/design.md` §4, not to "less UI" for its own
sake — this system is intentionally richer than the retired one.

## Git discipline

- **Commit at meaningful checkpoints**: after a module's workflow
  procedure is complete and its tests pass, before starting a change that
  could break another module (schema change, pipeline reorder, a shared
  interface edit), and at the end of each phase's checklist items as they're
  completed — not one giant commit per phase.
- **One concern per commit.** Don't bundle an unrelated fix with a feature
  commit.
- **Before a breaking change**, commit the last known-good state first so
  it's a clean revert point — this matters especially for
  `packages/core-engine` and `packages/shared-types`, which everything else
  depends on (see [`11-data-model-schema.md`](docs/architecture/11-data-model-schema.md)'s
  note on blast radius).
- **Commit messages**: imperative mood, scoped to the module (e.g.
  `feat(grid-engine): generate rectangular grid geometry`,
  `fix(renderer): correct zoom anchor on high-DPI displays`). Explain *why*
  in the body when the reason isn't obvious from the diff alone — the
  workflow docs' "Common pitfalls" sections are good source material for
  this.
- Never commit without the user's request having implied it, per standard
  practice — but on an approved, in-progress implementation like this one,
  routine checkpoint commits during a build session are expected, not just
  a final commit.

## Testing discipline

- Every workflow in `.agents/workflows/` has a **Testing checklist** —
  treat it as required, not optional, before considering that piece of work
  done.
- `packages/core-engine` and `packages/renderer`'s pure-function logic
  (geometry, grid generation, pipeline composition): headless unit tests
  (Vitest), no DOM/GPU context required for the parts that don't need one.
- `apps/web` user-facing flows: Playwright E2E, covering the golden path
  (`Import → Prepare → Grid → Draw → Export`) at both the Compact and Wide
  breakpoints.
- Filters: visual regression against the fixed test-image set (see
  [`phase-3-filters-presets-export.md`](docs/phases/phase-3-filters-presets-export.md)).
- Before marking a phase's exit criteria met, its associated tests must be
  passing — exit criteria in the phase docs are written as verifiable
  checks for exactly this reason.
- Run the relevant package's test suite before every commit that touches
  `core-engine`, `renderer`, or `shared-types` (high blast radius); a
  scoped/isolated UI-only change can run just its own tests.

## Non-negotiable invariants (see `00-system-overview.md §6` for the full rationale)

1. Non-destructive: the original asset is never mutated; edits are
   `EditStack` entries replayed at render time.
2. Grid/image independence: filters and adjustments never trigger grid
   recomputation; only geometry or grid-config changes do.
3. Canvas-first: chrome is transient, never a navigation stack that hides
   the canvas.
4. Immediate feedback: every control reflects in the canvas within the
   documented latency budget (<100ms adjustments, 60fps pan/zoom).
5. Sync is additive: the app is fully usable offline; sync failures degrade
   to a visible status indicator, never to blocked editing or data loss.

## Repo layout

```text
/apps/web            Next.js PWA — the product
/apps/android         Capacitor native shell (generated + minimal custom code)
/packages/core-engine  Pure TS: image pipeline, grid engine, geometry, filters
/packages/renderer     Canvas2D/WebGL compositor
/packages/ui           Shared design-system components (design tokens live here)
/packages/api-client    Sync/offline-queue logic, Supabase client
/packages/shared-types  Zod schemas — source of truth for client + DB schema
/docs                  Architecture, phases, design system (see above)
/.agents                Workflows, Knowledge Items (see above)
```

## When something isn't covered here

If a decision genuinely isn't settled by the architecture docs, phase docs,
workflows, or KIs — ask the user rather than guessing, especially for
anything touching the data model, the sync/conflict model, or the fixed
pipeline ordering (crop/rotate/flip → adjustments → filters → grid). Design
and UX details not covered above should default to the Dark Matte Studio
material and control-mapping rules in this file's Design Language section
(full detail in `docs/design.md`), and can be a judgment call without
stopping to ask.
