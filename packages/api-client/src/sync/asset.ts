import type { Asset } from '@artiso/shared-types';
import { applyRemoteAsset, getAssetBlob } from '../local';
import { getSupabaseClient } from '../supabase-client';
import { extensionForMimeType } from './mime';
import type { AssetRow } from './row-types';

// Uploads assets before metadata, and dedupes by id (docs/architecture/08 --
// re-importing an already-uploaded image shouldn't re-upload the binary).
// asset.id is expected to already be content-derived (core-engine's
// deterministicUuid over ownerId+contentHash, computed at import time), so
// looking it up by id *is* the content-hash dedupe check -- and critically,
// it means a match found here is guaranteed to be the same id the caller's
// Reference/Project already point at, never a different pre-existing row
// for the same content under a different id (which was the actual bug this
// replaced: a random local id could match an existing remote row by content
// hash alone, short-circuit the upload, and leave the caller's Reference
// pointing at an asset id nothing had ever inserted remotely).
export async function syncAsset(asset: Asset, originalBlob: Blob, thumbnailBlob: Blob): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing, error: lookupError } = await supabase
    .from('assets')
    .select('id')
    .eq('id', asset.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (existing) return;

  const originalExt = extensionForMimeType(originalBlob.type);
  const originalPath = `${asset.ownerId}/${asset.contentHash}.${originalExt}`;
  const thumbnailPath = `${asset.ownerId}/${asset.contentHash}.webp`;

  const [originalUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from('originals').upload(originalPath, originalBlob, { upsert: true, contentType: originalBlob.type }),
    supabase.storage.from('thumbnails').upload(thumbnailPath, thumbnailBlob, { upsert: true, contentType: thumbnailBlob.type }),
  ]);
  if (originalUpload.error) throw new Error(originalUpload.error.message);
  if (thumbnailUpload.error) throw new Error(thumbnailUpload.error.message);

  const row: AssetRow = {
    id: asset.id,
    owner_id: asset.ownerId,
    storage_key: originalPath,
    content_hash: asset.contentHash,
    width: asset.width,
    height: asset.height,
    size_bytes: asset.sizeBytes,
    created_at: asset.createdAt,
  };
  const { error: insertError } = await supabase.from('assets').insert(row);
  if (insertError) throw new Error(insertError.message);
}

export async function pullAsset(id: string): Promise<Asset | null> {
  const { data, error } = await getSupabaseClient().from('assets').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToAsset(data as AssetRow) : null;
}

async function downloadAsset(asset: Asset): Promise<{ originalBlob: Blob; thumbnailBlob: Blob }> {
  const supabase = getSupabaseClient();
  const thumbnailPath = `${asset.ownerId}/${asset.contentHash}.webp`;
  const [original, thumbnail] = await Promise.all([
    supabase.storage.from('originals').download(asset.storageKey),
    supabase.storage.from('thumbnails').download(thumbnailPath),
  ]);
  if (original.error) throw new Error(original.error.message);
  if (thumbnail.error) throw new Error(thumbnail.error.message);
  return { originalBlob: original.data, thumbnailBlob: thumbnail.data };
}

// The pull-side counterpart to syncAsset: opening a Reference whose asset
// was uploaded from a different device needs its image bytes downloaded
// before the working bitmap can be decoded. A no-op if the blobs are
// already cached locally (e.g. this device did the original upload).
export async function downloadAndCacheAsset(assetId: string): Promise<void> {
  const existing = await getAssetBlob(assetId, 'original');
  if (existing) return;

  const asset = await pullAsset(assetId);
  if (!asset) throw new Error(`Asset ${assetId} was not found remotely.`);

  const { originalBlob, thumbnailBlob } = await downloadAsset(asset);
  await applyRemoteAsset(asset, originalBlob, thumbnailBlob);
}

function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    storageKey: row.storage_key,
    contentHash: row.content_hash,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}
