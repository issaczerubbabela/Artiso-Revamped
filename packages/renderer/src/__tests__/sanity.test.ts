import { describe, expect, it } from 'vitest';
import { RENDERER_VERSION } from '../index';

describe('renderer package', () => {
  it('exposes a version string', () => {
    expect(typeof RENDERER_VERSION).toBe('string');
  });
});
