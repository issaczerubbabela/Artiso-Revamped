import type { GridConfig } from '@artiso/shared-types';
import { generateGoldenRatioGrid } from './generate-golden-ratio-grid';
import { generatePerspectiveGrid } from './generate-perspective-grid';
import { generateRadialGrid } from './generate-radial-grid';
import { generateRectangularGrid } from './generate-rectangular-grid';
import { generateRuleOfThirdsGrid } from './generate-rule-of-thirds-grid';
import type { GridGeometry } from './types';

// Pure function of (width, height, config) only -- never pixel content,
// never the viewport transform, never color/opacity/thickness (those are
// draw-time style read by the renderer, not geometry inputs). This is what
// makes ki-grid-image-independence and the cached-geometry 60fps pan/zoom
// possible: nothing here needs to run again on a filter change, an
// adjustment change, or a pan/zoom frame.
//
// Dispatches on config.type; every branch returns the same
// GridGeometry {lines, labels} shape, which is what lets the renderer stay
// completely untouched regardless of which guide type is active
// (.agents/workflows/add-new-grid-type-recipe.md).
export function generateGridGeometry(width: number, height: number, config: GridConfig): GridGeometry {
  switch (config.type) {
    case 'rectangular':
      return generateRectangularGrid(width, height, config);
    case 'perspective':
      return generatePerspectiveGrid(width, height, config);
    case 'radial':
      return generateRadialGrid(width, height, config);
    case 'ruleOfThirds':
      return generateRuleOfThirdsGrid(width, height);
    case 'goldenRatio':
      return generateGoldenRatioGrid(width, height, config);
  }
}
