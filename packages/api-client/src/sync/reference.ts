import { z } from 'zod';
import {
  AnnotationSchema,
  CropSchema,
  GridConfigSchema,
  GridSettingsSchema,
  OperationSchema,
  PaperSchema,
  type Reference,
} from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';
import type { ReferenceRow } from './row-types';

const EditStackSchema = z.array(OperationSchema);
const AnnotationsSchema = z.array(AnnotationSchema);
const RemovedIdsSchema = z.array(z.string().uuid());

export type SyncReferenceResult = 'synced' | 'stale';

// Upserts, then reads back the version Postgres actually stored. The
// references_version_guard trigger (supabase/migrations/0001_phase2_schema.sql)
// silently drops a write whose version isn't strictly above what's already
// stored, so a stale writer can never overwrite a newer copy. A dropped
// upsert returns no row, so the version is read in a separate query rather
// than chained onto the upsert. 'stale' tells the caller to pull and merge
// (see merge-reference.ts) instead of assuming the push succeeded.
export async function syncReference(reference: Reference): Promise<SyncReferenceResult> {
  const supabase = getSupabaseClient();
  const row: ReferenceRow = {
    id: reference.id,
    project_id: reference.projectId,
    original_asset_id: reference.originalAssetId,
    edit_stack: reference.editStack,
    grid_config: reference.gridConfig,
    secondary_grid_config: reference.secondaryGridConfig,
    paper: reference.paper,
    crop: reference.crop,
    grid_settings: reference.gridSettings,
    annotations: reference.annotations,
    removed_annotation_ids: reference.removedAnnotationIds,
    notes: reference.notes,
    created_at: reference.createdAt,
    updated_at: reference.updatedAt,
    version: reference.version,
  };
  const { error } = await supabase.from('references').upsert(row);
  if (error) throw new Error(error.message);
  const { data, error: readError } = await supabase
    .from('references')
    .select('version, updated_at')
    .eq('id', reference.id)
    .single();
  if (readError) throw new Error(readError.message);
  const stored = data as { version: number; updated_at: string };
  // Version alone can't tell whether *our* write is what's stored: two
  // people editing from the same base both reach the same next version, the
  // server keeps the first, and the second would otherwise read back an equal
  // version and wrongly conclude it had landed. updated_at is set per write
  // by the client, so matching both means the stored row is ours.
  const isOurs = stored.version === reference.version && Date.parse(stored.updated_at) === Date.parse(reference.updatedAt);
  return isOurs ? 'synced' : 'stale';
}

export async function pullReference(id: string): Promise<Reference | null> {
  const { data, error } = await getSupabaseClient().from('references').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToReference(data as ReferenceRow) : null;
}

// Opening a Project pulled from another device (via mergeRemoteProjects on
// sign-in) has no local References yet -- this is how open-project.ts
// discovers them before falling back to "this project has nothing to open".
export async function pullReferencesForProject(projectId: string): Promise<Reference[]> {
  const { data, error } = await getSupabaseClient().from('references').select('*').eq('project_id', projectId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReferenceRow[]).map(rowToReference);
}

function rowToReference(row: ReferenceRow): Reference {
  return {
    id: row.id,
    projectId: row.project_id,
    originalAssetId: row.original_asset_id,
    editStack: EditStackSchema.parse(row.edit_stack),
    gridConfig: GridConfigSchema.parse(row.grid_config),
    secondaryGridConfig: row.secondary_grid_config ? GridConfigSchema.parse(row.secondary_grid_config) : null,
    // Null means "saved before the drawing-grid overhaul": the workspace
    // migrates it on first open. A database that hasn't had the columns added
    // yet returns them undefined, which reads the same way.
    paper: row.paper ? PaperSchema.parse(row.paper) : null,
    crop: row.crop ? CropSchema.parse(row.crop) : null,
    gridSettings: row.grid_settings ? GridSettingsSchema.parse(row.grid_settings) : null,
    annotations: AnnotationsSchema.parse(row.annotations ?? []),
    removedAnnotationIds: RemovedIdsSchema.parse(row.removed_annotation_ids ?? []),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}
