import type { Crop, GridConfig, GridSettings, Operation, Paper } from '@artiso/shared-types';
import type { Dimensions } from '../geometry';
import { DEFAULT_GRID_SETTINGS } from './defaults';
import { migrateLegacyReference } from './migrate-legacy';
import { orientedDimensions } from './orientation';

export interface FramingInput {
  paper: Paper | null;
  crop: Crop | null;
  gridSettings: GridSettings | null;
  editStack: readonly Operation[];
  gridConfig: GridConfig;
  secondaryGridConfig: GridConfig | null;
}

export interface ResolvedFraming {
  paper: Paper;
  crop: Crop;
  gridSettings: GridSettings;
  /** The Guides layer (perspective / thirds / golden ratio), possibly promoted by the migration. */
  secondaryGridConfig: GridConfig | null;
  /** The original's size after rotate/flip: the space `crop` is measured in. */
  oriented: Dimensions;
  /** True when the reference was saved before the overhaul and has just been migrated. */
  migrated: boolean;
}

/**
 * What to draw for a reference: its stored paper/crop/grid settings when it has
 * them, otherwise the migration of its legacy crop and grid (so a reference
 * saved before the drawing-grid overhaul opens straight into a working grid).
 * `original` is the asset's pixel size.
 */
export function resolveFraming(input: FramingInput, original: Dimensions): ResolvedFraming {
  if (input.paper && input.crop) {
    return {
      paper: input.paper,
      crop: input.crop,
      gridSettings: input.gridSettings ?? DEFAULT_GRID_SETTINGS,
      secondaryGridConfig: input.secondaryGridConfig,
      oriented: orientedDimensions(original, input.editStack),
      migrated: false,
    };
  }
  return {
    ...migrateLegacyReference({
      original,
      editStack: input.editStack,
      gridConfig: input.gridConfig,
      secondaryGridConfig: input.secondaryGridConfig,
    }),
    migrated: true,
  };
}
