import type { GridConfig } from '@artiso/shared-types';

// Phase 1 has no synced per-user defaults yet (that's the User.defaultGridConfig
// sync in Phase 2) -- a fixed constant until then.
export const DEFAULT_GRID_CONFIG: GridConfig = {
  type: 'rectangular',
  rows: 8,
  cols: 8,
  color: '#ffffff',
  opacity: 70,
  thickness: 'medium',
  numberingMode: 'off',
  visible: true,
  snapToImage: true,
};
