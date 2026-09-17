import { beforeEach, describe, expect, it } from 'vitest';
import { createReference, getReference, listReferencesByProject, updateReference } from '../references';
import { resetTestDatabase } from './test-helpers';
import type { GridConfig } from '@artiso/shared-types';

beforeEach(resetTestDatabase);

const gridConfig: GridConfig = {
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
