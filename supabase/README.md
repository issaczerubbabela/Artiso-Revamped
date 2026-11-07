# Supabase migrations

Manual step (no Supabase CLI wired up yet -- these are plain SQL files, run
by hand):

1. Open your project's dashboard -> SQL Editor -> New query.
2. Paste the contents of `migrations/0001_phase2_schema.sql` and run it.
   Safe to re-run; every statement is idempotent. Later phases add their
   columns to this same file (`add column if not exists`), so **re-run it after
   pulling a change that touches it** -- e.g. Phase 9 adds
   `"references".paper|crop|grid_settings` and `presets.grid_settings`, and
   Phase 12 (Drawing Check) adds the `check_photos` table and the private
   `check-photos` Storage bucket, both readable and writable only by the
   person who uploaded the photo.
3. (Optional cleanup) The Phase 0 smoke test table is no longer needed:
   ```sql
   drop table if exists smoke_test;
   ```

This creates `profiles`, `projects`, `assets`, `"references"`, and `presets`
with RLS policies scoping every row to its owner (or, for `"references"`,
to a project its owner owns), a trigger that creates a `profiles` row on
sign-up, and two private Storage buckets (`originals`, `thumbnails`) with
owner-scoped read/write policies. Sharing (Phase 8) adds `project_members`
and the member-aware policies; the Drawing Check (Phase 12) adds
`check_photos` and the `check-photos` bucket, private to the uploader (see
`docs/adr/0001-check-photos-synced-apart-from-the-reference.md`).
