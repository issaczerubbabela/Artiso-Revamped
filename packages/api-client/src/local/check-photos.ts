import type { CheckPhoto } from '@artiso/shared-types';
import { getDb, type StoredBlob } from './db';

// What sync still has to send for a reference's Check Photo:
// - 'upload': a new photo (image and row);
// - 'corners': only the corners changed (row only);
// - 'delete': the photo was deleted here;
// - null: in step with the server (or never signed in to send it anywhere).
export type CheckPhotoPending = 'upload' | 'corners' | 'delete' | null;

// One record per reference: this device's Check Photo for it, if any
// (docs/adr/0001-check-photos-synced-apart-from-the-reference.md). Kept in its
// own store, never on the Reference, so nothing about it can reach the
// EditStack, a collaborator's merge or an export.
export interface CheckPhotoRecord {
  referenceId: string;
  // null once deleted here, until sync has deleted it remotely too.
  photo: CheckPhoto | null;
  image: StoredBlob | null;
  pending: CheckPhotoPending;
  // When it was deleted, so a newer photo taken on another device wins.
  deletedAt: string | null;
}

export interface LocalCheckPhoto {
  photo: CheckPhoto;
  blob: Blob;
}

async function toStored(blob: Blob): Promise<StoredBlob> {
  return { bytes: await blob.arrayBuffer(), type: blob.type };
}

function fromStored(value: StoredBlob): Blob {
  return value instanceof Blob ? value : new Blob([value.bytes], { type: value.type });
}

export async function getCheckPhotoRecord(referenceId: string): Promise<CheckPhotoRecord | undefined> {
  const db = await getDb();
  return db.get('checkPhotos', referenceId);
}

// The Check Photo to show for a reference, or null if there is none.
export async function getCheckPhoto(referenceId: string): Promise<LocalCheckPhoto | null> {
  const record = await getCheckPhotoRecord(referenceId);
  if (!record?.photo || !record.image) return null;
  return { photo: record.photo, blob: fromStored(record.image) };
}

// A new Check Photo for its reference, replacing any earlier one (only the
// latest is kept). Queued for upload.
export async function saveCheckPhoto(photo: CheckPhoto, blob: Blob): Promise<void> {
  const image = await toStored(blob);
  const db = await getDb();
  const record: CheckPhotoRecord = { referenceId: photo.referenceId, photo, image, pending: 'upload', deletedAt: null };
  await db.put('checkPhotos', record);
}

// New corners for the existing photo. Returns the updated photo, or null if
// there is none.
export async function updateCheckPhotoCorners(
  referenceId: string,
  corners: CheckPhoto['corners'],
): Promise<CheckPhoto | null> {
  const db = await getDb();
  const tx = db.transaction('checkPhotos', 'readwrite');
  const record = await tx.store.get(referenceId);
  if (!record?.photo) {
    await tx.done;
    return null;
  }
  const photo: CheckPhoto = { ...record.photo, corners, updatedAt: new Date().toISOString() };
  await tx.store.put({ ...record, photo, pending: record.pending === 'upload' ? 'upload' : 'corners' });
  await tx.done;
  return photo;
}

// Deletes the photo here and queues the remote delete.
export async function deleteCheckPhoto(referenceId: string): Promise<void> {
  const db = await getDb();
  const record: CheckPhotoRecord = {
    referenceId,
    photo: null,
    image: null,
    pending: 'delete',
    deletedAt: new Date().toISOString(),
  };
  await db.put('checkPhotos', record);
}

// Takes the server's copy (from another device). `blob` is null when only the
// corners changed and the image held here is still the right one.
export async function applyRemoteCheckPhoto(photo: CheckPhoto, blob: Blob | null): Promise<void> {
  const image = blob ? await toStored(blob) : null;
  const db = await getDb();
  const tx = db.transaction('checkPhotos', 'readwrite');
  const existing = await tx.store.get(photo.referenceId);
  const keep = image ?? (existing?.photo?.id === photo.id ? existing.image : null);
  await tx.store.put({ referenceId: photo.referenceId, photo, image: keep, pending: null, deletedAt: null });
  await tx.done;
}

// Drops the record entirely: the photo is gone everywhere.
export async function forgetCheckPhoto(referenceId: string): Promise<void> {
  const db = await getDb();
  await db.delete('checkPhotos', referenceId);
}

// Marks the record as sent -- but only if nothing changed while it was being
// sent (`sent` is the record sync read). A change made meanwhile stays
// pending for the next sync. `photo` replaces the stored one (sync may have
// filled in the owner and storage key).
export async function markCheckPhotoSynced(sent: CheckPhotoRecord, photo: CheckPhoto | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('checkPhotos', 'readwrite');
  const current = await tx.store.get(sent.referenceId);
  const unchanged =
    current !== undefined &&
    current.pending === sent.pending &&
    current.deletedAt === sent.deletedAt &&
    current.photo?.id === sent.photo?.id &&
    current.photo?.updatedAt === sent.photo?.updatedAt;
  if (unchanged) {
    if (photo) await tx.store.put({ ...current, photo, pending: null });
    else await tx.store.delete(sent.referenceId);
  }
  await tx.done;
}
