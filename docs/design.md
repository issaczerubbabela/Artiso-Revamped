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

**Exception — motion that follows a gesture.** The canvas may keep moving for a
moment *after* the artist's own gesture, as the continuation of that gesture, never
as a transition of its own:

- a flicked pan **glides** on with decaying speed and settles;
- a pinch released past a zoom limit **springs back** to the limit.

Both stop the instant a finger touches the canvas, and both are off under
`prefers-reduced-motion` (iPadOS Reduce Motion): the canvas then stops exactly where
the gesture left it, and a pinch simply stops at the limit. Rotation never has
momentum; a release within 5° of a right angle snaps to it instantly. Chrome is not
covered by this exception: panels, popovers, sheets, hover and focus states all stay
instant swaps.

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

**Apple platforms (Phase 11).** On iPad, iPhone and Mac the app uses the system's
own type instead, so it feels at home there: **San Francisco** (`system-ui`) for
headings and body and **SF Mono** (`ui-monospace`) for numeric readouts. Space
Grotesk is not used on Apple platforms — San Francisco carries the headings too.
Sizes, weights and line-heights are unchanged. An inline script in `<head>` marks
`<html data-platform="apple">` before first paint (iPadOS reports itself as a Mac,
so the check covers it), and `tokens.css` swaps the three `--font-family-*`
variables under that attribute. Everywhere else the self-hosted Manrope and
JetBrains Mono (and Space Grotesk headings) stay.

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
the default; a **Neutral canvas** toggle at the foot of the rail switches to a flat
`#1B1B1C` — no glow, no texture — for colour-critical work. There are only two
surfaces, so it is a toggle (cyan, not the tool amber) rather than a swatch row. It
is a per-device preference, kept in `localStorage`, and applies to the projects
screen too.

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
| Regular | 768–1023px | Same rail as Wide; small panels as popovers, large panels as a bottom sheet beside the rail |
| Wide | ≥ 1024px | Persistent floating left icon rail + small panels as popovers + large panels in the floating right column, all matte panels inset 16px over the canvas |

All panels are `position: absolute/fixed` over the full-bleed canvas — none of them
takes layout space from it.

