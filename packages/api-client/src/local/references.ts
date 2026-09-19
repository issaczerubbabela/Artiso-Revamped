import { ReferenceSchema, type GridConfig, type Reference } from '@artiso/shared-types';
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
    secondaryGridConfig: null,
    // Filled in by the workspace when the reference is first opened.
    paper: null,
    crop: null,
    gridSettings: null,
    annotations: [],
    removedAnnotationIds: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const db = await getDb();
  await db.put('references', reference);
  return reference;
}

// Rows written before a field existed come back from IndexedDB raw -- the
// Zod defaults (gridConfig.type, annotations, ...) only apply when parsing,
// and nothing parses on a local read. Without this, a reference saved before
// the guide types or annotation layer shipped would load with undefined
// fields. Falls back to the raw row if it doesn't validate, so an oddly
// shaped row degrades rather than making the reference unopenable.
export function normalizeReference(raw: Reference): Reference {
  const parsed = ReferenceSchema.safeParse(raw);
  return parsed.success ? parsed.data : raw;
}

export async function getReference(id: string): Promise<Reference | undefined> {
  const db = await getDb();
  const raw = await db.get('references', id);
  return raw && normalizeReference(raw);
}

export async function listReferencesByProject(projectId: string): Promise<Reference[]> {
  const db = await getDb();
  return (await db.getAllFromIndex('references', 'byProject', projectId)).map(normalizeReference);
}

// The only mutation path for a Reference -- always bumps updatedAt/version
// so a later Phase 2 sync has a monotonic version to conflict-check against
// (docs/architecture/08's last-write-wins rule), even though nothing
// consumes it yet in Phase 1.
export async function updateReference(
  id: string,
  patch: Partial<
    Pick<
      Reference,
      | 'editStack'
      | 'gridConfig'
      | 'secondaryGridConfig'
      | 'paper'
      | 'crop'
      | 'gridSettings'
      | 'annotations'
      | 'removedAnnotationIds'
      | 'notes'
    >
  >,
): Promise<Reference> {
  const db = await getDb();
  const rawExisting = await db.get('references', id);
  if (!rawExisting) throw new Error(`Reference ${id} not found`);
  const existing = normalizeReference(rawExisting);
  const updated: Reference = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  await db.put('references', updated);
  return updated;
}

// Overwrites the local row verbatim with an already-versioned Reference
// pulled from Supabase -- used only when reconciling after a sync push comes
// back 'stale' (docs/architecture/08's last-write-wins). Unlike
// updateReference, this never bumps version: the incoming row's version is
// already authoritative, so incrementing it here would make the next local
// edit's version collide with what the server expects.
export async function applyRemoteReference(reference: Reference): Promise<void> {
  const db = await getDb();
  await db.put('references', reference);
}

// Writes a merged Reference only if the local row is still at the version the
// merge started from. Sync merges asynchronously, and a plain overwrite would
// silently discard an edit the user made in the meantime; on a mismatch the
// caller re-reads and re-merges instead.
export async function applyMergedReference(expectedLocalVersion: number, merged: Reference): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction('references', 'readwrite');
  const current = await tx.store.get(merged.id);
  if (!current || current.version !== expectedLocalVersion) {
    await tx.done;
    return false;
  }
  await tx.store.put(merged);
  await tx.done;
  return true;
}
