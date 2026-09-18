import { describe, expect, it } from 'vitest';
import { deterministicUuid, sha256Hex } from '../hash';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('sha256Hex', () => {
  it('matches a known SHA-256 vector for an empty buffer', async () => {
    const hash = await sha256Hex(new ArrayBuffer(0));
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('produces the same hash for identical content', async () => {
    const a = new TextEncoder().encode('artiso').buffer;
    const b = new TextEncoder().encode('artiso').buffer;
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });

  it('produces different hashes for different content', async () => {
    const a = new TextEncoder().encode('artiso-a').buffer;
    const b = new TextEncoder().encode('artiso-b').buffer;
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });
});

describe('deterministicUuid', () => {
  it('produces a validly-shaped UUID (version 4, correct variant nibble)', async () => {
    expect(await deterministicUuid('owner-1:hash-a')).toMatch(UUID_PATTERN);
  });

  it('is deterministic: the same input always produces the same id', async () => {
    const a = await deterministicUuid('owner-1:hash-a');
    const b = await deterministicUuid('owner-1:hash-a');
    expect(a).toBe(b);
  });

  it('produces different ids for different owners of the same content', async () => {
    const a = await deterministicUuid('owner-1:hash-a');
    const b = await deterministicUuid('owner-2:hash-a');
    expect(a).not.toBe(b);
  });

  it('produces different ids for different content from the same owner', async () => {
    const a = await deterministicUuid('owner-1:hash-a');
    const b = await deterministicUuid('owner-1:hash-b');
    expect(a).not.toBe(b);
  });
});
