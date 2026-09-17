---
name: sequential-progressive-workflow
description: Guide artists through the natural Import to Draw to Export progression instead of exposing every feature simultaneously.
type: knowledge-item
---

# Sequential, Progressive Workflow

## Principle

The interface guides users through a natural progression —
`Import → Prepare → Grid → Draw → Export` — rather than exposing every tool
at once. One tool mode is active at a time; the toolbar's *available*
options change based on where the artist is in that progression.

## Origin

Source spec §3 ("Sequential Workflow... guides users through a natural
progression rather than exposing every feature simultaneously"), §7.10
("the application activates one editing mode at a time... instead of Grid +
Crop + Brightness + Rotate visible simultaneously"), §7.34 ("Context-Aware
Toolbar... adapt based on the current workflow stage").

## Why it matters

This is what keeps a genuinely capable tool (source spec's audit rates
"Functionality" 9.0/10) from feeling overwhelming to the Beginner and
Student personas the app explicitly targets. It's also what makes the
"disable rather than error" error-handling principle (§7.30) coherent — if
tools were always all visible, "disabled because no image is loaded" would
need to be communicated for every single control at once.

## Rules

- **Do** gate tool availability on workflow state via the context-aware
  toolbar contract in
  [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md#context-aware-toolbar-source-spec-734-adopted-as-baseline).
- **Do** keep exactly one editing mode's controls visible at a time (Crop,
  *or* Filters, *or* Grid — not simultaneously), on both the Compact and
  Wide layouts.
- **Do** apply this to new features too: a new tool should slot into the
  existing mode list and inherit the same "gated by workflow state" rule,
  not introduce a permanently-visible new control.
- **Don't** add a permanently-docked panel "for convenience" that breaks the
  one-mode-at-a-time model — this is the specific thing that differentiates
  this app from a Photoshop-style multi-palette editor, and that
  differentiation is deliberate (source spec §7.10's explicit contrast).
- **Don't** confuse this with hiding capability — disabled/hidden controls
  must still be discoverable once their preconditions are met (see
  [ki-simplicity-first](ki-simplicity-first.md) on labeled icons).

## Evaluating a new feature against this KI

Ask: *"Does this feature's control appear only when it's actually
relevant to the artist's current step, and disappear when it's not?"*
