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

**Revision 2 (design review).** The direction above is unchanged. A review against
the running app fixed nine things the first pass got wrong or left out — contrast on
the matte panel, invisible control boundaries, chrome hiding the reference, a light
theme leaking in, colour-only active state, touch/keyboard access to labels and
immersive mode, and gaps in the layout spec. Each is folded into the section it
belongs to and summarised in §10.

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
considered" feeling instead of motion. Because every panel *floats* over the canvas
rather than sitting in the page flow, opening or closing one never reflows the
canvas by itself — that is what makes instant swaps feel stable rather than jumpy.

## 2. Color

| Token | Dark (default) | Light (derived — not yet visually verified on the canvas) |
|---|---|---|
| `surface` | `#0A0A0B` | `#F5F1EA` |
| `surfaceRaised` | `#141416` | `#FBF8F2` |
| `ink` | `#EDEDEA` | `#221F1B` |
| `inkMuted` | `#8B8883` | `#6B675F` |
| `border` | `#26272A` | `#E2DCCF` |
| `borderStrong` | `#6A6B71` | `#8F897B` |
| `accent` | `#34E2E2` (cyan) | `#0E7A7A` |
| `accentTool` | `#FFB454` (amber) | `#B4650A` |
| `accentContrast` | `#052227` | `#FFFFFF` |
| `danger` | `#E5484D` | `#C23B3B` |

**`border` vs `borderStrong`.** `border` is a hairline for the *edge of a panel* —
decoration, never load-bearing. `borderStrong` is the boundary of anything the user
must find and operate: inputs, slider tracks, unselected swatches, segmented
buttons, switch tracks. It is at least 3:1 against the panel in the worst case
(WCAG 1.4.11); `border` is about 1.2:1 and must not be used for that job.

**Dark is the only shipping theme.** The app is always dark. It does **not** follow
the OS `prefers-color-scheme`: the light column above is a provisional derivation
that nobody has seen on the canvas, so it is reachable only by an explicit
`data-theme="light"` (a future Settings switch), never by OS preference. Light
becomes eligible for OS-following once it has been verified as an artboard. The
document also declares `color-scheme: dark` and a `theme-color` meta so native form
controls, scrollbars and the browser/status bar match.

**Two accents, one rule:** cyan is the general interactive accent (selection,
slider fill, focus, links). Amber (`accentTool`, formerly `accentSecondary` — the
old name invited reuse) is reserved *only* for the active-tool glow — it never
appears anywhere else. That's what keeps a two-accent palette from reading as busy.
Colour is never the only signal for the active tool — see §5.

Panels use these as solid bases, but the actual chrome is composited with alpha
(see §5) — `surfaceRaised`/`ink`/`border` are the flat fallback values for contexts
that can't do the translucent composite (e.g. a plain list row).

## 3. Typography

| Role | Typeface | Notes |
|---|---|---|
| Headings / panel titles | **Space Grotesk** (600–700) | Geometric, slightly technical |
| Body / UI labels / buttons | **Manrope** (400–600) | Clean humanist sans, not Inter/Roboto/Arial |
| Numeric readouts (thickness, opacity, zoom %, coordinates) | **JetBrains Mono** (500) | Tabular figures for values that change |

Self-host all three for the offline/Android build (`next/font/local`) as **variable,
latin-subset woff2** files under `apps/web/src/fonts/` (OFL-licensed; licence texts
kept beside them). `font-display: swap`; preload only Manrope, since it is the one
every screen needs immediately. Headings actually use the heading family — earlier
code fell through to the body family.

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

Every control's boundary uses `borderStrong` (§2). Every interactive element shows
a visible **focus ring**: `outline: 2px solid accent; outline-offset: 2px`, drawn
only for keyboard focus (`:focus-visible`) so mouse use stays clean. Removing it is
never acceptable, and no sticky panel may sit on top of a focused control.

## 5. Material recipe (matte panel — rail, dock, top bar, zoom pill)

```css
background: rgba(19, 20, 22, .95);     /* was .86 — see below */
border: 1px solid rgba(255, 255, 255, .055);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035), 0 10px 30px rgba(0, 0, 0, .55);
border-radius: 12px;                   /* 10px on the top bar/pill, 12px on rail/dock */
/* no backdrop-filter */
```

**Why .95 and no blur.** Panels sit over an arbitrary photo. At .86 a white photo
lifts the panel to about `#343537`, dropping `inkMuted` labels to 3.5:1 — below the
4.5:1 minimum. At .95 the worst case is 4.6:1. At that opacity a blur is invisible,
and `backdrop-filter` over a canvas that repaints at 60fps costs a GPU pass per
frame, so it is dropped. Matte, not glass, all the way down.

Active/selected states get a soft glow (`box-shadow` with the accent at low alpha),
never a border-left accent stripe. The active-tool icon specifically glows amber:

```css
background: linear-gradient(160deg, rgba(255,180,84,.22), rgba(255,180,84,.06));
border-color: rgba(255,180,84,.45);
box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 14px rgba(255,180,84,.25);
```

**Non-colour cue.** The glow alone would be colour-only state, and it sits near cyan
"selected" states elsewhere. So the active tool's icon also switches from the
outline weight to the **filled** weight. Rail buttons expose `aria-pressed`.

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

**Neutral surround (option).** A warm surround can bias how an artist reads the
photo's colours, which is why grading tools use neutral grey. Drafting Board stays
the default; the canvas-background swatches (§4) include a **Neutral** option — flat
`#1B1B1C`, no glow, no texture — for colour-critical work. It is a per-device
preference.

