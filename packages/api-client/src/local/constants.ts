// Sentinel owner id for the signed-out, local-only state (docs/architecture/08:
// "signed-out users get local-only Projects... no account wall on launch").
// A valid UUID (rather than a plain string) so these rows still satisfy
// shared-types' Zod schemas if ever validated, and can be swapped for the
// real authenticated user id once Phase 2 adds sign-in.
export const LOCAL_OWNER_ID = '00000000-0000-0000-0000-000000000000';
