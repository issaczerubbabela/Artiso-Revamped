import type { Reference } from '@artiso/shared-types';
import { getDb } from './db';
import { normalizeReference } from './references';

export async function getSyncBase(referenceId: string): Promise<Reference | undefined> {
  const db = await getDb();
  const raw = await db.get('syncBases', referenceId);
  return raw && normalizeReference(raw);
}

export async function saveSyncBase(reference: Reference): Promise<void> {
  const db = await getDb();
  await db.put('syncBases', reference);
}
