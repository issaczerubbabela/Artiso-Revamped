# Drawing Grid — Agent Instructions

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
   `phase-0` through `phase-6`. Work belongs to the phase it's scoped to;
   don't pull a later phase's feature forward without flagging it to the
   user first (this happened once already for multi-reference/split-view —
   it's deferred to `phase-6` by explicit decision).
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

## Design language — minimal, modern, quiet

The source app scored 9/10 on "Aesthetic & Minimalist Design" precisely
*because* it gets out of the way. The rebuild's UI must earn that same
score with a more contemporary visual language. Concrete rules, not
vibes:

- **The canvas dominates.** At every breakpoint, chrome is a thin frame
  around the reference image, never a competing focal point. See
  [`ki-canvas-first-design`](.agents/knowledge/ki-canvas-first-design.md).
- **Neutral surfaces, one accent color.** Background/panel surfaces in a
  restrained near-neutral palette (light and dark, both first-class, no
  "dark mode as an afterthought"). A single accent color marks
  active/selected state (active tool, focused input, grid color swatch
  selection) — don't introduce a second accent without a reason.
- **Flat by default, elevation only to clarify hierarchy.** Shadows/borders
  are used sparingly — e.g. a bottom sheet or side dock lifted subtly above
  the canvas — never as decoration.
- **One typeface, clear scale.** A single clean sans-serif, a small
  well-defined size/weight scale (label, body, heading — not a dozen ad hoc
  sizes). Labeled icons by default, per
  [`ki-simplicity-first`](.agents/knowledge/ki-simplicity-first.md) —
  icon-only is an opt-in density setting, never the default.
- **Motion is smooth and purposeful, never decorative.** Panel open/close,
  mode switches, breakpoint transitions: short (~150–250ms), eased
  transitions. No bounce, no attention-seeking animation. Respect
  `prefers-reduced-motion` unconditionally. Canvas pan/zoom itself is not
  "animated" in this sense — it's direct-manipulation and must track the
  input 1:1 (see
  [`ki-immediate-feedback`](.agents/knowledge/ki-immediate-feedback.md)).
- **Generous spacing, no clutter.** Whitespace in the chrome is a feature —
  it's part of what keeps the tool feeling calm next to a physical drawing
  surface. Don't fill empty space with controls just because it's
  available, especially on wide/desktop layouts.
- **Adaptive, not two apps.** Side panels on wide viewports (≥1024px),
  bottom sheets below that — one component tree, chrome swaps by
  breakpoint. See
  [`06-workspace-interaction.md`](docs/architecture/06-workspace-interaction.md).
- **Every touch target ≥44px**, regardless of how dense the layout looks —
  non-negotiable, carried from the source app's own accessibility gap
  (scored 6.5/10, explicit improvement target).

When a screen or component's look-and-feel isn't fully specified by the
above, default to *less* UI, not more. If in doubt, prototype the sparser
version first.

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
/docs                  Architecture, phases (see above)
/.agents                Workflows, Knowledge Items (see above)
```

## When something isn't covered here

If a decision genuinely isn't settled by the architecture docs, phase docs,
workflows, or KIs — ask the user rather than guessing, especially for
anything touching the data model, the sync/conflict model, or the fixed
pipeline ordering (crop/rotate/flip → adjustments → filters → grid). Design
and UX details not covered above should default to "sparser and quieter,"
per this file's Design Language section, and can be a judgment call without
stopping to ask.
