// Locked direction: Dark Matte Studio + Drafting Board canvas (see
// docs/design.md). Dark is the PRIMARY, default theme — this app opens dark
// by default, the way DaVinci Resolve or Lightroom's dark UI does, not the
// "light default, dark as an override" pattern the retired palette used.
//
// Two accents, one rule: `accent` (cyan) is the general interactive accent
// (selection, slider fill, focus, links). `accentTool` (amber) is
// reserved ONLY for the active-tool glow — it must never be reused
// elsewhere (renamed from `accentSecondary`, whose name invited reuse).
// Introducing a third accent is out of scope without a design review.
//
// `border` is a hairline for a panel's own edge — decoration only, ~1.2:1.
// `borderStrong` is the boundary of anything operable (inputs, slider
// tracks, swatches, segmented buttons, switch tracks) and clears 3:1 against
// the panel in the worst case (WCAG 1.4.11). Never use `border` for that.
//
// These are solid, opaque hex values only (tests enforce 6-digit hex and
// matching key sets between themes). The actual chrome renders these
// composited with alpha per docs/design.md §5 (matte panel recipe) and §6
// (Drafting Board canvas) — see packages/ui/src/tokens/elevation.ts and
// canvas.ts for those alpha-based recipes. The values here are the flat
// fallback for contexts that can't do the translucent composite (e.g. a
// plain list row, or a native control that only accepts a solid color).
//
// LIGHT_COLORS is a contrast-corrected derivation of the same hue family,
// NOT yet visually verified as an artboard on the design canvas — treat it
// as provisional (see docs/design.md §8, "What's still open") until a
// light-mode mockup exists.

export const DARK_COLORS = {
  surface: '#0A0A0B',
  surfaceRaised: '#141416',
  ink: '#EDEDEA',
  inkMuted: '#8B8883',
  border: '#26272A',
  borderStrong: '#6A6B71',
  accent: '#34E2E2',
  accentTool: '#FFB454',
  accentContrast: '#052227',
  danger: '#E5484D',
} as const;

export const LIGHT_COLORS = {
  surface: '#F5F1EA',
  surfaceRaised: '#FBF8F2',
  ink: '#221F1B',
  inkMuted: '#6B675F',
  border: '#E2DCCF',
  borderStrong: '#8F897B',
  accent: '#0E7A7A',
  accentTool: '#B4650A',
  accentContrast: '#FFFFFF',
  danger: '#C23B3B',
} as const;

export type ColorToken = keyof typeof DARK_COLORS;
export type ColorTheme = 'light' | 'dark';

// The app's default theme, and — until the light theme has been verified as
// an artboard — its only automatic one: the OS colour-scheme preference is
// deliberately NOT followed (docs/design.md §2).
export const DEFAULT_COLOR_THEME: ColorTheme = 'dark';
