import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

// The current user's access to a Project (docs/phases/phase-8-collaboration-
// split-view.md): 'owner' created it; 'editor' can change its references;
// 'viewer' is read-only. Enforced server-side by Postgres RLS -- the client
// uses it to hide/disable editing, not as the security boundary.
export const ProjectRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

export const ProjectSchema = z.object({
  id: IdSchema,
  ownerId: IdSchema,
  name: z.string().min(1),
  tags: z.array(z.string()),
  thumbnailAssetId: IdSchema.nullable(),
  // Local-only: derived from the signed-in user vs. project ownership and
  // membership at pull time, never written to Postgres. Defaulted so
  // projects saved before sharing existed are simply the user's own.
  role: ProjectRoleSchema.default('owner'),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectMemberSchema = z.object({
  userId: IdSchema,
  email: z.string(),
  role: ProjectRoleSchema,
});
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
