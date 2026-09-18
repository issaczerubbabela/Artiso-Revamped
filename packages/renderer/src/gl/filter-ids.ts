import type { FilterId } from '@artiso/shared-types';

// Maps each FilterId to the integer the fragment shader's u_filterId branches
// on (0 = none/no active filter). The filter set is fixed and known at build
// time (docs/architecture/03's Stage 6 reference list), so every filter is a
// branch in one shader rather than a dynamically composed chain -- switching
// the active filter is a uniform update, never a recompile, which is
// actually stricter than the "recompile only on structural change"
// architecture calls for: this compiles once and never recompiles again.
export const FILTER_ID_TO_INT: Record<FilterId, number> = {
  grayscale: 1,
  highContrast: 2,
  lowContrast: 3,
  threshold: 4,
  posterize: 5,
  pencilSketch: 6,
  edgeDetect: 7,
  invert: 8,
  blur: 9,
  sharpen: 10,
};
