import { z } from 'zod';
import { GridConfigSchema, OperationSchema, type Reference } from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';
import type { ReferenceRow } from './row-types';

const EditStackSchema = z.array(OperationSchema);

export type SyncReferenceResult = 'synced' | 'stale';

// Upserts, then checks the version Postgres actually stored: the
// references_version_guard trigger (supabase/migrations/0001_phase2_schema.sql)
// silently drops a write whose version is behind what's already stored,
// rather than overwriting it -- last-write-wins by version, enforced
// server-side so two concurrent writers can't race a client-side
// read-then-write check. 'stale' tells the caller to pull() and reconcile
// rather than assume the push succeeded.
export async function syncReference(reference: Reference): Promise<SyncReferenceResult> {
  const supabase = getSupabaseClient();
  const row: ReferenceRow = {
    id: reference.id,
    project_id: reference.projectId,
    original_asset_id: reference.originalAssetId,
    edit_stack: reference.editStack,
    grid_config: reference.gridConfig,
    notes: reference.notes,
    created_at: reference.createdAt,
    updated_at: reference.updatedAt,
    version: reference.version,
  };
  const { data, error } = await supabase.from('references').upsert(row).select('version').single();
  if (error) throw new Error(error.message);
  return (data as { version: number }).version === reference.version ? 'synced' : 'stale';
}

export async function pullReference(id: string): Promise<Reference | null> {
  const { data, error } = await getSupabaseClient().from('references').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReference(data as ReferenceRow) : null;
}

function rowToReference(row: ReferenceRow): Reference {
  return {
    id: row.id,
    projectId: row.project_id,
    originalAssetId: row.original_asset_id,
    editStack: EditStackSchema.parse(row.edit_stack),
    gridConfig: GridConfigSchema.parse(row.grid_config),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}
