import { describe, expect, it } from 'vitest';
import { toAuthUser } from '../auth';

describe('toAuthUser', () => {
  it('maps id and email straight through', () => {
    expect(toAuthUser({ id: 'user-1', email: 'artist@example.com' })).toEqual({
      id: 'user-1',
      email: 'artist@example.com',
    });
  });

  it('defaults email to an empty string when absent', () => {
    expect(toAuthUser({ id: 'user-1', email: undefined })).toEqual({ id: 'user-1', email: '' });
  });
});
