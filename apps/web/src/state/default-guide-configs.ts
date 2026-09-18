import type {
  GoldenRatioGridConfig,
  PerspectiveGridConfig,
  RadialGridConfig,
  RuleOfThirdsGridConfig,
} from '@artiso/shared-types';

// Sensible starting points for each non-rectangular guide type, used the
// first time GridPanel switches into that type (docs/phases/phase-7-guides-
// workspace-export.md). Style fields (color/opacity/thickness/visible) match
// DEFAULT_GRID_CONFIG's so switching types doesn't also silently change how
// the lines look.
const BASE_STYLE = { color: '#ffffff', opacity: 70, thickness: 'medium' as const, visible: true };

export const DEFAULT_PERSPECTIVE_CONFIG: PerspectiveGridConfig = {
  ...BASE_STYLE,
  type: 'perspective',
  vanishingPointCount: 2,
  horizonY: 0.5,
  lineCount: 12,
  thirdPointPosition: 'below',
};

export const DEFAULT_RADIAL_CONFIG: RadialGridConfig = {
  ...BASE_STYLE,
  type: 'radial',
  centerX: 0.5,
  centerY: 0.5,
  rings: 4,
  spokes: 12,
};

export const DEFAULT_RULE_OF_THIRDS_CONFIG: RuleOfThirdsGridConfig = {
  ...BASE_STYLE,
  type: 'ruleOfThirds',
};

export const DEFAULT_GOLDEN_RATIO_CONFIG: GoldenRatioGridConfig = {
  ...BASE_STYLE,
  type: 'goldenRatio',
  orientation: 'both',
};
