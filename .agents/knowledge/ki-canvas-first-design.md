---
name: canvas-first-design
description: The reference image stays the primary focus at nearly all times; UI chrome is transient and secondary.
type: knowledge-item
---

# Canvas-First Design

## Principle

The reference image is the interface. All tools — toolbars, panels,
dialogs — are temporary guests that appear over the canvas and disappear
when done. The app is never "navigated" away from the canvas into a
separate screen for a routine editing action.

## Origin

Source spec §2.1: *"Unlike photo editors that emphasize tool palettes, the
drawing reference remains the primary focus at nearly all times."* Reinforced
by §11.6 as UX Principle #1, and scored 9/10 in the product audit (§9.5,
"Aesthetic & Minimalist Design") — this is the source app's single
strongest trait.

## Why it matters

The app's entire value proposition is "assist observational drawing," not
"be a full editor." Every pixel of screen space spent on permanent chrome is
a pixel not spent on the thing the artist is actually trying to look at.
This also directly shapes performance priorities — the canvas render loop
is the thing that must never stutter, even if a settings dialog is janky.

## Rules

- **Do** implement new tools as overlays/sheets/docks over the canvas, never
  as a route/page navigation that hides the canvas.
- **Do** keep the canvas visible (even if partially obscured) during any
  modal interaction where feasible — e.g. a bottom sheet leaves the top of
  the canvas visible; a full-screen takeover should be rare and justified.
- **Do** extend this to desktop: the adaptive side-panel layout (see
  [06-workspace-interaction.md](../../docs/architecture/06-workspace-interaction.md))
  is chrome *around* the canvas, not a replacement navigation model — the
  canvas still dominates the available space at every breakpoint.
- **Don't** add a feature that requires leaving the workspace to configure
  (e.g. a separate "manage presets" page that isn't reachable from within
  the canvas view) without a strong reason.
- **Don't** let native platform chrome (Android status bar, splash screen)
  creep into claiming canvas space beyond what's unavoidable.

## Evaluating a new feature against this KI

Ask: *"When this feature is active, can the artist still see and reference
their image?"* If the honest answer is no, the feature needs a design pass
before it ships, not after.
