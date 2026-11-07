import { CheckPhotoSchema, type CheckPhoto } from '@artiso/shared-types';
import {
  applyRemoteCheckPhoto,
  forgetCheckPhoto,
  getCheckPhotoRecord,
  markCheckPhotoSynced,
  type CheckPhotoRecord,
} from '../local';
import { getSupabaseClient } from '../supabase-client';
import { emitCheckPhotoUpdated } from './events';
import { extensionForMimeType } from './mime';
import type { CheckPhotoRow } from './row-types';

const TABLE = 'check_photos';
const BUCKET = 'check-photos';

// Brings this device's Check Photo for a reference in step with the server's
// (docs/adr/0001-check-photos-synced-apart-from-the-reference.md). Runs from
// the reference sync queue, after the reference row itself, so the row this
// one points at already exists remotely.
//
// Only the latest photo is kept, so between devices the newest change wins:
// a pending local change is sent unless the server already has something
// newer, in which case the server's copy is taken instead.
//
// Throws only when a local change failed to send (so the queue shows an
// error and retries); a failed *pull* with nothing pending loses nothing and
// is not worth an error badge.
export async function syncCheckPhoto(referenceId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return;

  const record = await getCheckPhotoRecord(referenceId);
  const pending = record?.pending ?? null;

  let remote: CheckPhoto | null;
  try {
    remote = await pullCheckPhoto(userId, referenceId);
  } catch (error) {
    if (pending) throw error;
    return;
  }

  if (record && pending === 'delete') {
    if (remote && isNewer(remote.updatedAt, record.deletedAt)) {
      await takeRemote(remote, record);
      return;
    }
    if (remote) await removeRemote(userId, referenceId, remote.image.storageKey);
    await markCheckPhotoSynced(record, null);
    return;
  }

  if (record?.photo && (pending === 'upload' || pending === 'corners')) {
    if (remote && isNewer(remote.updatedAt, record.photo.updatedAt)) {
      await takeRemote(remote, record);
      return;
    }
    const sent = await pushCheckPhoto(userId, record, remote);
    await markCheckPhotoSynced(record, sent);
    return;
  }

  // Nothing to send: follow the server.
  if (!remote) {
    if (record?.photo) {
      // It was synced and has since been deleted on another device.
      await forgetCheckPhoto(referenceId);
      emitCheckPhotoUpdated(referenceId);
    }
    return;
  }
  const local = record?.photo ?? null;
  if (local && local.id === remote.id && local.updatedAt === remote.updatedAt) return;
  await takeRemote(remote, record);
}

export async function pullCheckPhoto(userId: string, referenceId: string): Promise<CheckPhoto | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLE)
    .select('*')
    .eq('owner_id', userId)
    .eq('reference_id', referenceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToCheckPhoto(data as CheckPhotoRow) : null;
}

// Uploads the image (unless only the corners changed and the server already
// has this photo's image), then upserts the row on (owner, reference) -- which
// is what replaces an older photo. Returns the photo as sent.
async function pushCheckPhoto(userId: string, record: CheckPhotoRecord, remote: CheckPhoto | null): Promise<CheckPhoto> {
  const supabase = getSupabaseClient();
  const local = record.photo as CheckPhoto;
  const storageKey = `${userId}/${local.referenceId}.${extensionForMimeType(local.image.mimeType)}`;
  // A photo taken signed out carries the local owner id; it is the signed-in
  // user's once it is sent.
  const photo: CheckPhoto = { ...local, ownerId: userId, image: { ...local.image, storageKey } };

  const needsImage = record.pending === 'upload' || remote?.id !== photo.id || remote.image.storageKey !== storageKey;
  if (needsImage) {
    if (!record.image) throw new Error('The Check Photo image is missing on this device.');
    const blob = record.image instanceof Blob ? record.image : new Blob([record.image.bytes], { type: record.image.type });
    const { error } = await supabase.storage.from(BUCKET).upload(storageKey, blob, { upsert: true, contentType: photo.image.mimeType });
    if (error) throw new Error(error.message);
    // A replacement of another type lands at another path: drop the old file.
    if (remote && remote.image.storageKey !== storageKey) {
      await supabase.storage.from(BUCKET).remove([remote.image.storageKey]);
    }
  }

  const { error } = await supabase.from(TABLE).upsert(checkPhotoToRow(photo), { onConflict: 'owner_id,reference_id' });
  if (error) throw new Error(error.message);
  return photo;
}

async function removeRemote(userId: string, referenceId: string, storageKey: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).delete().eq('owner_id', userId).eq('reference_id', referenceId);
  if (error) throw new Error(error.message);
  const removed = await supabase.storage.from(BUCKET).remove([storageKey]);
  if (removed.error) throw new Error(removed.error.message);
}

// Adopts the server's photo, downloading the image unless this device already
// holds this very photo (only its corners changed).
async function takeRemote(remote: CheckPhoto, record: CheckPhotoRecord | undefined): Promise<void> {
  const sameImage = record?.photo?.id === remote.id && record.image !== null;
  let blob: Blob | null = null;
  if (!sameImage) {
    const { data, error } = await getSupabaseClient().storage.from(BUCKET).download(remote.image.storageKey);
    if (error) throw new Error(error.message);
    blob = data;
  }
  await applyRemoteCheckPhoto(remote, blob);
  emitCheckPhotoUpdated(remote.referenceId);
}

function isNewer(a: string, b: string | null | undefined): boolean {
  return b == null || Date.parse(a) > Date.parse(b);
}

function checkPhotoToRow(photo: CheckPhoto): CheckPhotoRow {
  return {
    id: photo.id,
    owner_id: photo.ownerId,
    reference_id: photo.referenceId,
    storage_key: photo.image.storageKey,
    mime_type: photo.image.mimeType,
    width: photo.image.width,
    height: photo.image.height,
    size_bytes: photo.image.sizeBytes,
    corners: photo.corners,
    created_at: photo.createdAt,
    updated_at: photo.updatedAt,
  };
}

function rowToCheckPhoto(row: CheckPhotoRow): CheckPhoto {
  return CheckPhotoSchema.parse({
    id: row.id,
    ownerId: row.owner_id,
    referenceId: row.reference_id,
    image: {
      storageKey: row.storage_key,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      sizeBytes: Number(row.size_bytes),
    },
    corners: row.corners,
    // Postgres hands timestamps back in its own format; normalise them so
    // they compare equal to what this device wrote.
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}
