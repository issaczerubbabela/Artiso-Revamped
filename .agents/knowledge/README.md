# Knowledge Items — Drawing Grid

Knowledge Items (KIs) are the distilled philosophies of Drawing Grid,
sourced from the reverse-engineered product spec's observed design
principles (source spec §3, §2.1, §11.6) and extended where the new
cross-platform/cross-sync scope introduces genuinely new territory the
source app never had to reason about.

**Every new feature proposal — during design review or during
implementation — should be checked against each of these.** If a feature
can't satisfy one, that's not automatically a blocker, but it must be an
explicit, written trade-off, not an oversight.

| KI | One-line principle |
| --- | --- |
| [ki-canvas-first-design.md](ki-canvas-first-design.md) | The reference image is the interface; chrome is a guest. |
| [ki-non-destructive-editing.md](ki-non-destructive-editing.md) | The original is sacred; edits are data, not pixels. |
| [ki-sequential-progressive-workflow.md](ki-sequential-progressive-workflow.md) | Guide the natural order; don't expose everything at once. |
| [ki-simplicity-first.md](ki-simplicity-first.md) | One or two taps/clicks for anything common. |
| [ki-immediate-feedback.md](ki-immediate-feedback.md) | Every control updates the canvas before the user notices a delay. |
| [ki-grid-image-independence.md](ki-grid-image-independence.md) | The grid is math over dimensions, never over pixels. |
| [ki-cross-device-continuity.md](ki-cross-device-continuity.md) | Sync extends the workflow; it never gates or breaks it. |

## How these relate to the architecture invariants

[`docs/architecture/00-system-overview.md §6`](../../docs/architecture/00-system-overview.md#6-core-architectural-invariants-apply-to-every-module)
lists five invariants — those are these same KIs stated as engineering
rules rather than product philosophy. The KIs here carry the *why*; the
architecture doc carries the *how*.
