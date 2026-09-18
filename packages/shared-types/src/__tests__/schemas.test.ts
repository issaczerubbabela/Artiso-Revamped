import { describe, expect, it } from 'vitest';
import { OperationSchema } from '../schemas/operation';
import { GridConfigSchema } from '../schemas/grid-config';
import { ExportSettingsSchema } from '../schemas/export-settings';
import { AssetSchema } from '../schemas/asset';
import { UserSchema } from '../schemas/user';
import { ProjectSchema } from '../schemas/project';
import { ReferenceSchema } from '../schemas/reference';
import { PresetSchema } from '../schemas/preset';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-01-01T00:00:00.000Z';

const gridConfig = {
  rows: 8,
  cols: 8,
  color: '#ff00aa',
  opacity: 80,
  thickness: 'medium' as const,
  numberingMode: 'numbers' as const,
  visible: true,
  snapToImage: true,
};

const exportSettings = {
  format: 'png' as const,
  quality: 90,
  includeGrid: true,
  includeAdjustments: true,
};

describe('OperationSchema', () => {
  const validOps = [
    { type: 'crop', rect: { x: 0, y: 0, w: 1, h: 1 } },
    { type: 'rotate', degrees: 90 },
    { type: 'flip', axis: 'horizontal' },
    { type: 'brightness', value: 10 },
    { type: 'contrast', value: -10 },
    { type: 'saturation', value: 0 },
    { type: 'filter', id: 'grayscale' },
  ];

  it.each(validOps)('accepts a valid %j operation', (op) => {
    expect(OperationSchema.safeParse(op).success).toBe(true);
  });

  it('rejects an unknown operation type', () => {
    expect(OperationSchema.safeParse({ type: 'sepia', value: 1 }).success).toBe(false);
  });
});

describe('GridConfigSchema', () => {
  it('accepts a valid rectangular config with an explicit type', () => {
    expect(GridConfigSchema.safeParse({ ...gridConfig, type: 'rectangular' }).success).toBe(true);
  });

  it('rejects opacity out of range', () => {
    expect(GridConfigSchema.safeParse({ ...gridConfig, opacity: 150 }).success).toBe(false);
  });

  it('defaults a missing type to rectangular for backward compatibility with pre-Phase-7 data', () => {
    const result = GridConfigSchema.safeParse(gridConfig);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('rectangular');
  });

  it('accepts a perspective config', () => {
    expect(
      GridConfigSchema.safeParse({
        type: 'perspective',
        color: '#ffffff',
        opacity: 70,
        thickness: 'thin',
        visible: true,
        vanishingPointCount: 2,
        horizonY: 0.5,
        lineCount: 12,
        thirdPointPosition: 'below',
      }).success,
    ).toBe(true);
  });

  it('accepts a radial config', () => {
    expect(
      GridConfigSchema.safeParse({
        type: 'radial',
        color: '#ffffff',
        opacity: 70,
        thickness: 'thin',
        visible: true,
        centerX: 0.5,
        centerY: 0.5,
        rings: 4,
        spokes: 12,
      }).success,
    ).toBe(true);
  });

  it('accepts a ruleOfThirds config', () => {
    expect(
      GridConfigSchema.safeParse({
        type: 'ruleOfThirds',
        color: '#ffffff',
        opacity: 70,
        thickness: 'thin',
        visible: true,
      }).success,
    ).toBe(true);
  });

  it('accepts a goldenRatio config', () => {
    expect(
      GridConfigSchema.safeParse({
        type: 'goldenRatio',
        color: '#ffffff',
        opacity: 70,
        thickness: 'thin',
        visible: true,
        orientation: 'both',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(GridConfigSchema.safeParse({ ...gridConfig, type: 'hexagonal' }).success).toBe(false);
  });
});

describe('ExportSettingsSchema', () => {
  it('accepts valid settings', () => {
    expect(ExportSettingsSchema.safeParse(exportSettings).success).toBe(true);
  });

  it('rejects an invalid format', () => {
    expect(ExportSettingsSchema.safeParse({ ...exportSettings, format: 'gif' }).success).toBe(false);
  });
});

describe('AssetSchema', () => {
  it('accepts a valid asset', () => {
    expect(
      AssetSchema.safeParse({
        id: ID,
        ownerId: ID,
        storageKey: `originals/${ID}/abc.jpg`,
        contentHash: 'abc123',
        width: 1024,
        height: 768,
        sizeBytes: 123456,
        createdAt: NOW,
      }).success,
    ).toBe(true);
  });
});

describe('UserSchema', () => {
  it('accepts a valid user', () => {
    expect(
      UserSchema.safeParse({
        id: ID,
        email: 'artist@example.com',
        createdAt: NOW,
        defaultGridConfig: gridConfig,
        defaultAdjustments: [{ type: 'brightness', value: 5 }],
        defaultExportSettings: exportSettings,
      }).success,
    ).toBe(true);
  });

  it('rejects an adjustment restricted to non-tonal operations', () => {
    expect(
      UserSchema.safeParse({
        id: ID,
        email: 'artist@example.com',
        createdAt: NOW,
        defaultGridConfig: gridConfig,
        defaultAdjustments: [{ type: 'rotate', degrees: 90 }],
        defaultExportSettings: exportSettings,
      }).success,
    ).toBe(false);
  });
});

describe('ProjectSchema', () => {
  it('accepts a valid project', () => {
    expect(
      ProjectSchema.safeParse({
        id: ID,
        ownerId: ID,
        name: 'Portrait Study',
        tags: ['portrait'],
        thumbnailAssetId: null,
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(true);
  });
});

describe('ReferenceSchema', () => {
  it('accepts a valid reference', () => {
    expect(
      ReferenceSchema.safeParse({
        id: ID,
        projectId: ID,
        originalAssetId: ID,
        editStack: [{ type: 'rotate', degrees: 90 }],
        gridConfig,
        notes: '',
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
      }).success,
    ).toBe(true);
  });
});

describe('PresetSchema', () => {
  it('accepts a valid preset', () => {
    expect(
      PresetSchema.safeParse({
        id: ID,
        ownerId: ID,
        name: 'Graphite Default',
        gridConfig,
        filterStack: [{ type: 'filter', id: 'grayscale' }],
        exportSettings,
        createdAt: NOW,
      }).success,
    ).toBe(true);
  });
});
