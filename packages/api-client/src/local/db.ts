import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Asset, Preset, Project, Reference } from '@artiso/shared-types';

export interface ArtisoDB extends DBSchema {
  projects: { key: string; value: Project };
  references: { key: string; value: Reference; indexes: { byProject: string } };
  assets: { key: string; value: Asset };
  // Keyed by `${assetId}:original` / `${assetId}:thumbnail`, not by keyPath.
  blobs: { key: string; value: Blob };
  presets: { key: string; value: Preset };
  // The last copy of each Reference this device synced -- the common
  // starting point a collaborative three-way merge compares against.
  syncBases: { key: string; value: Reference };
}

const DB_NAME = 'artiso';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<ArtisoDB>> | undefined;

// This is the local half of the sync architecture (docs/architecture/08):
// Phase 1 uses it standalone; Phase 2 adds a debounced upload queue on top;
// v3 adds the syncBases store for collaborative merges. Each `if (!db.objectStoreNames.contains(...))`
// guard means the upgrade callback works correctly both for a browser
// upgrading from v1 (only `presets` is missing) and one opening fresh at v2
// (everything is missing) -- IndexedDB only replays this callback for
// versions the browser hasn't already reached, so it can't be split into
// separate v1/v2 blocks without also guarding each store's existence.
export function getDb(): Promise<IDBPDatabase<ArtisoDB>> {
  dbPromise ??= openDB<ArtisoDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('references')) {
        const references = db.createObjectStore('references', { keyPath: 'id' });
        references.createIndex('byProject', 'projectId');
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs');
      }
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncBases')) {
        db.createObjectStore('syncBases', { keyPath: 'id' });
      }
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
