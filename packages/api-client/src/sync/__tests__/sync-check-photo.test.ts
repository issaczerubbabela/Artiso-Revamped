import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckPhoto } from '@artiso/shared-types';

// A small in-memory stand-in for the Supabase client: tables of rows with
// eq-filters, upsert on a conflict key, and a storage bucket of files. Enough
// to drive the real sync code end to end; RLS itself is covered against real
// Postgres in check-photos-rls.test.ts.
type Row = Record<string, unknown>;
const server = {
  userId: null as string | null,
  tables: new Map<string, Row[]>(),
  files: new Map<string, Blob>(),
  failWrites: false,
};

function table(name: string): Row[] {
  if (!server.tables.has(name)) server.tables.set(name, []);
  return server.tables.get(name)!;
}

function query(name: string) {
  const filters: [string, unknown][] = [];
  const matches = () => table(name).filter((row) => filters.every(([k, v]) => row[k] === v));
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return builder;
    },
    maybeSingle: async () => ({ data: matches()[0] ?? null, error: null }),
    single: async () => {
      const row = matches()[0];
      return row ? { data: row, error: null } : { data: null, error: { message: 'no rows' } };
    },
    then: (resolve: (value: { error: null }) => void) => {
      // A delete builder is awaited directly.
      if (mode === 'delete') {
        const keep = table(name).filter((row) => !filters.every(([k, v]) => row[k] === v));
        server.tables.set(name, keep);
      }
      resolve({ error: null });
    },
  };
  let mode: 'select' | 'delete' = 'select';
  return {
    select: () => builder,
    delete: () => {
      mode = 'delete';
      return builder;
    },
    upsert: async (row: Row, options?: { onConflict?: string }) => {
      if (server.failWrites) return { error: { message: 'network down' } };
      const keys = (options?.onConflict ?? 'id').split(',');
      const rows = table(name).filter((existing) => !keys.every((k) => existing[k] === row[k]));
      rows.push({ ...row });
      server.tables.set(name, rows);
      return { error: null };
    },
  };
}

vi.mock('../../supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: server.userId ? { user: { id: server.userId } } : null }, error: null }),
    },
    from: (name: string) => query(name),
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => {
          if (server.failWrites) return { error: { message: 'network down' } };
          server.files.set(path, blob);
          return { error: null };
        },
        download: async (path: string) => {
          const file = server.files.get(path);
          return file ? { data: file, error: null } : { data: null, error: { message: 'not found' } };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) server.files.delete(path);
          return { error: null };
        },
      }),
    },
  }),
}));

const { resetTestDatabase } = await import('../../local/__tests__/test-helpers');
const local = await import('../../local');
const { syncCheckPhoto } = await import('../check-photo');
const { syncReferenceNow } = await import('../queue');
const { getSyncStatus } = await import('../status');
const { subscribeCheckPhotoUpdates } = await import('../events');

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REFERENCE = '33333333-3333-4333-8333-333333333333';

function photo(id: string, updatedAt: string, ownerId = USER): CheckPhoto {
  return {
    id,
    ownerId,
    referenceId: REFERENCE,
    image: { storageKey: 'local', mimeType: 'image/jpeg', width: 400, height: 300, sizeBytes: 3 },
    corners: [
      { x: 10, y: 10 },
      { x: 390, y: 12 },
      { x: 385, y: 290 },
      { x: 12, y: 288 },
    ],
    createdAt: updatedAt,
    updatedAt,
  };
}

const PHOTO_A = '44444444-4444-4444-8444-444444444444';
const PHOTO_B = '55555555-5555-4555-8555-555555555555';
const blob = (text: string) => new Blob([text], { type: 'image/jpeg' });

async function remoteRows(): Promise<Row[]> {
  return table('check_photos');
}