**Full-bleed, inset-aware.** The surface always fills the viewport, but *Fit*,
initial centring and the crop frame are computed against the region **not covered by
chrome**: viewport minus the rail, an open dock, the top bar, the bottom bar/sheet
and the zoom pill, each plus a 16px gap. Panning may still move the photo under a
panel, but the pan limits keep every part of it reachable inside the visible region.
Without this a 1024px window hides about 30% of the photo behind chrome. In a split
view each pane uses only the chrome that actually overlaps it. Presentation mode has
no chrome, so it fits the whole viewport.

## 7. Layout

Breakpoint *structure* is unchanged from the retired spec — it was sound UX, only
restyled:

| Breakpoint | Width | Chrome |
|---|---|---|
| Compact | < 768px | Bottom matte toolbar (icon + label, horizontally scrollable with edge fades) + bottom matte sheet for the active tool's panel |
| Regular | 768–1023px | Same rail as Wide; the panel is a dismissible matte overlay drawer over the canvas instead of a persistent dock |
| Wide | ≥ 1024px | Persistent floating left icon rail + floating right dock, both matte panels inset 16px over the canvas |

All panels are `position: absolute/fixed` over the full-bleed canvas — none of them
takes layout space from it.

**Rail contents and grouping.** Eleven items, grouped by dividers, in this order:
*Session* (Projects, Import) · *Prepare* (Paper, Rotate/Flip, Adjust, Filters) ·
*Grid* · *Draw* · *Output* (Presets, Export, Present). Sync / view-only status sits
at the bottom of the rail. Suggested icons (Phosphor, one family, 1.5px-ish stroke
weight, 22px in a 44px target): `FolderOpen`, `UploadSimple`, `FrameCorners`,
`ArrowsClockwise`, `SlidersHorizontal`, `Sparkle`, `GridFour`, `PencilSimple`,
`Stack`, `DownloadSimple`, `CornersOut`.

**Top bar (Wide, once a reference is open).** A floating matte pill, top-centre,
holding the reference tabs, *Add reference*, *Split* / *Close split*. It is the only
top chrome; Compact has none, so the canvas gets the full height.

**Icons and labels.**
- **Wide / Regular:** icon-only. Every icon button has an `aria-label` *and* a
  tooltip. The tooltip appears **immediately on keyboard focus** and after a short
  (~300ms) delay on mouse hover, so it doesn't flicker as the pointer crosses the
  rail. A delay is not an animation; the tooltip itself appears instantly.
- **Compact:** icon **plus a short label** beneath it. There is no hover on touch,
  and Compact is where users are least likely to know the icons.

Every touch target stays ≥44px.

**Immersive / fullscreen mode** (the existing *Present* action): rail, dock and top
bar are hidden; the canvas fits the whole viewport; only a small matte
exit-fullscreen pill and a current-tool chip remain. Moving a mouse to a screen edge
reveals the chrome again (a 4px edge hint marks where). Touch and keyboard have no
hover, so the exit pill is itself tappable/focusable and toggles the chrome back —
edge *swipes* are deliberately not used, because they collide with OS back gestures.

## 8. What's still open

- Light theme hasn't been mocked up as an artboard — the table in §2 is a
  contrast-corrected derivation, not something you've seen. It is not applied
  automatically until it has been.
- Compact/Regular breakpoint mockups don't exist yet, same tokens apply structurally.
- `danger` color is defined but unused in any mockup so far (no destructive-action
  UI has been drawn).
- Android-specific chrome (system insets, back gesture, status-bar colour beyond the
  `theme-color` meta) is out of scope for this pass.

## 9. Repo changes made alongside this document

- `CLAUDE.md` — "Design language" section rewritten to point here and carry a
  condensed version of §1–4 and §7 for quick reference.
- `.agents/knowledge/ki-simplicity-first.md` — the "labeled icons by default" rule
  updated to "icon-only by default, tooltip on hover/focus" (Wide/Regular) with
  labels retained on Compact.
- `packages/ui/src/tokens/` — `color.ts`, `typography.ts`, `radius.ts`,
  `elevation.ts`, `motion.ts`, `tokens.css` rewritten to match this document; new
  `canvas.ts` added for the Drafting Board surface tokens. Revision 2 adds
  `borderStrong`, renames `accentSecondary` → `accentTool`, sets the panel to .95
  alpha with no blur, and adds the Neutral canvas surround. `breakpoints.ts` and
  `touch-target.ts` are unchanged.
- `docs/architecture/06-workspace-interaction.md` — chrome tiers, icon/label rule and
  the inset-aware viewport documented there too.
- `docs/architecture/05-canvas-renderer.md` — `Viewport` gains insets.

## 10. Revision 2 — what the design review changed

| # | Problem found | Change |
|---|---|---|
| 1 | Floating panels hid ~30% of the photo at 1024px | Full-bleed surface, inset-aware Fit/centre/crop frame/pan limits (§6) |
| 2 | `inkMuted` fell to 3.5:1 over a white photo at .86 alpha | Panel alpha .95 → 4.6:1; `backdrop-filter` dropped (§5) |
| 3 | Control boundaries were 1.2:1 | `borderStrong` ≥3:1 for anything operable (§2, §4) |
| 4 | Icon-only + hover tooltips fails on touch | Compact keeps a label under each icon; tooltips also on focus (§7) |
| 5 | OS light preference flipped to an unverified light theme | Dark-only; `color-scheme: dark` + `theme-color` (§2) |
| 6 | Active tool = amber glow only (colour-only) | Filled icon weight + `aria-pressed` (§5) |
| 7 | Warm surround can bias colour judgement | Neutral surround option, Drafting Board stays default (§6) |
| 8 | Hover-edge reveal impossible on touch; edge swipes fight OS gestures | Tappable exit pill toggles chrome; no edge swipes (§7) |
| 9 | Top bar undefined, rail flat at 11 items, no focus ring spec, no icon set | Defined in §4 and §7 |
