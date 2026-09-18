import type { GridConfig } from '@artiso/shared-types';
import { DEFAULT_GRID_CONFIG } from './default-grid-config';
import {
  DEFAULT_GOLDEN_RATIO_CONFIG,
  DEFAULT_PERSPECTIVE_CONFIG,
  DEFAULT_RADIAL_CONFIG,
  DEFAULT_RULE_OF_THIRDS_CONFIG,
} from './default-guide-configs';

type GridStyle = Pick<GridConfig, 'color' | 'opacity' | 'thickness' | 'visible'>;

// Switching guide type replaces the whole config (rows/cols mean nothing to
// a radial grid), but carries the shared style fields over so the switch
// doesn't also silently reset color/opacity/thickness/visible.
export function buildGridConfigForType(type: GridConfig['type'], style: GridStyle): GridConfig {
  switch (type) {
    case 'rectangular':
      return { ...DEFAULT_GRID_CONFIG, ...style };
    case 'perspective':
      return { ...DEFAULT_PERSPECTIVE_CONFIG, ...style };
    case 'radial':
      return { ...DEFAULT_RADIAL_CONFIG, ...style };
    case 'ruleOfThirds':
      return { ...DEFAULT_RULE_OF_THIRDS_CONFIG, ...style };
    case 'goldenRatio':
      return { ...DEFAULT_GOLDEN_RATIO_CONFIG, ...style };
  }
}