beforeEach(async () => {
  await resetTestDatabase();
  server.userId = USER;
  server.tables.clear();
  server.files.clear();
  server.failWrites = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncCheckPhoto: upload', () => {
  it('uploads a new photo to the uploader\'s own folder and records its row', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await syncCheckPhoto(REFERENCE);

    const rows = await remoteRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: PHOTO_A, owner_id: USER, reference_id: REFERENCE, storage_key: `${USER}/${REFERENCE}.jpg` });
    expect(await server.files.get(`${USER}/${REFERENCE}.jpg`)?.text()).toBe('aaa');
    expect((await local.getCheckPhotoRecord(REFERENCE))?.pending).toBeNull();
  });

  it('files a photo taken signed out under the user who then signs in', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z', local.LOCAL_OWNER_ID), blob('aaa'));
    await syncCheckPhoto(REFERENCE);
    expect((await remoteRows())[0]).toMatchObject({ owner_id: USER });
    expect((await local.getCheckPhoto(REFERENCE))?.photo.ownerId).toBe(USER);
  });

  it('does nothing while signed out, and keeps the photo queued', async () => {
    server.userId = null;
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await syncCheckPhoto(REFERENCE);
    expect(await remoteRows()).toHaveLength(0);
    expect((await local.getCheckPhotoRecord(REFERENCE))?.pending).toBe('upload');
  });

  it('sends only the row when just the corners changed', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await syncCheckPhoto(REFERENCE);
    server.files.clear();

    const moved = photo(PHOTO_A, '2026-11-07T10:00:00.000Z').corners.map((p) => ({ x: p.x + 5, y: p.y })) as CheckPhoto['corners'];
    await local.updateCheckPhotoCorners(REFERENCE, moved);
    await syncCheckPhoto(REFERENCE);

    expect((await remoteRows())[0]?.corners).toEqual(moved);
    expect(server.files.size).toBe(0);
  });

  it('keeps a failed upload queued and reports the failure', async () => {
    server.failWrites = true;
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await expect(syncCheckPhoto(REFERENCE)).rejects.toThrow('network down');
    expect((await local.getCheckPhotoRecord(REFERENCE))?.pending).toBe('upload');
  });
});

describe('syncCheckPhoto: replace', () => {
  it('a new photo replaces the old one: one row, one file', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('old'));
    await syncCheckPhoto(REFERENCE);
    await local.saveCheckPhoto(photo(PHOTO_B, '2026-11-07T11:00:00.000Z'), blob('new'));
    await syncCheckPhoto(REFERENCE);

    const rows = await remoteRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(PHOTO_B);
    expect([...server.files.keys()]).toEqual([`${USER}/${REFERENCE}.jpg`]);
    expect(await server.files.get(`${USER}/${REFERENCE}.jpg`)?.text()).toBe('new');
  });

  it('takes a newer photo from another device (phone to iPad), downloading its image', async () => {
    // The phone uploaded a photo; this device has none.
    const fromPhone = photo(PHOTO_B, '2026-11-07T11:00:00.000Z');
    table('check_photos').push({
      id: PHOTO_B,
      owner_id: USER,
      reference_id: REFERENCE,
      storage_key: `${USER}/${REFERENCE}.jpg`,
      mime_type: 'image/jpeg',
      width: 400,
      height: 300,
      size_bytes: 3,
      corners: fromPhone.corners,
      created_at: '2026-11-07T11:00:00+00:00',
      updated_at: '2026-11-07T11:00:00+00:00',
    });
    server.files.set(`${USER}/${REFERENCE}.jpg`, blob('phone'));
    const updates: string[] = [];
    const unsubscribe = subscribeCheckPhotoUpdates((id) => updates.push(id));

    await syncCheckPhoto(REFERENCE);
    unsubscribe();

    const got = await local.getCheckPhoto(REFERENCE);
    expect(got?.photo.id).toBe(PHOTO_B);
    expect(await got?.blob.text()).toBe('phone');
    expect(updates).toEqual([REFERENCE]);

    // Already in step: a second sync changes nothing and announces nothing.
    const again: string[] = [];
    const unsubscribeAgain = subscribeCheckPhotoUpdates((id) => again.push(id));
    await syncCheckPhoto(REFERENCE);
    unsubscribeAgain();
    expect(again).toEqual([]);
  });

  it('lets a newer photo on the server win over an older unsent one here', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('ipad'));
    table('check_photos').push({
      id: PHOTO_B,
      owner_id: USER,
      reference_id: REFERENCE,
      storage_key: `${USER}/${REFERENCE}.jpg`,
      mime_type: 'image/jpeg',
      width: 400,
      height: 300,
      size_bytes: 3,
      corners: photo(PHOTO_B, '2026-11-07T12:00:00.000Z').corners,
      created_at: '2026-11-07T12:00:00+00:00',
      updated_at: '2026-11-07T12:00:00+00:00',
    });
    server.files.set(`${USER}/${REFERENCE}.jpg`, blob('phone'));

    await syncCheckPhoto(REFERENCE);
    expect((await local.getCheckPhoto(REFERENCE))?.photo.id).toBe(PHOTO_B);
    expect((await remoteRows())[0]?.id).toBe(PHOTO_B);
  });
});

