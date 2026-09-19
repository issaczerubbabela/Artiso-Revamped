// Locked direction (docs/design.md §3): three typefaces, one role each —
// not the retired spec's single typeface. Distinct from the AI-slop
// defaults (Inter, Roboto, Arial) on purpose.
//
// All three load from Google Fonts in design exploration; the shipped app
// must run fully offline (Android/Capacitor, PWA), so all three are
// self-hosted as static assets in apps/web (via next/font/local) once real
// UI copy lands in Phase 1 — never loaded from a live Google Fonts CDN at
// runtime. Same pattern the retired IBM Plex Sans token used to document.

export const FONT_FAMILY_HEADING =
  '"Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';

export const FONT_FAMILY_BODY =
  '"Manrope", system-ui, -apple-system, "Segoe UI", sans-serif';

export const FONT_FAMILY_MONO =
  '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

// Exactly three sizes (label, body, heading) — the retired spec's "not a
// dozen ad hoc sizes" rule still holds, just restyled. Consumers pick the
// family from the FONT_FAMILY_* constants above based on the element's
// role (heading vs. body/label); TYPE_SCALE only carries size/line-height/
// weight so it stays framework-agnostic.
export const TYPE_SCALE = {
  label: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: 600 },
} as const;

export type TypeScaleToken = keyof typeof TYPE_SCALE;

// New in this revision: numeric readouts (grid thickness, opacity, zoom %,
// canvas coordinates) render in FONT_FAMILY_MONO at this size, so values
// that change in place get tabular figures instead of reflowing. Kept
// separate from TYPE_SCALE (not a fourth "size" in the label/body/heading
// sense — it's a role, always paired with FONT_FAMILY_MONO).
export const MONO_READOUT_SCALE = {
  fontSize: 12,
  lineHeight: 16,
  fontWeight: 500,
} as const;

// `label` tokens render uppercase with a small positive tracking, per
// docs/design.md §3 — encoded here so consumers don't have to guess it.
export const LABEL_TEXT_TRANSFORM = 'uppercase' as const;
export const LABEL_LETTER_SPACING = '0.02em' as const;
