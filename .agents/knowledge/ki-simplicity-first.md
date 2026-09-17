---
name: simplicity-first
description: Most operations require only one or two taps or clicks; discoverability matters as much as capability.
type: knowledge-item
---

# Simplicity First

## Principle

Common operations are reachable in one or two interactions. Capability
should never come at the cost of the app becoming hard to learn for a
first-time artist who just wants to import a photo and start drawing.

## Origin

Source spec §3 ("Simplicity First: Most operations require only one or two
taps"), and directly informs the target personas' stated needs (§2:
Beginner Artists need "Simple controls," Students need "Low learning curve"
and "Minimal configuration").

This KI also absorbs the source app's most consistently flagged weakness
across every audit section (§7.32, §9.5 "Recognition Rather Than Recall"
scored only 6/10, §9.7 accessibility gaps): **icon-only controls without
labels undermine simplicity even when the underlying action is genuinely
simple**, because the artist can't tell what the icon does without
experimentation. Simplicity is about *actual* ease of use, not merely a
sparse UI.

## Why it matters

The app's audience spans total beginners to working professionals under
deadline. A feature that's technically "one tap" but requires memorizing an
ambiguous icon isn't actually simple for a first-time user — it's simple
only for someone who already learned it.

## Rules

- **Do** default to labeled toolbar icons (per
  [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md#toolbar-redesign-baseline-source-spec-733-adopted)) —
  this single change is the highest-leverage fix carried over from the
  source audit.
- **Do** count taps/clicks for any new common action during design review;
  if it exceeds two for something a Beginner or Student persona would do
  routinely, reconsider the flow.
- **Do** provide sensible, synced defaults (grid presets, filter presets,
  medium-based recommended settings — see
  [03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md#recommended-presets-carried-directly-from-source-spec-417-to-seed-the-default-preset-library--see-08))
  so a new artist never faces a blank slate of parameters to configure.
- **Don't** add configuration options whose default doesn't already produce
  a good result — options should be for refinement, not a requirement to
  get started.
- **Don't** trade discoverability for density on desktop just because there's
  more screen space available — an icon-only "compact" mode is opt-in, not
  the default, per [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md).

## Evaluating a new feature against this KI

Ask two questions: *"Can a first-time user tell what this control does
without trying it?"* and *"How many interactions does the common case
take?"*
