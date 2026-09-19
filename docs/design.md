# Artiso — Design System (LOCKED)

Replaces the "Design language — minimal, modern, quiet" section of `CLAUDE.md` in
full, and the values in `packages/ui/src/tokens/`. This is not an amendment to the
old system — the old palette (warm neutrals, single "non-photo blue" accent, IBM
Plex Sans, flat-by-default chrome) is retired. This document is the source of truth
going forward.

**Confirmed direction: Dark Matte Studio chrome + Drafting Board canvas.**
Explored alternatives (Frosted Glass, Warm Glass, Void canvas, Deep Focus canvas)
remain on the design canvas as artboards for reference, each clearly marked
"Explored, not selected."

---

## 1. What it looks like

Dark, opaque, matte panels — closer to DaVinci Resolve or Ableton than to a phone
OS. No frosted/glassy blur anywhere in the chrome. The canvas — the actual reference
photo the artist is looking at — sits on a warm, textured "drafting table" surface
rather than a neutral void: a soft desk-lamp glow from the upper-left and a very
fine dot-grid paper texture underneath, evoking the physical surface Artiso sits
next to. Rail, dock, top bar and the zoom pill all float as inset matte panels over
that surface; the canvas itself is full-bleed, edge to edge.

No animated transitions anywhere. Hover/active/open/close states are instant swaps.
The material (matte panels + the drafting-board surface) supplies the "modern,
considered" feeling instead of motion.

## 2. Color

| Token | Dark (default) | Light (derived — not yet visually verified on the canvas) |
|---|---|---|
| `surface` | `#0A0A0B` | `#F5F1EA` |
| `surfaceRaised` | `#141416` | `#FBF8F2` |
| `ink` | `#EDEDEA` | `#221F1B` |
| `inkMuted` | `#8B8883` | `#6B675F` |
| `border` | `#26272A` | `#E2DCCF` |
| `accent` | `#34E2E2` (cyan) | `#0E7A7A` |
| `accentSecondary` | `#FFB454` (amber) | `#B4650A` |
| `accentContrast` | `#052227` | `#FFFFFF` |
| `danger` | `#E5484D` | `#C23B3B` |

Dark is the primary, default theme — this app opens dark by default, the way
DaVinci Resolve or Lightroom's dark UI does. Light is included for completeness
(accessibility, user preference, outdoor daylight use) with the same hue family,
contrast-corrected for a light background, but it hasn't been built as an artboard
yet — say the word if you want it mocked up before it ships.

**Two accents, one rule:** cyan is the general interactive accent (selection,
slider fill, focus, links). Amber is reserved *only* for the active-tool glow —
it never appears anywhere else. That's what keeps a two-accent palette from
reading as busy.

Panels use these as solid bases, but the actual chrome is composited with alpha
(see §5) — `surfaceRaised`/`ink`/`border` are the flat fallback values for contexts
that can't do the translucent composite (e.g. a plain list row).

## 3. Typography

| Role | Typeface | Notes |
|---|---|---|
| Headings / panel titles | **Space Grotesk** (600–700) | Geometric, slightly technical |
| Body / UI labels / buttons | **Manrope** (400–600) | Clean humanist sans, not Inter/Roboto/Arial |
| Numeric readouts (thickness, opacity, zoom %, coordinates) | **JetBrains Mono** (500) | Tabular figures for values that change |

Self-host all three for the offline/Android build (`next/font/local`), same pattern
already planned for the retired IBM Plex Sans.

| Token | Size / line-height / weight |
|---|---|
| `label` | 12px / 16px / 600, uppercase, +2% letter-spacing |
| `body` | 15px / 22px / 400 |
| `heading` | 20px / 26px / 600 |
| `mono` (new) | 12–13px / 16px / 500 |

## 4. Control-type mapping

The rule the grid-thickness control was breaking (a button group standing in for a
slider). Applies to every control in the app:

