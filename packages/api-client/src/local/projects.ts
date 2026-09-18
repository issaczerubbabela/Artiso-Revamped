import type { Project } from '@artiso/shared-types';
import { getDb } from './db';
import { LOCAL_OWNER_ID } from './constants';

export async function createProject(name: string, ownerId: string = LOCAL_OWNER_ID): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    ownerId,
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

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'tags' | 'thumbnailAssetId'>>,
): Promise<Project> {
  const db = await getDb();
  const existing = await db.get('projects', id);
  if (!existing) throw new Error(`Project ${id} not found`);
  const updated: Project = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await db.put('projects', updated);
  return updated;
}

// Writes a Project pulled from Supabase into local IndexedDB verbatim --
// used to merge remote projects (created on another device) into local
// storage after sign-in, the same "apply already-authoritative remote
// state" pattern as references.ts's applyRemoteReference.
export async function applyRemoteProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put('projects', project);
}

// Deletes the project and its references. Assets are left alone (deleting
// them would need to check whether another reference/project still uses the
// same content hash); a handful of orphaned local blobs is a harmless
// tradeoff, not worth a reference-counting pass for Phase 2.
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const referenceKeys = await db.getAllKeysFromIndex('references', 'byProject', id);
  const tx = db.transaction(['projects', 'references'], 'readwrite');
  await Promise.all([
    tx.objectStore('projects').delete(id),
    ...referenceKeys.map((key) => tx.objectStore('references').delete(key)),
    tx.done,
  ]);
}
