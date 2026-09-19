import { beforeEach, describe, expect, it } from 'vitest';
import { applyMergedReference, createReference, getReference, listReferencesByProject, updateReference } from '../references';
import { resetTestDatabase } from './test-helpers';
import type { GridConfig, Reference } from '@artiso/shared-types';

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

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const ID_LEGACY = '33333333-3333-4333-8333-333333333333';

describe('references', () => {
  it('creates a reference with an empty edit stack and version 1', async () => {
    const reference = await createReference({ projectId: PROJECT_ID, originalAssetId: ASSET_ID, gridConfig });
    expect(reference.editStack).toEqual([]);
    expect(reference.version).toBe(1);
    expect(await getReference(reference.id)).toEqual(reference);
  });

  it('lists references scoped to a project', async () => {
    const a = await createReference({ projectId: PROJECT_ID, originalAssetId: ASSET_ID, gridConfig });
    await createReference({ projectId: 'other-project', originalAssetId: ASSET_ID, gridConfig });
    const forProject = await listReferencesByProject(PROJECT_ID);
    expect(forProject.map((r) => r.id)).toEqual([a.id]);
  });

  it('updateReference bumps version and updatedAt', async () => {
    const created = await createReference({ projectId: PROJECT_ID, originalAssetId: ASSET_ID, gridConfig });
    const updated = await updateReference(created.id, {
      editStack: [{ type: 'rotate', degrees: 90 }],
    });
    expect(updated.version).toBe(2);
    expect(updated.editStack).toEqual([{ type: 'rotate', degrees: 90 }]);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('updateReference throws for an unknown id', async () => {
    await expect(updateReference('missing', { notes: 'x' })).rejects.toThrow();
  });
});

describe('reading rows saved before newer fields existed', () => {
  it('fills defaults for a legacy reference (no gridConfig.type, annotations, or tombstones)', async () => {
    const { getDb } = await import('../db');
    const db = await getDb();
    const legacyGrid: Record<string, unknown> = { ...gridConfig };
    delete legacyGrid.type;
    await db.put('references', {
      id: ID_LEGACY,
      projectId: PROJECT_ID,
      originalAssetId: ASSET_ID,
      editStack: [],
      gridConfig: legacyGrid,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      version: 1,
    } as unknown as Reference);

    const read = await getReference(ID_LEGACY);
    expect(read?.gridConfig.type).toBe('rectangular');
    expect(read?.annotations).toEqual([]);
    expect(read?.removedAnnotationIds).toEqual([]);
    expect(read?.secondaryGridConfig).toBeNull();
  });
});

describe('applyMergedReference', () => {
  it('writes only if the local row is still at the expected version', async () => {
    const created = await createReference({ projectId: PROJECT_ID, originalAssetId: ASSET_ID, gridConfig });
    const merged: Reference = { ...created, notes: 'merged', version: created.version + 1 };

    // A local edit lands after the merge started: the stale write is refused.
    await updateReference(created.id, { notes: 'edited meanwhile' });
    expect(await applyMergedReference(created.version, merged)).toBe(false);
    expect((await getReference(created.id))?.notes).toBe('edited meanwhile');

    const latest = (await getReference(created.id)) as Reference;
    expect(await applyMergedReference(latest.version, { ...latest, notes: 'merged', version: latest.version + 1 })).toBe(true);
    expect((await getReference(created.id))?.notes).toBe('merged');
  });
});
