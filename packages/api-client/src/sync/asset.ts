import type { Asset } from '@artiso/shared-types';
import { getSupabaseClient } from '../supabase-client';
import { extensionForMimeType } from './mime';
import type { AssetRow } from './row-types';

// Uploads assets before metadata, and dedupes by content hash
// (docs/architecture/08 -- re-importing an already-uploaded image shouldn't
// re-upload the binary). Checks the remote `assets` table rather than
// trusting the local one, since another device may have already uploaded
// the same content hash for this owner.
export async function syncAsset(asset: Asset, originalBlob: Blob, thumbnailBlob: Blob): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: existing, error: lookupError } = await supabase
    .from('assets')
    .select('id')
    .eq('owner_id', asset.ownerId)
    .eq('content_hash', asset.contentHash)
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
