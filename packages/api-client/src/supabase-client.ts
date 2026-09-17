import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

let client: SupabaseClient | null = null;

// Reads env vars but throws only when actually called — never at import time
// — so `pnpm build` in CI never needs real Supabase secrets (no page calls
// this during static generation in Phase 0).
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Copy apps/web/.env.example to apps/web/.env.local and fill in ' +
        'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return { url, anonKey };
}

// Public interface is our own types (SupabaseEnv, callers use the returned
// client only through this package's own functions like fetchSmokeRows), not
// a direct re-export of the raw Supabase client shape — keeps a future
// self-hosted-backend migration realistic (see docs/architecture/08).
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const { url, anonKey } = getSupabaseEnv();
  client = createClient(url, anonKey);
  return client;
}
