import { describe, expect, it } from 'vitest';
import {
  CropSchema,
  DisplaySchema,
  GridSettingsSchema,
  PaperSchema,
  UnitSchema,
} from '../schemas/paper';
import { ReferenceSchema } from '../schemas/reference';
import { PresetSchema } from '../schemas/preset';
import { UserSchema } from '../schemas/user';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-01-01T00:00:00.000Z';

const gridSettings = {
  cellMm: 25,
  showSquares: true,
  showDiagonals: false,
  showRadial: false,
  radialStepDeg: 15,
  labels: { enabled: true, columns: 'letters' as const, rows: 'numbers' as const },
  style: { color: '#ffffff', widthPx: 1, opacity: 0.7 },
  marginMm: 0 as const,
};

const legacyGridConfig = {
  type: 'rectangular' as const,
  rows: 8,
  cols: 8,
  color: '#ffffff',
  opacity: 70,
  thickness: 'medium' as const,
  numberingMode: 'off' as const,
  visible: true,
  snapToImage: true,
};

const exportSettings = {
  format: 'png' as const,
  quality: 90,
  includeGrid: true,
  includeAdjustments: true,
};

describe('UnitSchema', () => {
  it.each(['mm', 'cm', 'in', 'px'])('accepts %s', (unit) => {
    expect(UnitSchema.safeParse(unit).success).toBe(true);
  });

  it('rejects an unknown unit', () => {
    expect(UnitSchema.safeParse('pt').success).toBe(false);
  });
});

describe('PaperSchema', () => {
  const a4 = { preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 };

  it('accepts a preset paper and a custom paper', () => {
    expect(PaperSchema.safeParse(a4).success).toBe(true);
    expect(
      PaperSchema.safeParse({ preset: 'custom', orientation: 'landscape', widthMm: 500, heightMm: 250 })
        .success,
    ).toBe(true);
  });

  it('rejects non-positive sizes and unknown presets', () => {
    expect(PaperSchema.safeParse({ ...a4, widthMm: 0 }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...a4, heightMm: -1 }).success).toBe(false);
    expect(PaperSchema.safeParse({ ...a4, preset: 'B5' }).success).toBe(false);
  });
});

describe('CropSchema', () => {
  it('accepts a pixel rectangle', () => {
    expect(CropSchema.safeParse({ x: 10, y: 20, w: 1000, h: 1414 }).success).toBe(true);
  });

  it('rejects negative origins and empty sizes', () => {
    expect(CropSchema.safeParse({ x: -1, y: 0, w: 10, h: 10 }).success).toBe(false);
    expect(CropSchema.safeParse({ x: 0, y: 0, w: 0, h: 10 }).success).toBe(false);
  });
});

describe('GridSettingsSchema', () => {
  it('accepts valid settings', () => {
    expect(GridSettingsSchema.safeParse(gridSettings).success).toBe(true);
  });

  it('rejects a non-positive cell size', () => {
    expect(GridSettingsSchema.safeParse({ ...gridSettings, cellMm: 0 }).success).toBe(false);
    expect(GridSettingsSchema.safeParse({ ...gridSettings, cellMm: -5 }).success).toBe(false);
  });

  it.each([0, 91, 15.5])('rejects radialStepDeg %s (integer, 1-90)', (radialStepDeg) => {
    expect(GridSettingsSchema.safeParse({ ...gridSettings, radialStepDeg }).success).toBe(false);
  });

  it.each([1, 15, 90])('accepts radialStepDeg %s', (radialStepDeg) => {
    expect(GridSettingsSchema.safeParse({ ...gridSettings, radialStepDeg }).success).toBe(true);
  });

  it('keeps opacity on a 0..1 scale (unlike the legacy 0..100 guides)', () => {
    const withOpacity = (opacity: number) => ({ ...gridSettings, style: { ...gridSettings.style, opacity } });
    expect(GridSettingsSchema.safeParse(withOpacity(1)).success).toBe(true);
    expect(GridSettingsSchema.safeParse(withOpacity(70)).success).toBe(false);
  });

  it('bounds the line width in screen pixels', () => {
    const withWidth = (widthPx: number) => ({ ...gridSettings, style: { ...gridSettings.style, widthPx } });
    expect(GridSettingsSchema.safeParse(withWidth(0.25)).success).toBe(false);
    expect(GridSettingsSchema.safeParse(withWidth(6.5)).success).toBe(false);
    expect(GridSettingsSchema.safeParse(withWidth(2.5)).success).toBe(true);
  });

  it('lets columns and rows pick their label scheme independently', () => {
    const labels = { enabled: true, columns: 'numbers' as const, rows: 'letters' as const };
    expect(GridSettingsSchema.safeParse({ ...gridSettings, labels }).success).toBe(true);
    expect(
      GridSettingsSchema.safeParse({ ...gridSettings, labels: { ...labels, rows: 'roman' } }).success,
    ).toBe(false);
  });

  it('pins the reserved margin to 0', () => {
    expect(GridSettingsSchema.safeParse({ ...gridSettings, marginMm: 5 }).success).toBe(false);
  });

  it('requires a 6-digit hex colour', () => {
    const withColor = (color: string) => ({ ...gridSettings, style: { ...gridSettings.style, color } });
    expect(GridSettingsSchema.safeParse(withColor('red')).success).toBe(false);
  });
});

