// Locked direction (docs/design.md §5): matte panels, not glass. Every
// floating chrome surface (left icon rail, right tool dock, top bar,
// bottom zoom pill) uses the SAME recipe. Opaque matte, no backdrop blur:
// at .95 alpha a blur is invisible, and text stays >= 4.5:1 over even a white
// photo (at the earlier .86 it fell to ~3.5:1); it also spares the 60fps
// canvas a per-frame blur pass (docs/design.md §5).
export const MATTE_PANEL = {
  dark: {
    background: 'rgba(19, 20, 22, .95)',
    border: '1px solid rgba(255, 255, 255, .055)',
    insetHighlight: 'inset 0 1px 0 rgba(255, 255, 255, .035)',
    shadow: '0 10px 30px rgba(0, 0, 0, .55)',
  },
  light: {
    // Derived, not yet visually verified — see docs/design.md §8.
    background: 'rgba(251, 248, 242, .95)',
    border: '1px solid rgba(34, 31, 27, .08)',
    insetHighlight: 'inset 0 1px 0 rgba(255, 255, 255, .6)',
    shadow: '0 10px 30px rgba(34, 31, 27, .12)',
  },
} as const;

// The active-tool icon glows amber (accentTool) — the one place that
// color is allowed to appear, per the two-accent rule in color.ts.
export const ACTIVE_TOOL_GLOW = {
  background:
    'linear-gradient(160deg, rgba(255,180,84,.22), rgba(255,180,84,.06))',
  border: '1px solid rgba(255, 180, 84, .45)',
  shadow:
    'inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 14px rgba(255, 180, 84, .25)',
} as const;

// General selected/active state elsewhere (segmented buttons, swatches,
// switches) glows with the primary accent (cyan) instead — same shape,
// different color, never the amber above.
export const ACTIVE_ACCENT_GLOW = {
  background:
    'linear-gradient(160deg, rgba(52,226,226,.20), rgba(52,226,226,.05))',
  border: '1px solid rgba(52, 226, 226, .5)',
  shadow: '0 0 0 2px rgba(52, 226, 226, .35)',
} as const;
