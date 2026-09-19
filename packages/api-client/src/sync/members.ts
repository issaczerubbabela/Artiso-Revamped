import { z } from 'zod';
import { ProjectMemberSchema, type ProjectMember, type ProjectRole } from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';

// Sharing (docs/phases/phase-8-collaboration-split-view.md). These call
// SECURITY DEFINER Postgres functions rather than touching auth.users or
// project_members directly: the client can't (and shouldn't be able to)
// look up other accounts by email, and the functions are where "only the
// owner may invite" is enforced.

export async function inviteProjectMember(
  projectId: string,
  email: string,
  role: Exclude<ProjectRole, 'owner'>,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('invite_project_member', {
    p_project_id: projectId,
    p_email: email.trim(),
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

const MemberRowsSchema = z.array(z.object({ user_id: z.string(), email: z.string(), role: z.string() }));

// The owner plus everyone the project is shared with.
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await getSupabaseClient().rpc('list_project_members', { p_project_id: projectId });
  if (error) throw new Error(error.message);
  return MemberRowsSchema.parse(data ?? []).map((row) =>
    ProjectMemberSchema.parse({ userId: row.user_id, email: row.email, role: row.role }),
  );
}

// The owner removes anyone; a member can remove themselves (leave).
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('remove_project_member', { p_project_id: projectId, p_user_id: userId });
  if (error) throw new Error(error.message);
}
