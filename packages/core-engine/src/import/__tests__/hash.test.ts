import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../hash';

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
