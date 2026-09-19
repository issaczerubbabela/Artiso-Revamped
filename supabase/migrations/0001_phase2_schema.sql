-- Phase 2 schema: docs/architecture/11-data-model-schema.md's Postgres
-- tables, matching packages/shared-types' Zod schemas 1:1. Run this once in
-- the Supabase SQL editor (Project -> SQL Editor -> New query -> paste ->
-- Run). Safe to re-run: every statement is idempotent (`if not exists` /
-- `on conflict do nothing` / `create or replace`).
--
-- Note: "references" is a reserved word in Postgres, so it's quoted
-- everywhere below -- this doesn't affect the Supabase JS client, which
-- takes the bare string "references" and lets PostgREST handle quoting.

-- profiles: extends auth.users with the app-specific defaults from
-- shared-types' User schema. One row per auth.users row, created by the
-- trigger at the bottom of this file.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  default_grid_config jsonb not null,
  default_adjustments jsonb not null default '[]'::jsonb,
  default_export_settings jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tags text[] not null default '{}',
  thumbnail_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- storageKey convention: originals/{ownerId}/{contentHash}.{ext} (docs/architecture/08).
-- id is content-derived (core-engine's deterministicUuid over
-- ownerId+contentHash, computed at import time) rather than randomly
-- generated, so uniqueness on (owner_id, content_hash) is enforced by the
-- primary key itself -- no separate unique constraint needed (an earlier
-- version of this migration had one; dropped below for anyone re-running
-- against a database that still has it, since it actively conflicts with a
-- deterministic-id insert if any row from before that change exists).
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_key text not null,
  content_hash text not null,
  width integer not null,
  height integer not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

alter table public.assets drop constraint if exists assets_owner_id_content_hash_key;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'projects_thumbnail_asset_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_thumbnail_asset_id_fkey
      foreign key (thumbnail_asset_id) references public.assets (id) on delete set null;
  end if;
end $$;

