import { describe, expect, it } from 'vitest';
import type { GridConfig, GridSettings, Operation } from '@artiso/shared-types';
import { DEFAULT_GRID_SETTINGS } from '../defaults';
import { paperFor } from '../presets';
import { resolveFraming, type FramingInput } from '../resolve-framing';

const ORIGINAL = { width: 3000, height: 2000 };

const legacyGrid: GridConfig = {
  type: 'rectangular',
  rows: 8,
  cols: 8,
  color: '#ffffff',
  opacity: 70,
  thickness: 'medium',
  numberingMode: 'numbers',
  visible: true,
  snapToImage: true,
};

const unframed = (over: Partial<FramingInput> = {}): FramingInput => ({
  paper: null,
  crop: null,
  gridSettings: null,
  editStack: [],
  gridConfig: legacyGrid,
  secondaryGridConfig: null,
  ...over,
});

describe('resolveFraming', () => {
  describe('a reference that already has a paper and crop', () => {
    const paper = paperFor('A3', 'landscape');
    const crop = { x: 100, y: 50, w: 2828, h: 2000 };
    const settings: GridSettings = { ...DEFAULT_GRID_SETTINGS, cellMm: 40 };

    it('uses what is stored, without migrating', () => {
      const result = resolveFraming(unframed({ paper, crop, gridSettings: settings }), ORIGINAL);
      expect(result.migrated).toBe(false);
      expect(result.paper).toBe(paper);
      expect(result.crop).toBe(crop);
      expect(result.gridSettings).toBe(settings);
    });

    it('falls back to the default grid settings when none were stored', () => {
      const result = resolveFraming(unframed({ paper, crop }), ORIGINAL);
      expect(result.migrated).toBe(false);
      expect(result.gridSettings).toEqual(DEFAULT_GRID_SETTINGS);
    });

    it('sizes the oriented original from the rotate/flip operations only', () => {
      const editStack: Operation[] = [
        { type: 'crop', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } }, // a legacy crop op is ignored
        { type: 'rotate', degrees: 90 },
        { type: 'brightness', value: 10 },
      ];
      const result = resolveFraming(unframed({ paper, crop, editStack }), ORIGINAL);
      expect(result.oriented).toEqual({ width: 2000, height: 3000 });
    });

    it('keeps the stored Guides layer untouched', () => {
      const guide: GridConfig = { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true };
      expect(resolveFraming(unframed({ paper, crop, secondaryGridConfig: guide }), ORIGINAL).secondaryGridConfig).toBe(guide);
    });
  });

  describe('a reference saved before the overhaul', () => {
    it('is migrated onto A4 with a crop and grid settings', () => {
      const result = resolveFraming(unframed(), ORIGINAL);
      expect(result.migrated).toBe(true);
      expect(result.paper).toMatchObject({ preset: 'A4', orientation: 'landscape' });
      expect(result.crop.w / result.crop.h).toBeCloseTo(297 / 210, 12);
      expect(result.gridSettings.showSquares).toBe(true);
      expect(result.gridSettings.labels).toEqual({ enabled: true, columns: 'numbers', rows: 'numbers' });
    });

    it('migrates when only one of paper/crop is present (half-written state)', () => {
      expect(resolveFraming(unframed({ paper: paperFor('A4', 'portrait') }), ORIGINAL).migrated).toBe(true);
      expect(resolveFraming(unframed({ crop: { x: 0, y: 0, w: 10, h: 10 } }), ORIGINAL).migrated).toBe(true);
    });

    it('follows the legacy crop and rotation', () => {
      const editStack: Operation[] = [
        { type: 'crop', rect: { x: 0, y: 0, w: 0.5, h: 1 } }, // 1500 x 2000
        { type: 'rotate', degrees: 90 },
      ];
      const result = resolveFraming(unframed({ editStack }), ORIGINAL);
      expect(result.oriented).toEqual({ width: 2000, height: 3000 });
      expect(result.paper.orientation).toBe('landscape');
    });
  });
});
