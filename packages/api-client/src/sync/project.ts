import type { Project, ProjectRole } from '@artiso/shared-types';
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

// Everything the signed-in user can see: their own projects plus ones shared
// with them (Postgres RLS decides which rows come back, so there's no owner
// filter here). Their role on each shared one comes from project_members.
export async function pullProjects(userId: string): Promise<Project[]> {
  const supabase = getSupabaseClient();
  const [projects, memberships] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('project_members').select('project_id, role').eq('user_id', userId),
  ]);
  if (projects.error) throw new Error(projects.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  const roleByProject = new Map(
    ((memberships.data ?? []) as { project_id: string; role: ProjectRole }[]).map((m) => [m.project_id, m.role]),
  );
  return ((projects.data ?? []) as ProjectRow[]).map((row) =>
    // Least privilege if a shared row somehow has no membership row.
    rowToProject(row, row.owner_id === userId ? 'owner' : (roleByProject.get(row.id) ?? 'viewer')),
  );
}

function rowToProject(row: ProjectRow, role: ProjectRole): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tags: row.tags,
    thumbnailAssetId: row.thumbnail_asset_id,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
