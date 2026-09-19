# Supabase migrations

Manual step (no Supabase CLI wired up yet -- these are plain SQL files, run
by hand):

1. Open your project's dashboard -> SQL Editor -> New query.
2. Paste the contents of `migrations/0001_phase2_schema.sql` and run it.
   Safe to re-run; every statement is idempotent. Later phases add their
   columns to this same file (`add column if not exists`), so **re-run it after
   pulling a change that touches it** -- e.g. Phase 9 adds
   `"references".paper|crop|grid_settings` and `presets.grid_settings`.
3. (Optional cleanup) The Phase 0 smoke test table is no longer needed:
   ```sql
   drop table if exists smoke_test;
   ```

This creates `profiles`, `projects`, `assets`, `"references"`, and `presets`
with RLS policies scoping every row to its owner (or, for `"references"`,
to a project its owner owns), a trigger that creates a `profiles` row on
sign-up, and two private Storage buckets (`originals`, `thumbnails`) with
owner-scoped read/write policies.
