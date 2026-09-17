# Agent Workflows — Artiso

These are step-by-step build guides for implementing specific features of
the Artiso rebuild. They assume familiarity with
[`docs/architecture/`](../../docs/architecture/) — read the relevant
architecture doc(s) linked at the top of each workflow before following it.

Every workflow ends with a check against
[`.agents/knowledge/`](../knowledge/README.md) — no feature should ship that
violates a Knowledge Item, regardless of how well it satisfies its own
workflow's steps.

## Feature-build workflows

| Workflow | Builds |
| --- | --- |
| [build-image-import-pipeline.md](build-image-import-pipeline.md) | Import module: pick/decode/downsample/register |
| [build-crop-rotate-flip.md](build-crop-rotate-flip.md) | Geometric edit operations |
| [build-filter-pipeline.md](build-filter-pipeline.md) | The WebGL shader-chain image processing pipeline |
| [build-grid-overlay-renderer.md](build-grid-overlay-renderer.md) | Grid Engine geometry + Canvas2D overlay |
| [build-canvas-zoom-pan-gestures.md](build-canvas-zoom-pan-gestures.md) | Viewport transform + input handling |
| [build-export-pipeline.md](build-export-pipeline.md) | Full-resolution export & platform save/share |
| [build-project-cloud-sync.md](build-project-cloud-sync.md) | Offline-first Supabase sync engine |
| [build-android-capacitor-shell.md](build-android-capacitor-shell.md) | Wrapping the web build for Android |

## Recipe workflows (repeatable, smaller-scope additions)

| Workflow | Use when |
| --- | --- |
| [add-new-filter-recipe.md](add-new-filter-recipe.md) | Adding one new filter/adjustment to the existing pipeline |
| [add-new-grid-type-recipe.md](add-new-grid-type-recipe.md) | Adding a new grid/guide type (perspective, radial, etc.) |

## Conventions used in every workflow

- **Trigger** — when to reach for this workflow.
- **Preconditions** — what must already exist/be true.
- **Procedure** — ordered steps.
- **Files/modules touched** — expected blast radius; anything outside this
  list is a signal to stop and reconsider the approach.
- **Testing checklist** — what must be verified before calling it done.
- **Common pitfalls** — mistakes specific to this feature area.
- **Related knowledge items** — philosophies this feature must not violate.
