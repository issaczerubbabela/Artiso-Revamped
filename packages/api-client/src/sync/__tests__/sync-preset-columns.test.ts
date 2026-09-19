import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preset } from '@artiso/shared-types';

// A preset's optional drawing-grid settings at the sync boundary.

let upserted: Record<string, unknown> | undefined;
let pulledRows: Record<string, unknown>[];

vi.mock('../../supabase-client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        upserted = row;
        return { error: null };
      },
      select: () => ({ eq: async () => ({ data: pulledRows, error: null }) }),
    }),
  }),
}));

const { syncPreset, pullPresets } = await import('../preset');

const ID = '11111111-1111-4111-8111-111111111111';
const GRID_CONFIG = { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true } as const;
const SETTINGS = {
  cellMm: 30,
  showSquares: true,
  showDiagonals: false,
  showRadial: true,
  radialStepDeg: 30,
  labels: { enabled: false, columns: 'numbers', rows: 'numbers' },
  style: { color: '#00ffaa', widthPx: 2, opacity: 0.5 },
  marginMm: 0,
} as const;
const EXPORT_SETTINGS = { format: 'png', quality: 90, includeGrid: true, includeAdjustments: true } as const;

const preset: Preset = {
  id: ID,
  ownerId: ID,
  name: 'Study',
  gridConfig: GRID_CONFIG,
  gridSettings: SETTINGS,
  filterStack: [],
  exportSettings: EXPORT_SETTINGS,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const baseRow = {
  id: ID,
  owner_id: ID,
  name: 'Study',
  grid_config: GRID_CONFIG,
  filter_stack: [],
  export_settings: EXPORT_SETTINGS,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('preset sync: grid settings', () => {
  beforeEach(() => {
    upserted = undefined;
    pulledRows = [];
  });

  it('pushes grid_settings', async () => {
    await syncPreset(preset);
    expect(upserted).toMatchObject({ grid_settings: SETTINGS });
  });

  it('pushes null when the preset has none', async () => {
    const withoutSettings: Preset = { ...preset };
    delete withoutSettings.gridSettings;
    await syncPreset(withoutSettings);
    expect(upserted).toMatchObject({ grid_settings: null });
  });

  it('reads grid_settings back when present', async () => {
    pulledRows = [{ ...baseRow, grid_settings: SETTINGS }];
    const [result] = await pullPresets(ID);
    expect(result?.gridSettings).toEqual(SETTINGS);
  });

  it('leaves gridSettings off a preset saved before the overhaul (null or missing column)', async () => {
    pulledRows = [{ ...baseRow, grid_settings: null }, { ...baseRow }];
    const results = await pullPresets(ID);
    expect(results).toHaveLength(2);
    for (const result of results) expect(result).not.toHaveProperty('gridSettings');
  });
});
