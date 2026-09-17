// Restrained on purpose: two radii, not a "rounded-everything" default. Small
// for controls/swatches, medium for the sheet/dock surfaces that lift above
// the canvas (see CLAUDE.md: "flat by default, elevation only to clarify
// hierarchy").
export const RADIUS = {
  sm: 6,
  md: 10,
} as const;

export type RadiusToken = keyof typeof RADIUS;
