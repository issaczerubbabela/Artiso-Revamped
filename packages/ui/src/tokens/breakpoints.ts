// Fixed by docs/architecture/06-workspace-interaction.md — not a design
// choice, the same three breakpoints drive chrome switching (bottom sheet vs.
// side dock) throughout the app.
export const BREAKPOINTS = {
  compact: 0,
  regular: 768,
  wide: 1024,
} as const;

export const MEDIA_QUERIES = {
  regular: `(min-width: ${BREAKPOINTS.regular}px)`,
  wide: `(min-width: ${BREAKPOINTS.wide}px)`,
} as const;

export type BreakpointToken = keyof typeof BREAKPOINTS;