| Data shape | Control | Examples |
|---|---|---|
| Continuous numeric value | **Slider** + live mono readout next to its label | Line thickness, opacity, brightness, contrast, saturation, zoom |
| Exact integer count | **Stepper** (− / value / +) | Grid columns, grid rows, undo depth |
| Small exclusive set (≤5), visually distinct | **Segmented icon buttons**, `aria-pressed` | Grid type, crop aspect ratio, blend mode |
| Free/open color choice | **Swatches** (presets) + one custom-color swatch | Grid color, canvas background |
| Boolean | **Switch** | Snap to guides, show coordinates, gesture lock |
| Long or rarely-changed list | **Dropdown / select** | Export file format, unit system |
| One-shot, possibly destructive action | **Button** (labeled if destructive) | Reset grid, delete project |

Button groups are reserved for the "small exclusive set" row only.

## 5. Material recipe (matte panel — rail, dock, top bar, zoom pill)

```css
background: rgba(19, 20, 22, .86);
backdrop-filter: blur(10px);           /* deliberately light — matte, not glassy */
border: 1px solid rgba(255, 255, 255, .055);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035), 0 10px 30px rgba(0, 0, 0, .55);
border-radius: 12px;                   /* 10px on the top bar/pill, 12px on rail/dock */
```

Active/selected states get a soft glow (`box-shadow` with the accent at low alpha),
never a border-left accent stripe. The active-tool icon specifically glows amber:

```css
background: linear-gradient(160deg, rgba(255,180,84,.22), rgba(255,180,84,.06));
border-color: rgba(255,180,84,.45);
box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 14px rgba(255,180,84,.25);
```

## 6. Canvas surface — "Drafting Board"

The reference-photo area, full-bleed, edge to edge:

```css
background:
  radial-gradient(circle at 20% 15%, rgba(255, 200, 140, .16), transparent 45%),
  linear-gradient(160deg, #2A2622 0%, #1A1714 55%, #121010 100%);
```

A dot-paper texture sits on top, at low opacity, independent of the tool's own
configurable grid overlay:

```css
background-image: radial-gradient(circle, rgba(255, 255, 255, .06) 1px, transparent 1.6px);
background-size: 14px 14px;
```

The artist's own grid overlay draws above both, using the live `accent` color at a
configurable opacity/thickness (defaults: 45% opacity, 1.5px, 48px cell size) — this
was already tunable in the mockup's Tweaks panel and carries straight into the real
grid-config UI.

## 7. Layout

Breakpoint *structure* is unchanged from the retired spec — it was sound UX, only
restyled:

| Breakpoint | Width | Chrome |
|---|---|---|
| Compact | < 768px | Bottom matte toolbar (icon-only) + bottom matte sheet for the active tool's panel |
| Regular | 768–1023px | Same rail; panel becomes a dismissible matte overlay drawer instead of a persistent dock |
| Wide | ≥ 1024px | Persistent floating left icon rail + persistent floating right dock, both matte panels inset 16px over the canvas |

Every touch target stays ≥44px. Icons are **icon-only by default** — a deliberate
change from the retired spec's "labeled icons by default" — mitigated by a tooltip
label on hover/focus, so recognition isn't lost, just deferred to intent (see the
`ki-simplicity-first` update below).

**Immersive / fullscreen mode:** rail and dock collapse to a 4px edge hint, revealed
by moving the cursor to that edge; only a tiny exit-fullscreen pill and a
current-tool chip remain visible while actively drawing.

## 8. What's still open

- Light theme hasn't been mocked up as an artboard — the table in §2 is a
  contrast-corrected derivation, not something you've seen.
- Compact/Regular breakpoint mockups don't exist yet, same tokens apply structurally.
- `danger` color is defined but unused in any mockup so far (no destructive-action
  UI has been drawn).

## 9. Repo changes made alongside this document

- `CLAUDE.md` — "Design language" section rewritten to point here and carry a
  condensed version of §1–4 and §7 for quick reference.
- `.agents/knowledge/ki-simplicity-first.md` — the "labeled icons by default" rule
  updated to "icon-only by default, tooltip on hover/focus" to match §7, with the
  reasoning preserved.
- `packages/ui/src/tokens/` — `color.ts`, `typography.ts`, `radius.ts`,
  `elevation.ts`, `motion.ts`, `tokens.css` rewritten to match this document; new
  `canvas.ts` added for the Drafting Board surface tokens; `index.ts` updated to
  export it. `breakpoints.ts` and `touch-target.ts` are unchanged — nothing about
  them was in scope.
