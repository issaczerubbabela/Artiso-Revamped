import { z } from 'zod';
import { getSupabaseClient } from './supabase-client';

// Phase 0 only: proves the api-client -> Supabase wiring end-to-end against a
// single throwaway table. Removed once real Project/Reference sync (Phase 2,
// docs/architecture/08-project-sync-backend.md) lands.
const SmokeRowSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  created_at: z.string(),
});
export type SmokeRow = z.infer<typeof SmokeRowSchema>;

export async function fetchSmokeRows(): Promise<SmokeRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('smoke_test').select('*');
  if (error) throw new Error(`smoke_test query failed: ${error.message}`);
  return z.array(SmokeRowSchema).parse(data);
}
