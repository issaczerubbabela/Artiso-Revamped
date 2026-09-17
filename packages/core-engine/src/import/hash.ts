// Content-hash for asset dedupe (docs/architecture/08-project-sync-backend.md:
// storageKey is `originals/{userId}/{contentHash}.{ext}`). Uses the Web
// Crypto API, which is a global in both browsers/workers and Node 20+, so
// this is genuinely headless-testable.
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
