# Grid Drawing — Specification (v1)

**Audience:** developer (React + Canvas). **Purpose:** define how the reference-image grid works.
If the current implementation conflicts with this document, this document wins.

---

## 1. Principles

1. **Model real paper.** The image is fitted to a physical paper size first; the grid is measured in physical units.
2. **Physical units are the source of truth.** Store everything in **mm**. Pixels exist only as an input unit (converted via DPI) and for screen rendering.
3. **Non-destructive.** The original image is never modified. Store only the crop rectangle and settings.
4. **Never obscure the reference.** Thin lines, small translucent labels, no popups, no live readouts.

## 2. Workflow

1. Import image → 2. Choose paper size → 3. Crop to paper → 4. Configure grid → 5. Draw (pan / zoom / real-size).

The grid is shown only after steps 2–3. All settings remain editable afterward.

## 3. Data model

```ts
type Unit = 'mm' | 'cm' | 'in' | 'px';

interface Paper {
  preset: 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal' | 'custom';
  orientation: 'portrait' | 'landscape';
  widthMm: number;   // after orientation is applied
  heightMm: number;
}

// Rectangle in SOURCE-IMAGE pixels. Aspect ratio is always widthMm / heightMm.
interface Crop { x: number; y: number; w: number; h: number }

interface GridSettings {
  cellMm: number;                 // square side
  showSquares: boolean;
  showDiagonals: boolean;
  showRadial: boolean;
  radialStepDeg: number;          // default 15, range 1–90
  labels: {
    enabled: boolean;
    columns: 'numbers' | 'letters';   // chosen independently
    rows:    'numbers' | 'letters';
  };
  style: { color: string; widthPx: number; opacity: number }; // ONE style shared by all grid layers
  marginMm: 0;                    // reserved for later; always 0 in v1
}

interface Display {
  dpi: number;                    // default 300; used only for px<->mm and export
  screen: { diagonalIn: number; nativeResW: number; nativeResH: number } | null; // for real-size zoom
}
```

Preset sizes (portrait, mm): A3 297×420 · A4 210×297 · A5 148×210 · Letter 215.9×279.4 · Legal 215.9×355.6.

## 4. Paper

- Preset list + **Custom** width/height.
- **Portrait / Landscape toggle** swaps width and height. Keep the crop centered and re-clamp it.
- Unit selector: **mm, cm, in, px**. Convert to mm on input; convert back for display.
- Choosing **px** must show this explanation next to the DPI field:
  > *Pixels aren't a physical size. DPI (dots per inch) tells the app how many pixels equal one inch of paper. At 300 DPI, 300 px = 1 inch. A higher DPI gives a smaller physical size for the same pixels. If unsure, leave it at 300.*
- Conversion: `mm = px / dpi * 25.4`.

## 5. Crop

- The crop frame is **locked to the paper's aspect ratio**.
- The user **pans and zooms the image underneath** the fixed frame. The frame never resizes freely.
- The frame must always be fully covered by the image (clamp pan; minimum zoom = image just covers the frame).
- Store only `Crop` (source pixels). Re-cropping or changing paper never touches the original.
- The cropped area maps to the full paper: `crop → (0,0)…(widthMm, heightMm)`.

## 6. Square grid

Coordinate system: origin **top-left of the paper**, x → right, y → down. Let `W, H` = paper size, `s` = `cellMm`.

- `cols = ceil(W / s − 1e-9)`, `rows = ceil(H / s − 1e-9)` (epsilon avoids float errors on exact multiples).
- Vertical lines at `x = k·s` for `k = 0…cols`; horizontal at `y = k·s` for `k = 0…rows`. Clip everything to the paper rectangle.
- Cells are always **squares starting at the top-left**. If `W` or `H` is not a multiple of `s`, the **last column / row is partial**: it is cut by the paper edge, **never stretched or resized**.
- `s` accepts mm, cm, in (and px via DPI). Reject `s ≤ 0`.

## 7. Labels

**Placement**

- Labels appear on **all four edges**: column labels along the top and bottom, row labels along the left and right. **Partial edge cells are labeled too.**
- **No labels inside the grid** (nothing in the middle of cells).
- Each label is a **small translucent rectangle** (roughly `rgba(0,0,0,0.45)`) with the text **centered** in it, in white. The rectangle is just big enough for the text. **It is smaller than the cell, not the full width or height of the cell.**
- One label per column across the full width of the image (left → right), and one per row down the full height, so every column and row is labeled.
- Each label is centered on the **visible part** of its cell (the cell ∩ paper ∩ viewport).

**Sticky (pinned to the viewport)**

- Labels **stay visible while zooming and panning**. If a paper edge scrolls out of view, its labels **pin to the viewport edge** instead.
- Positions, in screen space:
  - Top labels: `y = max(paperTopScreen, viewportTop)`
  - Bottom labels: `y = min(paperBottomScreen, viewportBottom) − labelHeight`
  - Left labels: `x = max(paperLeftScreen, viewportLeft)`
  - Right labels: `x = min(paperRightScreen, viewportRight) − labelWidth`
