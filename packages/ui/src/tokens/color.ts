// Palette grounded in the tool's own subject matter rather than a generic
// SaaS default: warm "drafting paper" neutrals (the surface an artist's
// reference sits on) plus a single accent drawn from "non-photo blue" — the
// pale technical-pencil blue illustrators have used for decades for
// construction/guide lines that stay visually quiet against the work. A grid
// tool's accent color has a real-world ancestor in that exact pencil, so it
// reads as considered rather than a default blue. Deliberately not the
// cream+terracotta or near-black+neon combinations that read as generic
// AI-generated defaults.
//
// Both themes are first-class (see CLAUDE.md: "no dark mode as an
// afterthought") — dark mode is not a darkened copy of light mode's values,
// each swatch is tuned for its own background.

export const LIGHT_COLORS = {
  surface: '#F6F4EF',
  surfaceRaised: '#FBFAF7',
  ink: '#201E1B',
  inkMuted: '#6B6459',
  border: '#E3DFD6',
  accent: '#1E7FA6',
  accentContrast: '#FFFFFF',
  danger: '#B0402C',
} as const;

export const DARK_COLORS = {
  surface: '#17191B',
  surfaceRaised: '#202327',
  ink: '#EDEAE4',
  inkMuted: '#9B958A',
  border: '#33363A',
  accent: '#5AB4DA',
  accentContrast: '#0B1114',
  danger: '#E27B62',
} as const;

export type ColorToken = keyof typeof LIGHT_COLORS;
export type ColorTheme = 'light' | 'dark';
