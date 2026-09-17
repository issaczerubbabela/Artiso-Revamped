// Shadows used sparingly, only where CLAUDE.md calls for it: a bottom sheet
// or side dock lifted subtly above the canvas. Dark mode uses a softer, more
// opaque shadow since a light-mode shadow value reads as a visible gray haze
// on a dark surface rather than a subtle lift.
export const ELEVATION = {
  dock: {
    light: '0 -2px 12px rgba(32, 30, 27, 0.10)',
    dark: '0 -2px 12px rgba(0, 0, 0, 0.45)',
  },
} as const;
