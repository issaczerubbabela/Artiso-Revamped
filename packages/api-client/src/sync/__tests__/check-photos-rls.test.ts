import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs the real migration in an in-process Postgres (PGlite) and checks that a
// Check Photo -- its row and its stored file -- is readable and writable by the
// person who uploaded it and nobody else, not even the project's owner or an
// editor (docs/adr/0001-check-photos-synced-apart-from-the-reference.md). Same
// harness as sharing-rls.test.ts.

const MIGRATION = readFileSync(
  fileURLToPath(new URL('../../../../../supabase/migrations/0001_phase2_schema.sql', import.meta.url)),
  'utf-8',
);

const STUBS = `
  create schema auth;
  create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create role authenticated nologin;
`;

const GRANTS = `
  grant usage on schema public, auth, storage to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select, insert, update, delete on all tables in schema storage to authenticated;
  grant execute on all functions in schema public to authenticated;
  grant execute on function auth.uid() to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
`;

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EDITOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OUTSIDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const ASSET = '22222222-2222-4222-8222-222222222222';
const REFERENCE = '33333333-3333-4333-8333-333333333333';
const OWNER_PHOTO = '44444444-4444-4444-8444-444444444444';
const EDITOR_PHOTO = '55555555-5555-4555-8555-555555555555';
const CORNERS = `'[{"x":0,"y":0},{"x":10,"y":0},{"x":10,"y":10},{"x":0,"y":10}]'::jsonb`;

let db: PGlite;

async function as<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function count(sql: string): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`);
  return result.rows[0]?.n ?? 0;
}

function insertPhoto(id: string, owner: string): string {
  return `insert into public.check_photos (id, owner_id, reference_id, storage_key, mime_type, width, height, size_bytes, corners)
    values ('${id}', '${owner}', '${REFERENCE}', '${owner}/${REFERENCE}.jpg', 'image/jpeg', 100, 100, 10, ${CORNERS})`;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(MIGRATION);
  await db.exec(GRANTS);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'), ('${EDITOR}', 'editor@example.com'), ('${OUTSIDER}', 'outsider@example.com');
  `);
  await as(OWNER, async () => {
    await db.exec(`
      insert into public.projects (id, owner_id, name) values ('${PROJECT}', '${OWNER}', 'Shared study');
      insert into public.assets (id, owner_id, storage_key, content_hash, width, height, size_bytes)
        values ('${ASSET}', '${OWNER}', '${OWNER}/hash1.png', 'hash1', 100, 100, 10);
      insert into public."references" (id, project_id, original_asset_id, grid_config, version)
        values ('${REFERENCE}', '${PROJECT}', '${ASSET}', '{}'::jsonb, 1);
    `);
    await db.query(`select public.invite_project_member('${PROJECT}', 'editor@example.com', 'editor')`);
  });
});

afterAll(async () => {
  await db.close();
});

describe('check_photos: uploader-only access', () => {
  it('lets the owner and a collaborator each keep their own Check Photo on the same reference', async () => {
    await as(OWNER, () => db.exec(insertPhoto(OWNER_PHOTO, OWNER)));
    await as(EDITOR, () => db.exec(insertPhoto(EDITOR_PHOTO, EDITOR)));
    expect(await count(`select 1 from public.check_photos`)).toBe(2);
  });

  it('shows each person only their own photo -- not even the project owner sees a collaborator\'s', async () => {
    await as(OWNER, async () => {
      expect(await count(`select 1 from public.check_photos`)).toBe(1);
      expect(await count(`select 1 from public.check_photos where owner_id = '${EDITOR}'`)).toBe(0);
    });
    await as(EDITOR, async () => {
      expect(await count(`select 1 from public.check_photos where owner_id = '${EDITOR}'`)).toBe(1);
      expect(await count(`select 1 from public.check_photos where owner_id = '${OWNER}'`)).toBe(0);
    });
    await as(OUTSIDER, async () => {
      expect(await count(`select 1 from public.check_photos`)).toBe(0);
    });
  });

  it('refuses a photo filed under someone else\'s id, or on a reference the uploader cannot see', async () => {
    await as(EDITOR, async () => {
      await expect(db.exec(insertPhoto('66666666-6666-4666-8666-666666666666', OUTSIDER))).rejects.toThrow(/row-level security/);
    });
    await as(OUTSIDER, async () => {
      await expect(db.exec(insertPhoto('77777777-7777-4777-8777-777777777777', OUTSIDER))).rejects.toThrow(/row-level security/);
    });
  });

  it('keeps one photo per user per reference: a new one replaces the row', async () => {
    const replacement = '88888888-8888-4888-8888-888888888888';
    await as(OWNER, async () => {
      await db.exec(`${insertPhoto(replacement, OWNER)}
        on conflict (owner_id, reference_id) do update set id = excluded.id, updated_at = now()`);
      expect(await count(`select 1 from public.check_photos`)).toBe(1);
      expect(await count(`select 1 from public.check_photos where id = '${replacement}'`)).toBe(1);
    });
  });

  it('lets nobody but the uploader change or delete a photo', async () => {
    await as(OWNER, async () => {
      const updated = await db.query(`update public.check_photos set width = 1 where owner_id = '${EDITOR}' returning id`);
      expect(updated.rows).toHaveLength(0);
      const deleted = await db.query(`delete from public.check_photos where owner_id = '${EDITOR}' returning id`);
      expect(deleted.rows).toHaveLength(0);
    });
    await as(EDITOR, async () => {
      const deleted = await db.query(`delete from public.check_photos where owner_id = '${EDITOR}' returning id`);
      expect(deleted.rows).toHaveLength(1);
    });
  });

  it('is removed with its reference', async () => {
    await as(OWNER, () => db.exec(`delete from public."references" where id = '${REFERENCE}'`));
    expect(await count(`select 1 from public.check_photos`)).toBe(0);
  });
});

describe('check-photos storage bucket: uploader-only access', () => {
  it('lets the uploader write, overwrite, read and remove their own file', async () => {
    await as(EDITOR, async () => {
      await db.exec(`insert into storage.objects (bucket_id, name) values ('check-photos', '${EDITOR}/${REFERENCE}.jpg')`);
      const overwritten = await db.query(
        `update storage.objects set name = name where bucket_id = 'check-photos' and name = '${EDITOR}/${REFERENCE}.jpg' returning id`,
      );
      expect(overwritten.rows).toHaveLength(1);
      expect(await count(`select 1 from storage.objects where bucket_id = 'check-photos'`)).toBe(1);
    });
  });

  it('hides the file from the project owner and outsiders, and refuses writes into another user\'s folder', async () => {
    for (const user of [OWNER, OUTSIDER]) {
      await as(user, async () => {
        expect(await count(`select 1 from storage.objects where bucket_id = 'check-photos'`)).toBe(0);
        const deleted = await db.query(`delete from storage.objects where bucket_id = 'check-photos' returning id`);
        expect(deleted.rows).toHaveLength(0);
      });
    }
    await as(OWNER, async () => {
      await expect(
        db.exec(`insert into storage.objects (bucket_id, name) values ('check-photos', '${EDITOR}/${REFERENCE}.jpg')`),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('lets the uploader delete their file', async () => {
    await as(EDITOR, async () => {
      const deleted = await db.query(`delete from storage.objects where bucket_id = 'check-photos' returning id`);
      expect(deleted.rows).toHaveLength(1);
    });
  });
});