describe('syncCheckPhoto: delete', () => {
  it('deletes the row and the file, then forgets the photo here', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await syncCheckPhoto(REFERENCE);
    await local.deleteCheckPhoto(REFERENCE);
    await syncCheckPhoto(REFERENCE);

    expect(await remoteRows()).toHaveLength(0);
    expect(server.files.size).toBe(0);
    expect(await local.getCheckPhotoRecord(REFERENCE)).toBeUndefined();
  });

  it('drops a synced photo that was deleted on another device', async () => {
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), blob('aaa'));
    await syncCheckPhoto(REFERENCE);
    server.tables.set('check_photos', []);

    await syncCheckPhoto(REFERENCE);
    expect(await local.getCheckPhoto(REFERENCE)).toBeNull();
  });
});

describe('syncCheckPhoto: uploader-only', () => {
  it('only ever asks for and writes the signed-in user\'s own photo', async () => {
    // Another user's photo on the same reference is never pulled.
    table('check_photos').push({
      id: PHOTO_B,
      owner_id: OTHER_USER,
      reference_id: REFERENCE,
      storage_key: `${OTHER_USER}/${REFERENCE}.jpg`,
      mime_type: 'image/jpeg',
      width: 400,
      height: 300,
      size_bytes: 3,
      corners: photo(PHOTO_B, '2026-11-07T12:00:00.000Z').corners,
      created_at: '2026-11-07T12:00:00+00:00',
      updated_at: '2026-11-07T12:00:00+00:00',
    });
    server.files.set(`${OTHER_USER}/${REFERENCE}.jpg`, blob('theirs'));

    await syncCheckPhoto(REFERENCE);
    expect(await local.getCheckPhoto(REFERENCE)).toBeNull();

    // And deleting ours leaves theirs alone.
    await local.saveCheckPhoto(photo(PHOTO_A, '2026-11-07T13:00:00.000Z'), blob('ours'));
    await syncCheckPhoto(REFERENCE);
    await local.deleteCheckPhoto(REFERENCE);
    await syncCheckPhoto(REFERENCE);
    expect((await remoteRows()).map((row) => row.owner_id)).toEqual([OTHER_USER]);
    expect(await server.files.get(`${OTHER_USER}/${REFERENCE}.jpg`)?.text()).toBe('theirs');
  });
});

describe('the sync queue: offline replay', () => {
  it('holds a Check Photo taken offline and uploads it once back online', async () => {
    const project = await local.createProject('Study', USER);
    const reference = await local.createReference({
      projectId: project.id,
      originalAssetId: REFERENCE,
      gridConfig: { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true },
    });
    await local.saveCheckPhoto({ ...photo(PHOTO_A, '2026-11-07T10:00:00.000Z'), referenceId: reference.id }, blob('offline'));

    vi.stubGlobal('navigator', { onLine: false });
    await syncReferenceNow(project.id, reference.id);
    expect(getSyncStatus(project.id)).toBe('offline');
    expect(await remoteRows()).toHaveLength(0);
    expect((await local.getCheckPhotoRecord(reference.id))?.pending).toBe('upload');

    vi.stubGlobal('navigator', { onLine: true });
    await syncReferenceNow(project.id, reference.id);
    expect(getSyncStatus(project.id)).toBe('synced');
    const rows = await remoteRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: PHOTO_A, reference_id: reference.id });
    expect(await server.files.get(`${USER}/${reference.id}.jpg`)?.text()).toBe('offline');
    expect((await local.getCheckPhotoRecord(reference.id))?.pending).toBeNull();
    // The reference itself went first, untouched by the photo.
    expect(table('references').map((row) => row.id)).toEqual([reference.id]);
  });
});
