import type {
  Crop,
  GridConfig,
  GridSettings,
  Operation,
  Paper,
} from '@artiso/shared-types';
import type { Dimensions, PixelRect } from '../geometry';
import { trimToAspect } from './crop';
import { DEFAULT_GRID_SETTINGS } from './defaults';
import { paperFor, paperAspect } from './presets';

// Migrates a Reference saved before the drawing-grid overhaul onto the paper /
// crop / GridSettings model (docs/phases/phase-9-drawing-grid-overhaul.md). Pure
// and headless: it needs only the original's pixel size, the stored EditStack
// and the legacy grid config.
//
// Known, accepted losses (documented in phase 9): a legacy crop is trimmed,
// centred, to the A4 ratio (the original pixels are untouched, so it can be
// re-expanded in the crop tool); a layered rectangular/radial guide is dropped
// because those types are no longer guides.

// Same table the legacy grid layer used to turn its thickness enum into pixels.
const LEGACY_THICKNESS_PX = {
  veryThin: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2.5,
  extraThick: 4,
} as const;

/** The guide types that survive as the Guides layer (everything except rectangular/radial). */
export function isGuideConfig(config: GridConfig): boolean {
  return config.type === 'perspective' || config.type === 'ruleOfThirds' || config.type === 'goldenRatio';
}

export interface FoldedCrop {
  /** The original's size after rotate/flip. */
  oriented: Dimensions;
  /** The region the legacy EditStack left visible, in pixels of the oriented original. */
  rect: PixelRect;
}

/**
 * Collapses a legacy EditStack's interleaved crop / rotate / flip operations
 * into "the oriented original + one visible rectangle in its pixels".
 *
 * Rotating or flipping the *cropped* image is the same as rotating or flipping
 * the whole oriented plane together with the visible rectangle, and cropping
 * takes a sub-rectangle of the current one -- so the stack is walked once,
 * tracking the plane's size and the rectangle.
 */
export function foldLegacyCrop(original: Dimensions, ops: readonly Operation[]): FoldedCrop {
  let W = original.width;
  let H = original.height;
  let rect: PixelRect = { x: 0, y: 0, w: W, h: H };

  for (const op of ops) {
    switch (op.type) {
      case 'crop':
        rect = {
          x: rect.x + op.rect.x * rect.w,
          y: rect.y + op.rect.y * rect.h,
          w: op.rect.w * rect.w,
          h: op.rect.h * rect.h,
        };
        break;
      case 'rotate':
        // Canvas rotation is clockwise: (x, y) -> (H - y, x) for 90 degrees.
        if (op.degrees === 90) {
          rect = { x: H - (rect.y + rect.h), y: rect.x, w: rect.h, h: rect.w };
          [W, H] = [H, W];
        } else if (op.degrees === 180) {
          rect = { x: W - (rect.x + rect.w), y: H - (rect.y + rect.h), w: rect.w, h: rect.h };
        } else if (op.degrees === 270) {
          rect = { x: rect.y, y: W - (rect.x + rect.w), w: rect.h, h: rect.w };
          [W, H] = [H, W];
        }
        break;
      case 'flip':
        rect =
          op.axis === 'horizontal'
            ? { ...rect, x: W - (rect.x + rect.w) }
            : { ...rect, y: H - (rect.y + rect.h) };
        break;
      default:
        break;
    }
  }
  return { oriented: { width: W, height: H }, rect };
}

export interface LegacyMigrationInput {
  /** The original asset's pixel size. */
  original: Dimensions;
  editStack: readonly Operation[];
  gridConfig: GridConfig;
  secondaryGridConfig: GridConfig | null;
}

export interface LegacyMigrationResult {
  paper: Paper;
  crop: Crop;
  gridSettings: GridSettings;
  /** The Guides layer after migration: only guide types, possibly promoted from the old primary grid. */
  secondaryGridConfig: GridConfig | null;
  /** The oriented original's size, which `crop` is measured in. */
  oriented: Dimensions;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function styleFrom(legacy: GridConfig): GridSettings['style'] {
  return {
    color: legacy.color,
    widthPx: LEGACY_THICKNESS_PX[legacy.thickness],
    opacity: clamp(legacy.opacity / 100, 0, 1),
  };
}

function settingsFromLegacy(primary: GridConfig, paper: Paper): GridSettings {
  const base: GridSettings = {
    ...DEFAULT_GRID_SETTINGS,
    style: styleFrom(primary),
  };
  const noLabels = { ...base.labels, enabled: false };

  // A hidden legacy grid stays hidden.
  if (!primary.visible) {
    return { ...base, showSquares: false, labels: noLabels };
  }

  switch (primary.type) {
    case 'rectangular': {
      // The old cells were width/cols wide (and height/rows tall, so not square);
      // the new cells are squares, so the width sets the size.
      const cellMm = Math.max(1, Math.round(paper.widthMm / primary.cols));
      const labels = labelsFromNumbering(primary.numberingMode, base.labels);
      return { ...base, cellMm, labels };
    }
    case 'radial':
      return {
        ...base,
        showSquares: false,
        showRadial: true,
        radialStepDeg: clamp(Math.round(360 / primary.spokes), 1, 90),
        labels: noLabels,
      };
    default:
      // A legacy guide as the primary grid moves to the Guides layer; the new
      // grid starts empty rather than adding lines the artist never had.
      return { ...base, showSquares: false, labels: noLabels };
  }
}

function labelsFromNumbering(
  mode: Extract<GridConfig, { type: 'rectangular' }>['numberingMode'],
  fallback: GridSettings['labels'],
): GridSettings['labels'] {
  switch (mode) {
    case 'numbers':
    case 'roman':
      return { enabled: true, columns: 'numbers', rows: 'numbers' };
    case 'letters':
    case 'alphanumeric':
      return { enabled: true, columns: 'letters', rows: 'numbers' };
    case 'off':
    case 'custom':
      return { ...fallback, enabled: false };
  }
}

export function migrateLegacyReference(input: LegacyMigrationInput): LegacyMigrationResult {
  const { oriented, rect } = foldLegacyCrop(input.original, input.editStack);

  const orientation = rect.w > rect.h ? 'landscape' : 'portrait';
  const paper = paperFor('A4', orientation);
  const crop = trimToAspect(rect, paperAspect(paper));

  const gridSettings = settingsFromLegacy(input.gridConfig, paper);

  let secondaryGridConfig =
    input.secondaryGridConfig && isGuideConfig(input.secondaryGridConfig) ? input.secondaryGridConfig : null;
  if (secondaryGridConfig === null && isGuideConfig(input.gridConfig)) {
    secondaryGridConfig = input.gridConfig;
  }

  return { paper, crop, gridSettings, secondaryGridConfig, oriented };
}
