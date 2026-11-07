import { normalizeAngle } from '@artiso/renderer';

// View Rotation (GLOSSARY.md), remembered per reference on this device only
// (docs/adr/0001-view-rotation-is-view-state.md). It describes how this
// device's screen is turned relative to the artist's paper -- an iPad on a
// stand and a laptop are turned differently -- so, like the other device-local
// display settings, it lives in localStorage. It is never written to the
// EditStack, never synced and never exported.
//
// Deliberately not a zustand store: the angle changes every frame of a twist,
// and nothing should re-render or re-clamp the view because of it.

const STORAGE_KEY = 'artiso.viewRotation.v1';
// Oldest entries are dropped beyond this, so the map can't grow without bound.
const MAX_ENTRIES = 200;

type Angles = Record<string, number>;

let cache: Angles | null = null;

function load(): Angles {
  if (cache) return cache;
  cache = {};
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const json = JSON.parse(raw) as unknown;
      if (json && typeof json === 'object') {
        for (const [id, value] of Object.entries(json as Record<string, unknown>)) {
          if (typeof value === 'number' && Number.isFinite(value)) cache[id] = normalizeAngle(value);
        }
      }
    }
  } catch {
    // Unreadable storage: every reference starts square.
  }
  return cache;
}

// The angle (radians) this device last showed `referenceId` at; 0 if none.
export function readViewRotation(referenceId: string | null | undefined): number {
  if (!referenceId) return 0;
  return load()[referenceId] ?? 0;
}

export function writeViewRotation(referenceId: string | null | undefined, radians: number): void {
  if (!referenceId) return;
  const angles = load();
  const angle = normalizeAngle(radians);
  if ((angles[referenceId] ?? 0) === angle) return;
  // Re-inserted at the end, so the map stays in least-recently-turned order.
  delete angles[referenceId];
  if (angle !== 0) angles[referenceId] = angle;
  const ids = Object.keys(angles);
  for (const id of ids.slice(0, Math.max(0, ids.length - MAX_ENTRIES))) delete angles[id];
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(angles));
  } catch {
    // Unwritable storage just means the angle isn't remembered.
  }
}
