import type { Project } from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';
import type { ProjectRow } from './row-types';

export async function syncProject(project: Project): Promise<void> {
  const row: ProjectRow = {
    id: project.id,
    owner_id: project.ownerId,
    name: project.name,
    tags: project.tags,
    thumbnail_asset_id: project.thumbnailAssetId,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  };
  const { error } = await getSupabaseClient().from('projects').upsert(row);
  if (error) throw new Error(error.message);
}

// Cascades to "references" via the migration's on delete cascade foreign key.
export async function syncDeleteProject(projectId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('projects').delete().eq('id', projectId);
  if (error) throw new Error(error.message);
}

export async function pullProjects(ownerId: string): Promise<Project[]> {
  const { data, error } = await getSupabaseClient().from('projects').select('*').eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProjectRow[]).map(rowToProject);
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tags: row.tags,
    thumbnailAssetId: row.thumbnail_asset_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