**Which container a panel uses (Phase 11, iPad patterns).** Small panels —
*Adjust, Rotate/Flip, Presets, Draw* — open as a **popover** at Wide and Regular.
Large panels — *Grid, Filters, Export* (and Paper, Drawing Check) — open in the
**side column** (the right dock, styled like an iPad settings column) at Wide, and
as a **bottom sheet** at Regular (the 11" iPad in portrait, ~820px) and Compact, so
a column never covers 40% of a portrait screen. At Compact every panel is a sheet.

**Popover.** A matte panel (§5) 320px wide beside its rail button, with a 14px
arrow (a square turned 45°, in the panel's own material and hairline border)
pointing at the button's centre. It opens to the right of the rail, or to the left
if there is no room, centred on the button and slid to stay 16px inside the
screen; the arrow keeps pointing at the button whatever the slide, and never sits
within 20px of a rounded corner. Content taller than the screen scrolls inside it.
It is transient: it reserves no inset, so the canvas does not re-fit when it opens.
It closes (and its tool with it) on a tap anywhere outside it, on Esc, or on its
44px close button; the rail button toggles it. For a tool that works on the canvas
itself (Draw), taps on the canvas are strokes rather than taps outside, so its
popover — with Undo — stays open while drawing; any other tap closes it. Semantics: a non-modal
`dialog` named after the panel; focus moves into it on open, Tab walks its
controls, Esc returns focus to the rail button (which has `aria-haspopup`).

**Bottom sheet heights.** A sheet has a **grab bar** (40×5px pill in
`borderStrong`, centred in a 44px-tall strip) and three resting heights:
**peek** (168px — grab bar, title and about one row of controls; at most 35% of
the space), **half** (half of the space it may grow into) and **full** (up to the
top safe-area inset). It opens at half and keeps its height while the tool is
switched. Dragging the grab bar or title follows the finger directly; on release it
rests at the nearest height, or one height further in the direction of a flick
(> 0.5 px/ms). Dragged below half the peek height, or flicked down from around
peek, it **closes** (swipe down to close). Resting is an instant swap, not an
animation. The canvas re-fits around a sheet only up to half the screen: a sheet
pulled to full covers the photo on purpose. Keyboard: the grab bar is a vertical
`slider` ("Sheet height", value Peek/Half/Full; Arrow keys step, Home/End jump)
and Esc anywhere in the sheet closes it.

**Canvas menu.** A matte context menu (`menu` role, 220px min, 44px items) opened
by a **long-press** on the canvas (~500ms of a still touch or Pencil; movement over
10px, an early lift or a second finger cancel it), by **right-click**, or by the
**context-menu key / Shift+F10** while the canvas has focus (the canvas is a
focusable group with a visible focus ring). Items: *Fit to screen*, *Reset
rotation*, *Show grid / Hide grid* (a view toggle, never an edit or an export
change); *Touch Lock* and *Focus this cell* join in Phase 12, then *Paste* last
(opens a copied image as a new reference tab, Phase 13). It opens 10px below
and right of the press so the finger is never on an item (flipping up/left near an
edge), at the visible centre when opened from the keyboard. Focus lands on the
first item; Arrow keys, Home and End move; Enter runs an item; Esc, Tab, a tap
elsewhere, a resize or leaving the window close it. Not offered in the Paper tool
or Presentation mode, and a long-press does nothing while Draw is on (that press
is a stroke). *Focus this cell* (Phase 12) focuses the cell the menu was opened
on; it is left out off the paper, and greyed out with its reason underneath
("Turn on Squares in the Grid panel to use Cell Focus.") while squares are hidden.
A greyed item stays focusable (`aria-disabled`, reason as its description) so the
keyboard and screen readers still find it.

**Touch Lock** (Phase 12, GLOSSARY.md). A ghost button at the start of the zoom
pill — padlock icon plus a short label (*Lock* / *Locked*, so it reads on touch
without a tooltip), and a *Touch Lock* item in the canvas menu. Locking is one tap.
While locked the canvas ignores every press — pan, pinch, twist, double-tap, taps,
long-press, strokes and Measure, from fingers, Pencil and mouse alike — and the
pill's *Fit*, *Real size* and angle reset are disabled, so the view stays exactly
as it is. The chrome keeps working: Cell Focus's ‹ › and ✓ (stepping may still
pan just enough to reveal a cell), the panels, and Pencil hover. Unlocking takes a
**1-second press** on the button (finger, Pencil, mouse, or Enter/Space held);
while held the button shows pressed-in (cyan fill, an instant state), and the
click that ends a successful hold never re-locks. The menu item is greyed out
while locked, with "Press and hold the lock for 1 second to unlock." as its
reason. Separate from Presentation mode: nothing re-fits and the chrome stays.
Not remembered across reloads.

**Pencil-only Drawing** (Phase 12). Off for anyone who never uses a Pencil. The
first Pencil stroke in Draw switches it on; from then on fingers pan, pinch and
turn the view in Draw and never mark it, and a palm resting beside a Pencil stroke
neither draws nor interrupts it. Once a Pencil has been seen, the Draw panel
offers a *Pencil-only Drawing* switch (device-local, remembered) with the note
"Only the Pencil draws; fingers move the view." Without it, a second finger on a
finger stroke cancels the stroke (it is a gesture). **Pressure** varies a freehand
stroke's width only, from ¼ to 1¾ of the set thickness (a medium press, and a
mouse, draw at the set thickness); strokes without pressure draw as before.

**Pencil hover** (Phase 12). A Pencil hovering with nothing pressed shows, in every
mode and under Touch Lock: a thin white crosshair with a dark halo at the tip
(14px arms, a 3px gap at the centre), a 1.5px cyan outline on the cell under the
tip, and that cell's label in a small matte chip (monospace, 24px tall) 18px up
and right of the tip, flipping to stay on screen. Only the crosshair shows off the
paper or without squares. It disappears the moment the Pencil touches down, lifts
away or leaves the canvas.

**Measure** (Phase 12, a Draw-panel tool beside Arrow … Freehand). Dragging draws
a 2px cyan line with a dark halo and short square ticks at both ends, its readout
in a matte chip beside the far end; the panel repeats the readout under
*Measurement* in monospace — the length in the paper unit setting (mm, cm, in, or
px at the document DPI) and in cells, "42 mm · 1.7 cells". Holding still at the
end for ~500ms snaps the line onto the paper's horizontal or vertical (whichever
it is nearer), and it stays snapped for the rest of that drag. The next measure
replaces it; switching tool, closing Draw or changing reference clears it; it is
never saved or exported.

**Touch shortcuts** (Phase 12). Double-tap: fit and square up (or back to the
previous view). Two-finger tap (both fingers down and up within 250ms, under 10px
of movement): undo the last mark, in Draw only. Three-finger tap: show or hide the
grid. None of them work under Touch Lock or in Presentation mode; a two- or
three-finger tap is never half of a double-tap.

