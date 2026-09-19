import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRemoteProject,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../projects';
import { LOCAL_OWNER_ID } from '../constants';
import { getDb } from '../db';
import { createReference } from '../references';
import { resetTestDatabase } from './test-helpers';

beforeEach(resetTestDatabase);

describe('projects', () => {
  it('creates and retrieves a project, defaulting to the local owner', async () => {
    const created = await createProject('Portrait Studies');
    expect(created.ownerId).toBe(LOCAL_OWNER_ID);
    const fetched = await getProject(created.id);
    expect(fetched).toEqual(created);
  });

  it('accepts an explicit owner id (a signed-in user)', async () => {
    const created = await createProject('Portrait Studies', 'user-123');
    expect(created.ownerId).toBe('user-123');
  });

  it('lists all created projects', async () => {
    await createProject('A');
    await createProject('B');
    const all = await listProjects();
    expect(all.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('updateProject renames and bumps updatedAt', async () => {
    const created = await createProject('Original name');
    const updated = await updateProject(created.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
    expect(await getProject(created.id)).toEqual(updated);
  });

  it('updateProject throws for an unknown id', async () => {
    await expect(updateProject('missing', { name: 'x' })).rejects.toThrow();
  });

  it('applyRemoteProject writes the row verbatim without touching updatedAt', async () => {
    const remote = {
      id: 'remote-1',
      ownerId: 'user-123',
      name: 'From another device',
      tags: [],
      thumbnailAssetId: null,
      role: 'editor' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await applyRemoteProject(remote);
    expect(await getProject('remote-1')).toEqual(remote);
  });

  it('treats a project saved before sharing existed (no role) as owned by the user', async () => {
    const db = await getDb();
    await db.put('projects', {
      id: 'legacy-1',
      ownerId: 'user-123',
      name: 'Old project',
      tags: [],
      thumbnailAssetId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as never);
    expect((await getProject('legacy-1'))?.role).toBe('owner');
    expect((await listProjects()).find((p) => p.id === 'legacy-1')?.role).toBe('owner');
  });

  it('deleteProject removes the project and its references', async () => {
    const project = await createProject('To delete');
    const reference = await createReference({
      projectId: project.id,
      originalAssetId: 'asset-1',
      gridConfig: {
        type: 'rectangular',
        rows: 4,
        cols: 4,
        color: '#ffffff',
        opacity: 100,
        thickness: 'medium',
        numberingMode: 'off',
        visible: true,
        snapToImage: true,
      },
    });

    await deleteProject(project.id);

    expect(await getProject(project.id)).toBeUndefined();
    const db = await getDb();
    expect(await db.get('references', reference.id)).toBeUndefined();
  });
});
