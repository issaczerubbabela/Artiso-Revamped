# Workflow: Build the Filter/Adjustment Pipeline

Architecture: [docs/architecture/03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md)

## Trigger

Implementing the WebGL shader-chain that turns `EditStack` adjustment/filter
entries into the rendered image — Phase 1 (brightness/contrast/saturation +
grayscale) and Phase 3 (full filter suite) work.

## Preconditions

- [Canvas Renderer](../../docs/architecture/05-canvas-renderer.md)'s
  WebGL image-layer canvas exists and can accept a compiled shader program.
- `Reference.editStack` shape is finalized in `shared-types`.

## Procedure

1. **Respect the fixed pipeline order.** Color correction/brightness →
   contrast → saturation → structural filter. This order is not
   user-configurable — only the parameters within each stage are. Do not
   let a UI feature request ("let me reorder my filters") leak into the
   engine without revisiting
   [03-image-processing-filters.md](../../docs/architecture/03-image-processing-filters.md)
   first.
2. **One shader pass per active stage.** Compile a fragment shader chain
   from the `EditStack`'s adjustment/filter entries at the moment the stack
   changes structurally (a filter toggled on/off) — not on every parameter
   tweak.
3. **Parameter changes are uniform updates, not recompiles.** Slider drag
   (brightness/contrast/saturation/filter params) must only update shader
   uniforms on the existing compiled program. This is the mechanism that
   hits the <100ms preview NFR — if a slider drag is triggering a shader
   recompile, that's a bug, not a performance tuning problem.
4. **Render against the working bitmap, always**, in the interactive path.
   The full-resolution re-render only happens inside
   [Export](build-export-pipeline.md) — never wire a live UI control
   directly to the original asset.
5. **Never touch the Grid Engine from here.** A filter/adjustment change
   must not call into grid recalculation. If you find yourself needing to,
   the grid/image independence invariant is being violated — stop and
   revisit [00-system-overview.md §6](../../docs/architecture/00-system-overview.md#6-core-architectural-invariants-apply-to-every-module).
6. **Gate expensive filters by Performance Mode.** Edge Detection and
   Pencil Sketch are flagged "High" cost (source spec §6.26) — check
   `PerformanceMode` before running them at full preview resolution; degrade
   gracefully (lower preview resolution, not a frozen UI) in Battery Saver.

## Files/modules touched

`packages/core-engine/src/filters/*` (shader source + pipeline
composition), `packages/renderer/src/imageLayer.*` (executes the compiled
chain), UI panels for Adjustments/Filters in `apps/web`.

## Testing checklist

- [ ] Unit test the pipeline composition function headlessly (given an
      `EditStack`, does it produce the expected ordered shader chain?) —
      doesn't require an actual GPU context for this part.
- [ ] Visual regression: fixed test-image set run through each filter,
      compared against reference output.
- [ ] Measure preview latency on slider drag — must stay under 100ms on
      reference hardware.
- [ ] Confirm changing a filter parameter never triggers a Grid Engine
      recalculation (add an explicit assertion/spy in integration tests).

## Common pitfalls

- Recompiling shaders on every `requestAnimationFrame` tick instead of only
  on structural `EditStack` changes.
- Implementing a new filter as a CPU (Canvas2D `getImageData`/`putImageData`)
  pass "because it's simpler" — this silently breaks the <100ms NFR for
  large working bitmaps and should be caught in review.
- Letting filter order become user-configurable without updating the
  architecture doc and re-validating source spec §6.27's ordering guidance.

## Related knowledge items

[`ki-immediate-feedback`](../knowledge/ki-immediate-feedback.md),
[`ki-grid-image-independence`](../knowledge/ki-grid-image-independence.md),
[`ki-non-destructive-editing`](../knowledge/ki-non-destructive-editing.md).

## See also

[add-new-filter-recipe.md](add-new-filter-recipe.md) for the smaller-scope
"add one filter" version of this workflow once the pipeline itself exists.
