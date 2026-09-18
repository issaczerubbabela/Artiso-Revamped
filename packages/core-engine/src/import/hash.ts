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

// Derives a deterministic, validly-UUID-shaped string from arbitrary input
// (not a real random v4 -- version/variant nibbles are just set to satisfy
// UUID format validators). Used so an Asset's id is content-addressable:
// the same (ownerId, contentHash) pair always produces the same id
// everywhere, so two devices that independently import the same photo -- or
// one device re-importing after local storage was cleared -- converge on
// the same asset instead of diverging into two rows that reference each
// other's content but not each other's id (see docs/architecture/08's
// dedupe-by-content-hash rule, which only works if "the same content" also
// means "the same id").
export async function deterministicUuid(input: string): Promise<string> {
  const hex = await sha256Hex(new TextEncoder().encode(input).buffer);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    // hex is always 64 chars (a SHA-256 digest), so index 16 always exists.
    `${((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
