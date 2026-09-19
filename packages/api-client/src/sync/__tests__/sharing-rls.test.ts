import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs the real migration (supabase/migrations/0001_phase2_schema.sql) in an
// in-process Postgres (PGlite) and exercises the sharing policies as
// different users. RLS is the actual security boundary for collaboration, so
// it's tested against a real Postgres rather than assumed correct from
// reading the SQL. Supabase's own `auth` and `storage` schemas don't exist
// here, so minimal stand-ins are created first; everything else is the
// unmodified migration.

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
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const ASSET = '22222222-2222-4222-8222-222222222222';
const REFERENCE = '33333333-3333-4333-8333-333333333333';

let db: PGlite;

// Acts as a signed-in Supabase user: the `authenticated` role with that
// user's id in the JWT claim that auth.uid() reads.
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

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(MIGRATION);
  await db.exec(GRANTS);
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.com'), ('${EDITOR}', 'Editor@Example.com'),
      ('${VIEWER}', 'viewer@example.com'), ('${OUTSIDER}', 'outsider@example.com');
    insert into storage.objects (bucket_id, name) values
      ('originals', '${OWNER}/hash1.png'), ('thumbnails', '${OWNER}/hash1.webp'),
      ('originals', '${OUTSIDER}/other.png');
  `);

  await as(OWNER, async () => {
    await db.exec(`
      insert into public.projects (id, owner_id, name) values ('${PROJECT}', '${OWNER}', 'Shared study');
      insert into public.assets (id, owner_id, storage_key, content_hash, width, height, size_bytes)
        values ('${ASSET}', '${OWNER}', '${OWNER}/hash1.png', 'hash1', 100, 100, 10);
      update public.projects set thumbnail_asset_id = '${ASSET}' where id = '${PROJECT}';
      insert into public."references" (id, project_id, original_asset_id, grid_config, version)
        values ('${REFERENCE}', '${PROJECT}', '${ASSET}', '{}'::jsonb, 1);
    `);
  });
});

afterAll(async () => {
  await db.close();
});

describe('sharing: inviting', () => {
  it('lets the owner invite by email, case-insensitively, as editor or viewer', async () => {
    await as(OWNER, async () => {
      await db.query(`select public.invite_project_member('${PROJECT}', 'editor@example.com', 'editor')`);
      await db.query(`select public.invite_project_member('${PROJECT}', '  VIEWER@example.com ', 'viewer')`);
    });
    expect(await count(`select 1 from public.project_members where project_id = '${PROJECT}'`)).toBe(2);
  });

  it('rejects an unknown email, an invalid role, and inviting yourself', async () => {
    await as(OWNER, async () => {
      await expect(db.query(`select public.invite_project_member('${PROJECT}', 'nobody@example.com', 'viewer')`)).rejects.toThrow(/No Artiso account/);
      await expect(db.query(`select public.invite_project_member('${PROJECT}', 'viewer@example.com', 'owner')`)).rejects.toThrow(/editor or viewer/);
      await expect(db.query(`select public.invite_project_member('${PROJECT}', 'owner@example.com', 'editor')`)).rejects.toThrow(/already own/);
    });
  });

  it('refuses invites from anyone who is not the owner', async () => {
    for (const user of [EDITOR, VIEWER, OUTSIDER]) {
      await as(user, async () => {
        await expect(db.query(`select public.invite_project_member('${PROJECT}', 'outsider@example.com', 'editor')`)).rejects.toThrow(/Only the project owner/);
      });
    }
  });

  it('re-inviting changes the role instead of duplicating the membership', async () => {
    await as(OWNER, async () => {
      await db.query(`select public.invite_project_member('${PROJECT}', 'viewer@example.com', 'viewer')`);
    });
    expect(await count(`select 1 from public.project_members where user_id = '${VIEWER}'`)).toBe(1);
  });
});

describe('sharing: who can read', () => {
  it('lets the owner and both members see the project and its reference; hides them from outsiders', async () => {
    for (const user of [OWNER, EDITOR, VIEWER]) {
      await as(user, async () => {
        expect(await count(`select 1 from public.projects where id = '${PROJECT}'`)).toBe(1);
        expect(await count(`select 1 from public."references" where id = '${REFERENCE}'`)).toBe(1);
      });
    }
    await as(OUTSIDER, async () => {
      expect(await count(`select 1 from public.projects where id = '${PROJECT}'`)).toBe(0);
      expect(await count(`select 1 from public."references" where id = '${REFERENCE}'`)).toBe(0);
    });
  });

  it('shares the image asset and its stored files with members only', async () => {
    for (const user of [EDITOR, VIEWER]) {
      await as(user, async () => {
        expect(await count(`select 1 from public.assets where id = '${ASSET}'`)).toBe(1);
        expect(await count(`select 1 from storage.objects where bucket_id = 'originals' and name = '${OWNER}/hash1.png'`)).toBe(1);
        expect(await count(`select 1 from storage.objects where bucket_id = 'thumbnails' and name = '${OWNER}/hash1.webp'`)).toBe(1);
      });
    }
    await as(OUTSIDER, async () => {
      expect(await count(`select 1 from public.assets where id = '${ASSET}'`)).toBe(0);
      expect(await count(`select 1 from storage.objects where name = '${OWNER}/hash1.png'`)).toBe(0);
    });
  });

  it('does not leak unrelated files to members', async () => {
    await as(EDITOR, async () => {
      expect(await count(`select 1 from storage.objects where name = '${OUTSIDER}/other.png'`)).toBe(0);
    });
  });
});

describe('sharing: who can write', () => {
  it('lets an editor update the reference (with a higher version)', async () => {
    await as(EDITOR, async () => {
      await db.query(`update public."references" set notes = 'editor was here', version = 2 where id = '${REFERENCE}'`);
    });
    const { rows } = await db.query<{ notes: string }>(`select notes from public."references" where id = '${REFERENCE}'`);
    expect(rows[0]?.notes).toBe('editor was here');
  });

  it('silently rejects a viewer\'s update and any insert', async () => {
    await as(VIEWER, async () => {
      const updated = await db.query(`update public."references" set notes = 'viewer edit', version = 9 where id = '${REFERENCE}' returning id`);
      expect(updated.rows).toHaveLength(0);
      await expect(
        db.query(`insert into public."references" (project_id, original_asset_id, grid_config) values ('${PROJECT}', '${ASSET}', '{}'::jsonb)`),
      ).rejects.toThrow(/row-level security/);
    });
    const { rows } = await db.query<{ notes: string }>(`select notes from public."references" where id = '${REFERENCE}'`);
    expect(rows[0]?.notes).toBe('editor was here');
  });

  it('rejects an outsider\'s writes', async () => {
    await as(OUTSIDER, async () => {
      const updated = await db.query(`update public."references" set notes = 'hack' where id = '${REFERENCE}' returning id`);
      expect(updated.rows).toHaveLength(0);
      await expect(
        db.query(`insert into public."references" (project_id, original_asset_id, grid_config) values ('${PROJECT}', '${ASSET}', '{}'::jsonb)`),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('lets only the owner rename or delete the project itself', async () => {
    for (const user of [EDITOR, VIEWER, OUTSIDER]) {
      await as(user, async () => {
        const renamed = await db.query(`update public.projects set name = 'mine now' where id = '${PROJECT}' returning id`);
        expect(renamed.rows).toHaveLength(0);
        const deleted = await db.query(`delete from public.projects where id = '${PROJECT}' returning id`);
        expect(deleted.rows).toHaveLength(0);
      });
    }
    expect(await count(`select 1 from public.projects where id = '${PROJECT}' and name = 'Shared study'`)).toBe(1);
  });

  it('stops anyone but the owner claiming a project as theirs on insert', async () => {
    await as(EDITOR, async () => {
      await expect(
        db.query(`insert into public.projects (owner_id, name) values ('${OWNER}', 'forged')`),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

describe('optimistic concurrency', () => {
  it('drops a write whose version is not strictly newer and accepts a higher one', async () => {
    await as(OWNER, async () => {
      // Equal version (two writers reaching the same next version): dropped.
      await db.query(`update public."references" set notes = 'equal version' where id = '${REFERENCE}'`);
      // Behind: dropped.
      await db.query(`update public."references" set notes = 'behind', version = 1 where id = '${REFERENCE}'`);
    });
    let { rows } = await db.query<{ notes: string; version: number }>(`select notes, version from public."references" where id = '${REFERENCE}'`);
    expect(rows[0]).toEqual({ notes: 'editor was here', version: 2 });

    await as(OWNER, async () => {
      await db.query(`update public."references" set notes = 'merged', version = 3 where id = '${REFERENCE}'`);
    });
    ({ rows } = await db.query<{ notes: string; version: number }>(`select notes, version from public."references" where id = '${REFERENCE}'`));
    expect(rows[0]).toEqual({ notes: 'merged', version: 3 });
  });
});

describe('sharing: members list and leaving', () => {
  it('shows the owner plus members to anyone on the project, and to no one else', async () => {
    for (const user of [OWNER, EDITOR, VIEWER]) {
      await as(user, async () => {
        const { rows } = await db.query<{ email: string; role: string }>(
          `select email, role from public.list_project_members('${PROJECT}') order by role, email`,
        );
        expect(rows.map((r) => `${r.role}:${r.email.toLowerCase()}`)).toEqual([
          'editor:editor@example.com',
          'owner:owner@example.com',
          'viewer:viewer@example.com',
        ]);
      });
    }
    await as(OUTSIDER, async () => {
      await expect(db.query(`select * from public.list_project_members('${PROJECT}')`)).rejects.toThrow(/not on this project/);
    });
  });

  it('does not let clients write memberships directly', async () => {
    await as(EDITOR, async () => {
      await expect(
        db.query(`insert into public.project_members (project_id, user_id, role) values ('${PROJECT}', '${OUTSIDER}', 'editor')`),
      ).rejects.toThrow(/row-level security/);
      const promoted = await db.query(`update public.project_members set role = 'editor' where user_id = '${VIEWER}' returning user_id`);
      expect(promoted.rows).toHaveLength(0);
    });
  });

  it('only lets the owner remove other people, but anyone leave', async () => {
    await as(EDITOR, async () => {
      await expect(db.query(`select public.remove_project_member('${PROJECT}', '${VIEWER}')`)).rejects.toThrow(/Only the owner/);
    });
    await as(VIEWER, async () => {
      await db.query(`select public.remove_project_member('${PROJECT}', '${VIEWER}')`);
      expect(await count(`select 1 from public.projects where id = '${PROJECT}'`)).toBe(0);
    });
    await as(OWNER, async () => {
      await db.query(`select public.remove_project_member('${PROJECT}', '${EDITOR}')`);
    });
    await as(EDITOR, async () => {
      expect(await count(`select 1 from public."references" where id = '${REFERENCE}'`)).toBe(0);
      expect(await count(`select 1 from public.assets where id = '${ASSET}'`)).toBe(0);
    });
  });
});