create table if not exists public."references" (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  original_asset_id uuid not null references public.assets (id),
  edit_stack jsonb not null default '[]'::jsonb,
  grid_config jsonb not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

-- Layered grids (docs/phases/phase-7-guides-workspace-export.md): an
-- optional second guide overlaid on the primary one. Nullable and additive,
-- so this is safe to run against a database that already has rows from
-- before this column existed -- they just get secondary_grid_config = null,
-- matching shared-types' ReferenceSchema default.
alter table public."references" add column if not exists secondary_grid_config jsonb;

-- Annotation layer (docs/phases/phase-7-guides-workspace-export.md):
-- arrows/circles/notes/freehand strokes drawn on top of the image/grid.
-- Defaults to an empty array, matching shared-types' ReferenceSchema
-- default, so existing rows parse as "no annotations yet" rather than null.
alter table public."references" add column if not exists annotations jsonb not null default '[]'::jsonb;

-- Collaboration (docs/phases/phase-8-collaboration-split-view.md): ids of
-- annotations someone deleted, so a merge of two people's annotation lists
-- doesn't resurrect them. Matches shared-types' ReferenceSchema default.
alter table public."references" add column if not exists removed_annotation_ids jsonb not null default '[]'::jsonb;

create index if not exists references_project_id_idx on public."references" (project_id);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  grid_config jsonb not null,
  filter_stack jsonb not null default '[]'::jsonb,
  export_settings jsonb not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: profiles, assets and presets are scoped to
-- owner_id = auth.uid(). projects and "references" start owner-scoped here
-- and are then replaced by the sharing-aware policies in the Sharing section
-- at the bottom (owner, plus editor/viewer members).
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public."references" enable row level security;
alter table public.presets enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists assets_owner on public.assets;
create policy assets_owner on public.assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists presets_owner on public.presets;
create policy presets_owner on public.presets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Optimistic concurrency (docs/architecture/08, revisited for sharing in
-- docs/phases/phase-8-collaboration-split-view.md), enforced server-side
-- rather than via a client-side read-then-write race: a write whose version
-- isn't strictly above what's stored is silently dropped, leaving the row
-- unchanged -- so with two people editing, the loser can never silently
-- overwrite the winner. The loser's client sees the mismatch, pulls, merges
-- (packages/api-client/src/sync/merge-reference.ts) and pushes a higher
-- version. (This was `<` before sharing; an equal version now also counts as
-- stale, since two writers can independently reach the same next version.)
-- The client detects the drop by reading back the stored version (see
-- packages/api-client/src/sync/reference.ts).
create or replace function public.enforce_reference_version()
returns trigger as $$
begin
  if new.version <= old.version then
    return null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists references_version_guard on public."references";
create trigger references_version_guard
  before update on public."references"
  for each row execute function public.enforce_reference_version();

-- Auto-create a profiles row (with sensible defaults) whenever a new
-- Supabase Auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, default_grid_config, default_export_settings)
  values (
    new.id,
    new.email,
    '{"rows":8,"cols":8,"color":"#ffffff","opacity":70,"thickness":"medium","numberingMode":"off","visible":true,"snapToImage":true}'::jsonb,
    '{"format":"png","quality":92,"includeGrid":true,"includeAdjustments":true}'::jsonb
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: private buckets, one object per {ownerId}/{contentHash}.{ext}.
-- storage.foldername(name) splits the object path on '/', so
-- (storage.foldername(name))[1] is the leading ownerId segment.
insert into storage.buckets (id, name, public)
values ('originals', 'originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', false)
on conflict (id) do nothing;

drop policy if exists originals_owner_read on storage.objects;
create policy originals_owner_read on storage.objects
  for select using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists originals_owner_write on storage.objects;
create policy originals_owner_write on storage.objects
  for insert with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage paths are content-hash-derived (same content -> same path always),
-- and syncAsset() calls upload(..., { upsert: true }). Without an UPDATE
-- policy, re-uploading to a path that already exists (a legitimate retry, or
-- simply importing the same photo again after local storage was cleared)
-- fails with "new row violates row-level security policy" -- a misleading
-- error for what's actually a missing policy, since upsert-into-an-existing-
-- object is an UPDATE at the storage layer, not an INSERT.
drop policy if exists originals_owner_update on storage.objects;
create policy originals_owner_update on storage.objects
  for update using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists thumbnails_owner_read on storage.objects;
create policy thumbnails_owner_read on storage.objects
  for select using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists thumbnails_owner_write on storage.objects;
create policy thumbnails_owner_write on storage.objects
  for insert with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists thumbnails_owner_update on storage.objects;
create policy thumbnails_owner_update on storage.objects
  for update using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Sharing (docs/phases/phase-8-collaboration-split-view.md)
--
-- A project is shared with other existing accounts as 'editor' (may change its
-- references) or 'viewer' (read-only). The owner is always projects.owner_id;
-- project_members only ever lists the *other* people. Everything below is the
-- actual security boundary -- the client's role checks only hide UI.
-- ============================================================================

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

-- The caller's role on a project *as a non-owner member* (null if none).
-- SECURITY DEFINER so policies on projects/references can consult
-- project_members without those policies and project_members' own policy
-- recursing into each other.
create or replace function public.member_role(p_project_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select m.role from public.project_members m
  where m.project_id = p_project_id and m.user_id = auth.uid()
$$;

-- projects: readable by the owner and by members; only the owner may create,
-- rename, or delete one. The owner check is a plain column comparison (not
-- via a function) so a project's owner can still see a row inserted in the
-- same statement.
drop policy if exists projects_owner on public.projects;
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select using (owner_id = auth.uid() or public.member_role(id) is not null);
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert with check (owner_id = auth.uid());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete using (owner_id = auth.uid());

-- references: whoever can see the project can read its references (the
-- subquery is itself filtered by projects_select); the owner and editors can
-- write them; only the owner can delete one directly. A viewer's write is
-- rejected here regardless of what the client does.
drop policy if exists references_owner on public."references";
drop policy if exists references_select on public."references";
create policy references_select on public."references"
  for select using (exists (select 1 from public.projects p where p.id = project_id));
drop policy if exists references_insert on public."references";
create policy references_insert on public."references"
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.owner_id = auth.uid() or public.member_role(p.id) = 'editor')
    )
  );
