import type { GridConfig, Reference } from '@artiso/shared-types';
import { getDb } from './db';

export interface CreateReferenceInput {
  projectId: string;
  originalAssetId: string;
  gridConfig: GridConfig;
}

export async function createReference(input: CreateReferenceInput): Promise<Reference> {
  const now = new Date().toISOString();
  const reference: Reference = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    originalAssetId: input.originalAssetId,
    editStack: [],
    gridConfig: input.gridConfig,
    notes: '',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const db = await getDb();
  await db.put('references', reference);
  return reference;
}

export async function getReference(id: string): Promise<Reference | undefined> {
  const db = await getDb();
  return db.get('references', id);
}

export async function listReferencesByProject(projectId: string): Promise<Reference[]> {
  const db = await getDb();
  return db.getAllFromIndex('references', 'byProject', projectId);
}

// The only mutation path for a Reference -- always bumps updatedAt/version
// so a later Phase 2 sync has a monotonic version to conflict-check against
// (docs/architecture/08's last-write-wins rule), even though nothing
// consumes it yet in Phase 1.
export async function updateReference(
  id: string,
  patch: Partial<Pick<Reference, 'editStack' | 'gridConfig' | 'notes'>>,
): Promise<Reference> {
  const db = await getDb();
  const existing = await db.get('references', id);
  if (!existing) throw new Error(`Reference ${id} not found`);
  const updated: Reference = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  await db.put('references', updated);
  return updated;
}
