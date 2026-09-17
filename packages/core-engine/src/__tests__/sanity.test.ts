import { describe, expect, it } from 'vitest';
import { CORE_ENGINE_VERSION } from '../index';

// Real purpose of this test in Phase 0: prove Vitest runs this package
// headlessly, with zero DOM, before any real engine code lands in Phase 1.
describe('core-engine package', () => {
  it('exposes a version string', () => {
    expect(typeof CORE_ENGINE_VERSION).toBe('string');
  });
});