- **Constant on-screen size.** Labels don't scale with zoom.
- **Density rule:** if a cell is smaller on screen than its label plus a small gap, show every 2nd / 5th / 10th label so labels never overlap.
- Labels are drawn last (on top) and ignore pointer events.
- **No live "square under cursor" readout.** The user explicitly does not want it.

**Label schemes** (columns and rows are chosen independently)

- `numbers`: 1, 2, 3, … (start at 1)
- `letters`: A, B, … Z, AA, AB, … (spreadsheet style)
- Mixing works: e.g. columns = letters, rows = numbers → "C4"; or numbers on both.

## 8. Overlays

Each has its own on/off toggle.

**Diagonals**
- One global toggle. Draws **both diagonals (an X) in every square**.
- In partial cells, draw the diagonals of the **full virtual square, clipped at the paper edge**, so all diagonals stay at exactly 45°.

**Radial**
- Lines start at the **exact center of the cropped paper** and run **straight to the paper edge**.
- **No concentric circles.**
- Spokes at `angle = k · radialStepDeg`, `k = 0 … floor(360/step) − 1`. Angle 0° points right. Default **15°**, adjustable **1°–90°**.
- Each ray is clipped where it meets the paper rectangle.

## 9. Styling

- **One shared style** (color, thickness, opacity) applies to the square, diagonal and radial layers.
- Line width is in **screen pixels** (constant at any zoom). Align 1px lines to half-pixels for crispness.
- Draw order: image → squares → diagonals → radial → labels.

## 10. Viewport and real-size zoom

**Basics**
- Pan (drag / two-finger) and zoom (wheel / pinch) **around the pointer or pinch center**.
- View state: `scale` (CSS px per mm) and `offset`. Min zoom = fit paper in viewport.
- Buttons: **Fit to screen** and **Real size (1:1)**.

**Real size (1:1)**: 1 mm on paper = 1 mm on the user's screen, so they can compare sizes against physical paper.

- Browsers can't know the physical screen size, so the user provides it once: **screen diagonal (inches)** and **native resolution**. Pre-fill resolution with `screen.width × devicePixelRatio` and `screen.height × devicePixelRatio`.
- Compute:
  ```
  physicalPPI = sqrt(resW² + resH²) / diagonalIn
  pxPerMm_css = (physicalPPI / devicePixelRatio) / 25.4
  ```
- **Real size** button: set `scale = pxPerMm_css`, keep the viewport center fixed. Show a "1:1" badge while active.
- If not yet calibrated, open the calibration dialog first. Persist the values in `localStorage`.
- *Optional check:* show a 100 mm line and let the user enter the length they measure with a ruler, then correct `physicalPPI`.

## 11. Rendering notes (React + Canvas)

- Use a canvas sized to the viewport × `devicePixelRatio`. Keep image and overlay in separate layers (or one canvas, in the order above).
- Redraw on `requestAnimationFrame` while panning or zooming. Only draw lines that intersect the viewport.
- Render the image with the crop applied via `drawImage(src, crop.x, crop.y, crop.w, crop.h, …)`.
- Keep grid math in mm and pure functions (`getCols`, `getLines`, `getRadialRays`, `labelFor(index, mode)`) so they are unit-testable and independent of React.

## 12. Acceptance checklist

- [ ] Image → paper → crop flow works; crop is aspect-locked and non-destructive.
- [ ] Portrait / landscape toggle and presets work; custom size in mm / cm / in / px.
- [ ] Choosing px shows the DPI explanation.
- [ ] Squares start at the top-left; right and bottom cells are partial (cut, not stretched) when the size isn't a multiple.
- [ ] Labels sit on all 4 edges only, including partial cells, none inside cells.
- [ ] Labels are small translucent rectangles with centered text, span the full image, and stay pinned to the viewport while panning and zooming.
- [ ] Columns and rows can independently use numbers or letters.
- [ ] Diagonals: one toggle, X in every square.
- [ ] Radial: from the exact paper center to the edges, adjustable angle, no circles.
- [ ] One shared color / thickness / opacity for all grid layers.
- [ ] Real size (1:1) is accurate after calibration; Fit to screen works.
- [ ] No live cursor readout anywhere.

## 13. Out of scope for v1

- **Margins:** the `marginMm` field is reserved and fixed at 0. Add later without changing the data model.
- **Export / print:** not a priority. Default if needed: PNG at `paper size × DPI` (default 300) with the enabled overlays.
- Per-layer styling, concentric circles, cell selection / progress tracking.

## 14. Assumptions made (change if wrong)

1. DPI defaults to 300.
2. Number labels start at 1; letters continue A…Z, AA, AB…
3. Diagonals in partial cells use the full square's 45° diagonals, clipped.
4. The density rule (thinning labels when zoomed out) is allowed.
5. "Alphanumeric" is interpreted as choosing numbers or letters **per axis**, not as combined labels like "A1" on a single edge.