import type { GridSettings } from '@artiso/shared-types';

export const DEFAULT_DPI = 300;

// A good result without configuring anything (ki-simplicity-first): squares and
// edge labels on, diagonals and radial off. Columns lettered and rows numbered
// so a cell reads as "C4".
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  cellMm: 25,
  showSquares: true,
  showDiagonals: false,
  showRadial: false,
  radialStepDeg: 15,
  labels: { enabled: true, columns: 'letters', rows: 'numbers' },
  style: { color: '#ffffff', widthPx: 1, opacity: 0.7 },
  marginMm: 0,
};
