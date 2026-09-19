import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reference } from '@artiso/shared-types';

// The drawing-grid columns (paper, crop, grid_settings) at the sync boundary:
// what is written on push and how a pulled row is read back, including rows
// saved before the overhaul (null) and a database that hasn't had the columns
// added yet (undefined).

let upserted: Record<string, unknown> | undefined;
let pulled: Record<string, unknown> | null;

vi.mock('../../supabase-client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        upserted = row;
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { version: 2, updated_at: '2026-01-02T10:00:00.123+00:00' }, error: null }),
          maybeSingle: async () => ({ data: pulled, error: null }),
        }),
      }),
    }),
  }),
}));

const { syncReference, pullReference } = await import('../reference');

const ID = '11111111-1111-4111-8111-111111111111';
const PAPER = { preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 } as const;
const CROP = { x: 10, y: 20, w: 2100, h: 2970 };
const SETTINGS = {
  cellMm: 25,
  showSquares: true,
  showDiagonals: true,
  showRadial: false,
  radialStepDeg: 15,
  labels: { enabled: true, columns: 'letters', rows: 'numbers' },
  style: { color: '#ffffff', widthPx: 1, opacity: 0.7 },
  marginMm: 0,
} as const;

const reference: Reference = {
  id: ID,
  projectId: ID,
  originalAssetId: ID,
  editStack: [],
  gridConfig: { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true },
  secondaryGridConfig: null,
  paper: PAPER,
  crop: CROP,
  gridSettings: SETTINGS,
  annotations: [],
  removedAnnotationIds: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.123Z',
  version: 2,
};

const baseRow = {
  id: ID,
  project_id: ID,
  original_asset_id: ID,
  edit_stack: [],
  grid_config: { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true },
  secondary_grid_config: null,
  annotations: [],
  removed_annotation_ids: [],
  notes: '',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T10:00:00.123Z',
  version: 2,
};

describe('reference sync: paper, crop and grid settings', () => {
  beforeEach(() => {
    upserted = undefined;
    pulled = null;
  });

  it('pushes the three columns', async () => {
    await syncReference(reference);
    expect(upserted).toMatchObject({ paper: PAPER, crop: CROP, grid_settings: SETTINGS });
  });

  it('pushes null for an unmigrated reference', async () => {
    await syncReference({ ...reference, paper: null, crop: null, gridSettings: null });
    expect(upserted).toMatchObject({ paper: null, crop: null, grid_settings: null });
  });

  it('reads the columns back through the schemas', async () => {
    pulled = { ...baseRow, paper: PAPER, crop: CROP, grid_settings: SETTINGS };
    const result = await pullReference(ID);
    expect(result?.paper).toEqual(PAPER);
    expect(result?.crop).toEqual(CROP);
    expect(result?.gridSettings).toEqual(SETTINGS);
  });

  it('reads a row saved before the overhaul (null columns) as unmigrated', async () => {
    pulled = { ...baseRow, paper: null, crop: null, grid_settings: null };
    const result = await pullReference(ID);
    expect(result?.paper).toBeNull();
    expect(result?.crop).toBeNull();
    expect(result?.gridSettings).toBeNull();
  });

  it('reads a row from a database without the columns as unmigrated', async () => {
    pulled = { ...baseRow };
    const result = await pullReference(ID);
    expect(result?.paper).toBeNull();
    expect(result?.crop).toBeNull();
    expect(result?.gridSettings).toBeNull();
  });

  it('rejects a corrupt column instead of silently accepting it', async () => {
    pulled = { ...baseRow, paper: { preset: 'A4', orientation: 'portrait', widthMm: -1, heightMm: 297 } };
    await expect(pullReference(ID)).rejects.toThrow();
  });
});
