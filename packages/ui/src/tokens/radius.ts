// Locked direction (docs/design.md §5): the matte-panel chrome and the
// floating zoom pill use more generous rounding than the retired
// "flat-by-default, sm/md only" scale. Four steps instead of two — sm for
// small controls/swatches, md for standard panels, lg for the rail/dock's
// larger surfaces, pill for the fully-rounded floating zoom control.
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof RADIUS;
