import type { Project } from '@artiso/shared-types';
import { getDb } from './db';
import { LOCAL_OWNER_ID } from './constants';

export async function createProject(name: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    ownerId: LOCAL_OWNER_ID,
    name,
    tags: [],
    thumbnailAssetId: null,
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.put('projects', project);
  return project;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  return db.get('projects', id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.getAll('projects');
}

// Phase 1 has no Projects browsing UI yet (that's Phase 2's Home/Projects
// screen) but the Reference schema still needs a projectId, so Import
// reuses a single implicit project rather than the app going without one.
export async function getOrCreateDefaultProject(): Promise<Project> {
  const [first] = await listProjects();
  if (first) return first;
  return createProject('My References');
}
