import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseEnv } from '../supabase-client';

describe('getSupabaseEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a clear error when env vars are absent', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => getSupabaseEnv()).toThrow(/Missing Supabase env vars/);
  });

  it('returns the env vars when present', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(getSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });
});
