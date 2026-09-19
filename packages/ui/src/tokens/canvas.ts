// New in this revision (docs/design.md §6): the reference-photo area's own
// surface treatment, confirmed as "Drafting Board" after comparing it
// against a flat "Void" option and a "Deep Focus" vignette on the design
// canvas. Independent of the artist's own configurable grid overlay (that
// stays in the grid-engine config, driven by the user's chosen accent,
// thickness and opacity — see docs/architecture/04-grid-engine.md).
export const DRAFTING_BOARD_CANVAS = {
  // Base surface behind the loaded reference image, full-bleed.
  background:
    'radial-gradient(circle at 20% 15%, rgba(255, 200, 140, .16), transparent 45%), ' +
    'linear-gradient(160deg, #2A2622 0%, #1A1714 55%, #121010 100%)',
  // Fine dot-paper texture layered on top, at low opacity.
  textureImage:
    'radial-gradient(circle, rgba(255, 255, 255, .06) 1px, transparent 1.6px)',
  textureSize: '14px 14px',
} as const;

// Neutral surround (docs/design.md §6): flat, no glow, no texture. A warm
// surround can bias how the photo's colours read, so colour-critical work can
// opt into this instead of the Drafting Board. Per-device preference.
export const NEUTRAL_CANVAS = {
  background: '#1B1B1C',
} as const;

export type CanvasSurface = 'draftingBoard' | 'neutral';
export const DEFAULT_CANVAS_SURFACE: CanvasSurface = 'draftingBoard';

// Defaults for the artist's own configurable grid overlay, as tuned in the
// confirmed mockup's Tweaks panel. All three are user-adjustable at
// runtime (sliders for thickness/opacity, per the control-mapping table in
// docs/design.md §4) — these are just the seeded starting values.
export const GRID_OVERLAY_DEFAULTS = {
  thicknessPx: 1.5,
  opacityPercent: 45,
  cellSizePx: 48,
} as const;
