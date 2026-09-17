import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, getOrCreateDefaultProject, getProject, listProjects } from '../projects';
import { resetTestDatabase } from './test-helpers';

beforeEach(resetTestDatabase);

describe('projects', () => {
  it('creates and retrieves a project', async () => {
    const created = await createProject('Portrait Studies');
    const fetched = await getProject(created.id);
    expect(fetched).toEqual(created);
  });

  it('lists all created projects', async () => {
    await createProject('A');
    await createProject('B');
    const all = await listProjects();
    expect(all.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });

  it('getOrCreateDefaultProject creates one project the first time', async () => {
    const first = await getOrCreateDefaultProject();
    expect(first.name).toBe('My References');
    const all = await listProjects();
    expect(all).toHaveLength(1);
  });

  it('getOrCreateDefaultProject reuses the existing project on later calls', async () => {
    const first = await getOrCreateDefaultProject();
    const second = await getOrCreateDefaultProject();
    expect(second.id).toBe(first.id);
    expect(await listProjects()).toHaveLength(1);
  });
});