drop policy if exists references_update on public."references";
create policy references_update on public."references"
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.owner_id = auth.uid() or public.member_role(p.id) = 'editor')
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and (p.owner_id = auth.uid() or public.member_role(p.id) = 'editor')
    )
  );
drop policy if exists references_delete on public."references";
create policy references_delete on public."references"
  for delete using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- assets: a collaborator may read an asset (never write it) if a reference
-- they can see uses it, or a project they can see uses it as its thumbnail.
-- (assets_owner above still covers the uploader.)
drop policy if exists assets_shared_read on public.assets;
create policy assets_shared_read on public.assets
  for select using (
    exists (select 1 from public."references" r where r.original_asset_id = assets.id)
    or exists (select 1 from public.projects p where p.thumbnail_asset_id = assets.id)
  );

-- project_members: you can see your own memberships, and the owner can see
-- everyone on their project. There is deliberately no insert/update/delete
-- policy: membership changes go through the functions below, which are where
-- "only the owner may invite" is enforced.
drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- Storage: collaborators can download the images of assets they can read
-- (assets_shared_read filters the subquery to only shared ones).
drop policy if exists originals_shared_read on storage.objects;
create policy originals_shared_read on storage.objects
  for select using (
    bucket_id = 'originals'
    and exists (select 1 from public.assets a where a.storage_key = name)
  );

drop policy if exists thumbnails_shared_read on storage.objects;
create policy thumbnails_shared_read on storage.objects
  for select using (
    bucket_id = 'thumbnails'
    and exists (
      select 1 from public.assets a
      where (a.owner_id::text || '/' || a.content_hash || '.webp') = name
    )
  );

-- Invite an existing account by email. Only the owner may share, and only
-- with an account that already exists (nothing is emailed or pre-provisioned).
-- Re-inviting someone changes their role.
create or replace function public.invite_project_member(p_project_id uuid, p_email text, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to share a project';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid()) then
    raise exception 'Only the project owner can share it';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No Artiso account uses that email';
  end if;
  if v_user = auth.uid() then
    raise exception 'You already own this project';
  end if;

  insert into public.project_members (project_id, user_id, role, invited_by)
  values (p_project_id, v_user, p_role, auth.uid())
  on conflict (project_id, user_id) do update set role = excluded.role;
end;
$$;

-- The owner plus everyone the project is shared with. Only visible to people
-- already on the project.
create or replace function public.list_project_members(p_project_id uuid)
returns table (user_id uuid, email text, role text)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in to view members';
  end if;
  if not (
    exists (select 1 from public.projects p where p.id = p_project_id and p.owner_id = auth.uid())
    or exists (select 1 from public.project_members m where m.project_id = p_project_id and m.user_id = auth.uid())
  ) then
    raise exception 'You are not on this project';
  end if;

  return query
    select p.owner_id, u.email::text, 'owner'::text
    from public.projects p join auth.users u on u.id = p.owner_id
    where p.id = p_project_id
    union all
    select m.user_id, u.email::text, m.role
    from public.project_members m join auth.users u on u.id = m.user_id
    where m.project_id = p_project_id;
end;
$$;

-- The owner can remove anyone; a member can remove only themselves (leave).
create or replace function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if not (
    p_user_id = auth.uid()
    or exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid())
  ) then
    raise exception 'Only the owner can remove other people';
  end if;
  delete from public.project_members where project_id = p_project_id and user_id = p_user_id;
end;
$$;
