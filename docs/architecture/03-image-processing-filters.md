# 03 — Image Processing & Filter Pipeline

Package: `packages/core-engine` (shader/pipeline definitions) +
`packages/renderer` (GPU execution)

## Purpose

Improve the *readability* of a reference image for drawing — not its
aesthetic quality (source spec §4.1/§4.3). Every adjustment and filter is
non-destructive: a parameterized entry in the `EditStack`, replayed against
the working bitmap at render time. See
[`ki-non-destructive-editing`](../../.agents/knowledge/ki-non-destructive-editing.md).

## Pipeline order (fixed, per source spec §4.2 / §6.2 / §6.27)

```
Working Bitmap (post crop/rotate/flip)
        │
        ▼
Color Correction / Brightness
        │
        ▼
Contrast
        │
        ▼
Saturation
        │
        ▼
Structural Filter (grayscale / edge-detect / sharpen / threshold / posterize / pencil-sketch / blur / invert)
        │
        ▼
→ handed to Canvas Renderer, which composites the Grid Engine's overlay on top
```

Order matters — the source spec explicitly calls this out (§6.27:
brightness→contrast→grayscale→sharpen produces a cleaner result than
sharpen-before-grayscale). The pipeline stage order is **fixed** in
`core-engine`; only parameters within each stage are user-controlled.

## Categories (source spec §4.4 / §6.3)

| Category | Adjustments | Execution |
| --- | --- | --- |
| Tonal | Brightness, Contrast | WebGL shader uniform, continuous slider |
| Color | Saturation | WebGL shader uniform |
| Structural | Edge enhancement, Sharpen | WebGL shader (convolution kernel) |
| Simplification | Grayscale, Threshold, Posterize, Pencil Sketch, Invert, Blur | WebGL shader (per-filter) |

## Execution model: shader chain

Each active adjustment/filter is a WebGL fragment-shader pass. The active
`EditStack` entries compile into an ordered shader chain re-run each frame
the working bitmap or any parameter changes:

```ts
type Operation =
  | { type: "brightness"; value: number }   // -100..100
  | { type: "contrast"; value: number }     // -100..100
  | { type: "saturation"; value: number }   // -100..100
  | { type: "filter"; id: FilterId; params?: Record<string, number> };

type FilterId =
  | "grayscale" | "highContrast" | "lowContrast" | "threshold"
  | "posterize" | "pencilSketch" | "edgeDetect" | "invert"
  | "blur" | "sharpen";
```

Slider drag → uniform update only (no shader recompile) → sub-frame latency,
satisfying the <100ms preview NFR. Toggling a filter on/off recompiles the
chain (cheap, infrequent).

## Relative cost (carried from source spec §6.26, informs render budget)

| Filter | Cost |
| --- | --- |
| Brightness / Contrast / Saturation | Very low |
| Grayscale / Threshold | Low |
| Blur / Sharpen / Posterize | Medium |
| Edge Detection / Pencil Sketch | High |

High-cost filters are the first candidates throttled or disabled under
**Performance Mode → Battery Saver** (see
[09](09-settings-preferences.md)).

## Recommended presets (carried directly from source spec §4.17, to seed the default Preset library — see [08](08-project-sync-backend.md))

| Medium | Brightness | Contrast | Saturation |
| --- | --- | --- | --- |
| Graphite | Slight ↑ | Medium–High | Low |
| Charcoal | Medium | High | Very Low |
| Colored Pencil | Neutral | Medium | Medium |
| Watercolor | Neutral | Medium | Medium–High |
| Oil / Acrylic | Neutral | Medium | High |

## Extensibility contract

Adding a new filter = register a shader module + one `FilterId` + a UI
control. It must **not** touch pipeline ordering, the Grid Engine, or
`EditStack` serialization beyond adding the new discriminated-union member.
See [`.agents/workflows/build-filter-pipeline.md`](../../.agents/workflows/build-filter-pipeline.md)
and [`.agents/workflows/add-new-filter-recipe.md`](../../.agents/workflows/add-new-filter-recipe.md).

## Dependencies

- [Canvas Renderer](05-canvas-renderer.md) — owns the WebGL context and runs
  the compiled shader chain.
- Explicitly **independent of** the [Grid Engine](04-grid-engine.md) — a
  filter/adjustment change must never trigger grid geometry recomputation.

## Open questions

- [ ] Exact algorithm choice for edge detection (Sobel vs. Canny) — source
  APK's implementation is unknown; Sobel proposed as the simplest
  GPU-friendly baseline.