**Cell Focus** (Phase 12, GLOSSARY.md). Everything outside the focused cell is
darkened with flat black (default 70%, *Dim outside the cell* slider 10–95% in the
Grid panel); the focused cell gets a 2px cyan outline (the general accent — not
amber, which stays the active tool's). Each Done Cell carries a faint upright
check mark (white at ~55% with a soft dark edge, sized to ~40% of the cell on
screen, 8–48px). The controls are a matte pill at the bottom-left of the focused
pane, on the zoom pill's row (above it on Compact): *Previous cell* ‹, a
monospace readout with the cell's label over the Done count ("C4" / "14 / 48"),
*Next cell* ›, *Done Cell* ✓ (a cyan toggle, filled when the cell is done) and
*Exit Cell Focus* ×. Icon-only with tooltips on Wide/Regular, short labels under
the icons on Compact; it reports itself as an overlay, so a cell it reveals never
hides under it. Only the focused pane has the pill, so in a split view it acts on
the pane touched last. Stepping to an off-screen cell pans just far enough to
show it (16px clear of the chrome) in one step — no glide, no zoom change; a cell
already on screen never moves the view. While Cell Focus is on, a tap focuses the
cell under it and a tap on the focused cell leaves (after the double-tap window,
so a double-tap there is only Fit); a long-press on the focused cell marks or
unmarks it as done. A change of cell size or paper clears the Done Cells and shows
a matte notice above the pill — "*n* Done Cells cleared" with an **Undo** that puts
the grid back and the Done Cells with it — for six seconds; style changes keep
them. All of it is device-local view state, remembered per reference.

**Paste and drop (Phase 13).** ⌘V / Ctrl+V anywhere outside a text field, the
canvas menu's *Paste*, or a drop opens each image as a new reference tab. While
anything is dragged over the window a **drop target** covers it: a 2px dashed
cyan outline inset by the chrome margin over a dimmed canvas, with a matte label
("Drop images to open them as new tabs") in the middle. It appears and goes
instantly. Anything that can't be opened -- not an image, an undecodable file,
HEIC in a browser that can't decode it ("convert it to JPEG") -- is reported on the
**import-error surface**: the Projects screen's alert line, the empty workspace,
or, with a reference open, a small matte **import notice** (role `alert`, label
size, a 44px *Dismiss* button) under the top bar on Wide/Regular and floating at
the top on Compact. The next successful import clears it.

**Icons.** Phosphor stays (SF Symbols cannot be licensed for the web): regular
weight when idle, filled weight when active (§5), the way SF Symbols behave.

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
bar are hidden; the canvas fits the whole viewport; only a tiny icon-only matte
exit pill (44px, so it covers as little of the photo as possible) and a current-tool
chip remain. Moving a mouse to a screen edge reveals the rail (left) or dock (right,
if a tool is open); a 4px hint marks each edge, and the revealed panel hides ~250ms
after the pointer leaves it, so it also goes away if the mouse never entered it.
Touch and keyboard have no hover, so the exit pill is itself tappable/focusable and
returns the full chrome — edge *swipes* are deliberately not used, because they
collide with OS back gestures. Revealing the chrome never changes the fit, so a
classroom display is not nudged out of framing.

## 8. What's still open

- Light theme hasn't been mocked up as an artboard — the table in §2 is a
  contrast-corrected derivation, not something you've seen. It is not applied
  automatically until it has been.
- Compact/Regular breakpoint mockups don't exist yet, same tokens apply structurally.
  The Phase 11 iPad patterns (popover, sheet heights, canvas menu) are specified in
  §7 and verified on a real iPad rather than as artboards.
- `danger` color is defined but unused in any mockup so far (no destructive-action
  UI has been drawn).
- Android-specific chrome (system insets, back gesture, status-bar colour beyond the
  `theme-color` meta) is out of scope for this pass.
- **View Rotation in the zoom pill** (Phase 11): while the view is turned, the pill
  shows the angle in whole degrees (monospace readout, as a ghost button) after the
  zoom %; tapping it resets to 0°. The **Lock rotation** switch sits under the
  Rotate (edit) buttons in the Rotate/Flip panel, since both are about which way up
  the reference is; it is a device-local preference, not an edit.

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
| 7 | Warm surround can bias colour judgement | Neutral canvas toggle, Drafting Board stays default (§6) |
| 8 | Hover-edge reveal impossible on touch; edge swipes fight OS gestures | Tappable exit pill toggles chrome; no edge swipes (§7) |
| 9 | Top bar undefined, rail flat at 11 items, no focus ring spec, no icon set | Defined in §4 and §7 |
