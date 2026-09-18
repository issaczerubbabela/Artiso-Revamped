import { beforeEach, describe, expect, it } from 'vitest';
import { applyRemotePreset, createPreset, deletePreset, getPreset, listPresets, updatePreset } from '../presets';
import { resetTestDatabase } from './test-helpers';
import type { ExportSettings, GridConfig } from '@artiso/shared-types';

beforeEach(resetTestDatabase);

const gridConfig: GridConfig = {
  type: 'rectangular',
  rows: 8,
  cols: 8,
  color: '#1e7fa6',
  opacity: 80,
  thickness: 'medium',
  numberingMode: 'off',
  visible: true,
  snapToImage: true,
};

const exportSettings: ExportSettings = {
  format: 'png',
  quality: 90,
  includeGrid: true,
  includeAdjustments: true,
};

describe('presets', () => {
  it('creates and retrieves a preset', async () => {
    const created = await createPreset({
      ownerId: 'owner-1',
      name: 'Graphite',
      gridConfig,
      filterStack: [{ type: 'filter', id: 'grayscale' }],
      exportSettings,
    });
    expect(await getPreset(created.id)).toEqual(created);
  });

  it('lists all created presets', async () => {
    await createPreset({ ownerId: 'owner-1', name: 'A', gridConfig, filterStack: [], exportSettings });
    await createPreset({ ownerId: 'owner-1', name: 'B', gridConfig, filterStack: [], exportSettings });
    const all = await listPresets();
    expect(all.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('updatePreset renames', async () => {
    const created = await createPreset({ ownerId: 'owner-1', name: 'Original', gridConfig, filterStack: [], exportSettings });
    const updated = await updatePreset(created.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(await getPreset(created.id)).toEqual(updated);
  });

  it('updatePreset throws for an unknown id', async () => {
    await expect(updatePreset('missing', { name: 'x' })).rejects.toThrow();
  });

  it('deletePreset removes it', async () => {
    const created = await createPreset({ ownerId: 'owner-1', name: 'To delete', gridConfig, filterStack: [], exportSettings });
    await deletePreset(created.id);
    expect(await getPreset(created.id)).toBeUndefined();
  });

  it('applyRemotePreset writes the row verbatim', async () => {
    const remote = {
      id: 'remote-1',
      ownerId: 'owner-1',
      name: 'From another device',
      gridConfig,
      filterStack: [],
      exportSettings,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await applyRemotePreset(remote);
    expect(await getPreset('remote-1')).toEqual(remote);
  });
});
