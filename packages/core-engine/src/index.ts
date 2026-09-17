// Pure TS image pipeline, grid engine, geometry and filters live here in later
// phases. No DOM/React/Capacitor imports are allowed in this package — it must
// stay headlessly testable and able to run inside a Web Worker (see
// docs/architecture/00-system-overview.md §5 and ki-grid-image-independence).
export const CORE_ENGINE_VERSION = '0.0.0';
