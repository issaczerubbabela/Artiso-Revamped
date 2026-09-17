---
name: grid-image-independence
description: The grid is computed purely from image dimensions and its own config — never from pixel content or image adjustments.
type: knowledge-item
---

# Grid/Image Independence

## Principle

The Grid Engine operates on the working image's *dimensions* and its own
`GridConfig` only. It has no knowledge of, and no dependency on, pixel
content, brightness, contrast, saturation, or active filters. Adjusting
image processing must never trigger grid recalculation; only geometry
changes (crop/rotate/flip/resize) or grid config changes do.

## Origin

Source spec §3.3 ("the grid is rendered as an overlay layer, allowing image
adjustments and grid settings to remain independent"), §3.13 ("adjustments
to the image do not require regenerating the grid unless dimensions
change"), §8.8 ("This architecture allows image adjustments without
regenerating the grid unless image geometry changes").

## Why it matters

Two concrete payoffs, one product-level and one engineering-level:

1. **Product**: an artist can freely experiment with brightness/contrast/
   filters mid-session without ever losing their carefully configured grid
   — nothing about tuning the image "resets" the spatial reference they're
   drawing against.
2. **Engineering**: this is the specific design choice that makes 60fps
   pan/zoom achievable (see
   [05-canvas-renderer.md](../../docs/architecture/05-canvas-renderer.md)) —
   grid geometry is cached and only reprojected through the viewport
   transform, never recomputed, as long as this independence holds.

## Rules

- **Do** keep the Grid Engine's public interface limited to
  `(width, height, GridConfig) → GridGeometry` — no bitmap or pixel data
  parameter, ever.
- **Do** verify the two-trigger contract with an explicit integration test:
  a filter/adjustment change must **not** cause grid regeneration; a
  crop/rotate/flip/config change **must**. See
  [build-grid-overlay-renderer.md](../workflows/build-grid-overlay-renderer.md).
- **Don't** let a future feature (e.g. an "AI-suggested grid density based
  on image complexity," source spec §3.18's "Dynamic Grid Density") violate
  this by making the Grid Engine read pixel content directly — if that
  feature is ever built, it must compute its suggestion as a *separate*
  analysis step that produces a plain `GridConfig` change, not as the Grid
  Engine itself gaining a pixel-data dependency.
- **Don't** couple grid rendering to the WebGL image layer's render cycle —
  they are two independent passes composited by the renderer, not one
  pipeline (see [05-canvas-renderer.md](../../docs/architecture/05-canvas-renderer.md#two-canvas-architecture)).

## Evaluating a new feature against this KI

Ask: *"Does this feature require the Grid Engine to know anything about
pixel values, or only about dimensions and configuration?"* If it needs
pixel data, that logic belongs upstream, producing a `GridConfig` change —
not inside the Grid Engine itself.
