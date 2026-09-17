// One typeface (CLAUDE.md: "a single clean sans-serif"). IBM Plex Sans was
// chosen over a more generic default (e.g. Inter) for its slightly technical,
// instrument-like character — a quiet fit for a drafting/measurement tool
// without reaching for a display or novelty face. System-ui fallbacks keep
// the app legible before the webfont loads.
//
// The app must run fully offline (Android/Capacitor, PWA) so this family is
// self-hosted as a static asset in apps/web (via next/font/local) once real
// UI copy lands in Phase 1 — never loaded from a live Google Fonts CDN at
// runtime. The token preview in this package's dev-only Vite page may load it
// from a CDN for convenience since that page never ships.
export const FONT_FAMILY =
  '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

// Exactly three sizes per CLAUDE.md ("label, body, heading — not a dozen ad
// hoc sizes"). Labels stay sentence case, never all-caps.
export const TYPE_SCALE = {
  label: { fontSize: 13, lineHeight: 16, fontWeight: 500 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: 600 },
} as const;

export type TypeScaleToken = keyof typeof TYPE_SCALE;
