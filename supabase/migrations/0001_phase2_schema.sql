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

-- Row Level Security: every table scoped to owner_id = auth.uid(), or (for
-- "references", which has no owner_id of its own) reachable only via a
-- project the caller owns. No cross-account read/write in Phases 0-5.
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public."references" enable row level security;
alter table public.presets enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists projects_owner on public.projects;
create policy projects_owner on public.projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists assets_owner on public.assets;
create policy assets_owner on public.assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists presets_owner on public.presets;
create policy presets_owner on public.presets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists references_owner on public."references";
create policy references_owner on public."references"
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- Last-write-wins conflict resolution (docs/architecture/08's "explicit
-- simplifying assumption"), enforced server-side rather than via a
-- client-side read-then-write race: a stale write (incoming version lower
-- than what's already stored) is silently dropped, leaving the row
-- unchanged. The client detects this by checking the version on the row
-- upsert() returns and re-pulling if it doesn't match what it sent (see
-- packages/api-client/src/sync/reference.ts).
create or replace function public.enforce_reference_version()
returns trigger as $$
begin
  if new.version < old.version then
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
