// docs/architecture/01-image-import.md: v1 format allow-list. HEIC support is
// an open question, deliberately not included yet.
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

// Default working-bitmap cap (long edge, px). Configurable via Performance
// Mode later; flagged in the architecture doc as needing validation against
// mid-range Android WebGL limits.
export const DEFAULT_WORKING_LONG_EDGE = 2048;

export const THUMBNAIL_LONG_EDGE = 256;

// Hard cap checked before attempting to hold a decoded bitmap at all --
// guards the "out-of-memory / huge image" failure case in the architecture
// doc's failure-case table.
export const MAX_SOURCE_DIMENSION_PX = 12000;
