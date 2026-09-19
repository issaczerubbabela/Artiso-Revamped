import { describe, expect, it } from 'vitest';
import { OperationSchema } from '../schemas/operation';
import { GridConfigSchema } from '../schemas/grid-config';
import { ExportSettingsSchema } from '../schemas/export-settings';
import { AssetSchema } from '../schemas/asset';
import { UserSchema } from '../schemas/user';
import { ProjectSchema } from '../schemas/project';
import { ReferenceSchema } from '../schemas/reference';
import { PresetSchema } from '../schemas/preset';
import { AnnotationSchema } from '../schemas/annotation';

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

  it('defaults secondaryGridConfig to null for references saved before layered grids existed', () => {
    const result = ReferenceSchema.safeParse({
      id: ID,
      projectId: ID,
      originalAssetId: ID,
      editStack: [],
      gridConfig,
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.secondaryGridConfig).toBeNull();
  });

  it('accepts an explicit secondaryGridConfig of a different guide type', () => {
    const result = ReferenceSchema.safeParse({
      id: ID,
      projectId: ID,
      originalAssetId: ID,
      editStack: [],
      gridConfig,
      secondaryGridConfig: { type: 'ruleOfThirds', color: '#000000', opacity: 50, thickness: 'thin', visible: true },
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.secondaryGridConfig?.type).toBe('ruleOfThirds');
  });

  it('defaults annotations to an empty array for references saved before the annotation layer existed', () => {
    const result = ReferenceSchema.safeParse({
      id: ID,
      projectId: ID,
      originalAssetId: ID,
      editStack: [],
      gridConfig,
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.annotations).toEqual([]);
  });

  it('accepts a mix of annotation types', () => {
    const result = ReferenceSchema.safeParse({
      id: ID,
      projectId: ID,
      originalAssetId: ID,
      editStack: [],
      gridConfig,
      annotations: [
        { type: 'arrow', id: ID, start: { x: 0.1, y: 0.1 }, end: { x: 0.5, y: 0.5 }, color: '#ff0000', thickness: 'medium' },
        { type: 'freehand', id: ID, points: [{ x: 0, y: 0 }, { x: 1, y: 1, pressure: 0.8 }], color: '#00ff00', thickness: 'thin' },
      ],
      notes: '',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.annotations).toHaveLength(2);
  });
});

describe('AnnotationSchema', () => {
  it('accepts each annotation type', () => {
    expect(
      AnnotationSchema.safeParse({ type: 'arrow', id: ID, start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, color: '#ffffff', thickness: 'thin' })
        .success,
    ).toBe(true);
    expect(
      AnnotationSchema.safeParse({
        type: 'circle',
        id: ID,
        center: { x: 0.5, y: 0.5 },
        radiusX: 0.1,
        radiusY: 0.2,
        color: '#ffffff',
        thickness: 'thick',
      }).success,
    ).toBe(true);
    expect(
      AnnotationSchema.safeParse({ type: 'note', id: ID, position: { x: 0.2, y: 0.2 }, text: 'Check proportions here', color: '#ffffff', thickness: 'medium' })
        .success,
    ).toBe(true);
    expect(
      AnnotationSchema.safeParse({
        type: 'freehand',
        id: ID,
        points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1, pressure: 0.4 }],
        color: '#ffffff',
        thickness: 'medium',
      }).success,
    ).toBe(true);
  });

  it('rejects a point outside the normalized [0,1] range', () => {
    expect(
      AnnotationSchema.safeParse({ type: 'arrow', id: ID, start: { x: -0.1, y: 0 }, end: { x: 1, y: 1 }, color: '#ffffff', thickness: 'thin' })
        .success,
    ).toBe(false);
  });

  it('rejects a freehand annotation with fewer than 2 points', () => {
    expect(
      AnnotationSchema.safeParse({ type: 'freehand', id: ID, points: [{ x: 0, y: 0 }], color: '#ffffff', thickness: 'thin' }).success,
    ).toBe(false);
  });

  it('rejects an unknown annotation type', () => {
    expect(AnnotationSchema.safeParse({ type: 'rectangle', id: ID, color: '#ffffff', thickness: 'thin' }).success).toBe(false);
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
