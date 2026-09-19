// Locked direction (docs/design.md §1, §7): NO animated transitions.
// Hover/active/open/close/breakpoint-switch state changes are instant
// swaps — the matte-panel material and the Drafting Board canvas carry the
// "modern, considered" feeling instead of motion. This reverses the
// retired spec's "short, eased transitions" rule; durationMs is 0 by
// design, not by accident, and there is no longer a separate
// prefers-reduced-motion carve-out because the default already satisfies
// it.
//
// This does NOT apply to canvas pan/zoom, which is direct-manipulation and
// must track input 1:1 regardless (see ki-immediate-feedback) — that was
// never "animation" in this token's sense and was always exempt.
export const MOTION = {
  durationMs: 0,
  easing: 'linear',
} as const;