describe('DisplaySchema', () => {
  it('defaults to 300 dpi with no calibration', () => {
    expect(DisplaySchema.parse({})).toEqual({ dpi: 300, screen: null });
  });

  it('accepts a screen calibration', () => {
    const screen = { diagonalIn: 15.6, nativeResW: 1920, nativeResH: 1080 };
    expect(DisplaySchema.parse({ dpi: 96, screen })).toEqual({ dpi: 96, screen });
  });

  it('rejects a zero-sized screen', () => {
    const screen = { diagonalIn: 0, nativeResW: 1920, nativeResH: 1080 };
    expect(DisplaySchema.safeParse({ screen }).success).toBe(false);
  });
});

describe('Reference / Preset / User additions', () => {
  const legacyReference = {
    id: ID,
    projectId: ID,
    originalAssetId: ID,
    editStack: [],
    gridConfig: legacyGridConfig,
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
    version: 0,
  };

  it('parses a reference saved before the overhaul, defaulting the new fields to null', () => {
    const parsed = ReferenceSchema.parse(legacyReference);
    expect(parsed.paper).toBeNull();
    expect(parsed.crop).toBeNull();
    expect(parsed.gridSettings).toBeNull();
  });

  it('round-trips paper, crop and gridSettings', () => {
    const paper = { preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 } as const;
    const crop = { x: 0, y: 0, w: 2100, h: 2970 };
    const parsed = ReferenceSchema.parse({ ...legacyReference, paper, crop, gridSettings });
    expect(parsed.paper).toEqual(paper);
    expect(parsed.crop).toEqual(crop);
    expect(parsed.gridSettings).toEqual(gridSettings);
  });

  it('rejects an invalid gridSettings on a reference', () => {
    const bad = { ...gridSettings, cellMm: 0 };
    expect(ReferenceSchema.safeParse({ ...legacyReference, gridSettings: bad }).success).toBe(false);
  });

  it('parses a preset and a user without the new optional fields', () => {
    expect(
      PresetSchema.safeParse({
        id: ID,
        ownerId: ID,
        name: 'p',
        gridConfig: legacyGridConfig,
        filterStack: [],
        exportSettings,
        createdAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      UserSchema.safeParse({
        id: ID,
        email: 'a@example.com',
        createdAt: NOW,
        defaultGridConfig: legacyGridConfig,
        defaultAdjustments: [],
        defaultExportSettings: exportSettings,
      }).success,
    ).toBe(true);
  });

  it('accepts gridSettings on a preset and defaultGridSettings on a user', () => {
    expect(
      PresetSchema.safeParse({
        id: ID,
        ownerId: ID,
        name: 'p',
        gridConfig: legacyGridConfig,
        gridSettings,
        filterStack: [],
        exportSettings,
        createdAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      UserSchema.safeParse({
        id: ID,
        email: 'a@example.com',
        createdAt: NOW,
        defaultGridConfig: legacyGridConfig,
        defaultGridSettings: gridSettings,
        defaultAdjustments: [],
        defaultExportSettings: exportSettings,
      }).success,
    ).toBe(true);
  });
});
