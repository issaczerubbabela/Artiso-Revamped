// 8px-based rhythm. Generous by default — whitespace in the chrome is a
// feature, not empty space to fill with controls (see CLAUDE.md "Design
// language").
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export type SpacingToken = keyof typeof SPACING;
