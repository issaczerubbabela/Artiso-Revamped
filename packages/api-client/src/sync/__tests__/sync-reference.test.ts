import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reference } from '@artiso/shared-types';

// What the server has stored for the reference after our upsert.
let stored: { version: number; updated_at: string };

vi.mock('../../supabase-client', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ single: async () => ({ data: stored, error: null }) }) }),
    }),
  }),
}));

const { syncReference } = await import('../reference');

const ID = '11111111-1111-4111-8111-111111111111';
const reference: Reference = {
  id: ID,
  projectId: ID,
  originalAssetId: ID,
  editStack: [],
  gridConfig: { type: 'ruleOfThirds', color: '#ffffff', opacity: 70, thickness: 'medium', visible: true },
  secondaryGridConfig: null,
  annotations: [],
  removedAnnotationIds: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.123Z',
  version: 2,
};

describe('syncReference', () => {
  beforeEach(() => {
    stored = { version: 2, updated_at: '2026-01-02T10:00:00.123+00:00' };
  });

  it('reports synced when the stored row is our write (Postgres formats the timestamp differently)', async () => {
    expect(await syncReference(reference)).toBe('synced');
  });

  it('reports stale when the stored version is newer', async () => {
    stored = { version: 5, updated_at: '2026-01-05T00:00:00.000+00:00' };
    expect(await syncReference(reference)).toBe('stale');
  });

  it('reports stale when someone else reached the same version first', async () => {
    // Two people edit from the same base: both reach version 2, the server
    // keeps the first write and drops ours. An equal version must not be
    // mistaken for "our write landed" -- found by the live two-account test.
    stored = { version: 2, updated_at: '2026-01-02T10:00:00.000+00:00' };
    expect(await syncReference(reference)).toBe('stale');
  });
});
