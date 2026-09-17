import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Asset, Project, Reference } from '@artiso/shared-types';

export interface ArtisoDB extends DBSchema {
  projects: { key: string; value: Project };
  references: { key: string; value: Reference; indexes: { byProject: string } };
  assets: { key: string; value: Asset };
  // Keyed by `${assetId}:original` / `${assetId}:thumbnail`, not by keyPath.
  blobs: { key: string; value: Blob };
}

const DB_NAME = 'artiso';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ArtisoDB>> | undefined;

// This is the local half of the sync architecture (docs/architecture/08):
// Phase 1 uses it standalone; Phase 2 adds a debounced upload queue on top
// without changing this schema.
export function getDb(): Promise<IDBPDatabase<ArtisoDB>> {
  dbPromise ??= openDB<ArtisoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('projects', { keyPath: 'id' });
      const references = db.createObjectStore('references', { keyPath: 'id' });
      references.createIndex('byProject', 'projectId');
      db.createObjectStore('assets', { keyPath: 'id' });
      db.createObjectStore('blobs');
    },
  });
  return dbPromise;
}

// Test-only: closes and drops the cached connection. Must actually close()
// the underlying IDBDatabase, not just forget the reference -- deleteDatabase
// blocks until every open connection to it is closed, and fake-indexeddb
// simply never resolves/rejects while it waits, rather than erroring.
export async function _resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = undefined;
}
