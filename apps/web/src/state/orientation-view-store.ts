import {
  LEGACY_VIEW_ROTATION_KEY,
  ORIENTATION_VIEWS_KEY,
  loadOrientationViews,
  rememberView,
  type OrientationViewMap,
  type RememberedView,
  type ViewOrientation,
} from '@artiso/renderer';

// Orientation memory (issue #10): landscape and portrait each remember their own
// zoom, pan and View Rotation (GLOSSARY.md) per reference, on this device only
// (docs/adr/0002-view-rotation-is-view-state.md). It describes how this device
// is being looked at -- an iPad turned on its stand frames the reference
// differently from a laptop -- so, like the other device-local display
// settings, it lives in localStorage. Never written to the EditStack, never
// synced, never exported. It replaces the single per-reference angle the app
// stored before; that angle is migrated into both slots on first read.
//
// Deliberately not a zustand store: the view changes every frame of a gesture,
// and nothing should re-render because of it. Writes land in memory at once and
// reach storage shortly after the view settles (or when the page is hidden).

const PERSIST_DELAY_MS = 400;

let cache: OrientationViewMap | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function load(): OrientationViewMap {
  if (cache) return cache;
  const store = storage();
  try {
    const { views, migrated } = loadOrientationViews(
      store?.getItem(ORIENTATION_VIEWS_KEY) ?? null,
      store?.getItem(LEGACY_VIEW_ROTATION_KEY) ?? null,
    );
    cache = views;
    if (migrated) {
      persistNow();
      store?.removeItem(LEGACY_VIEW_ROTATION_KEY);
    }
  } catch {
    // Unreadable storage: every reference starts fitted and square.
    cache = {};
  }
  return cache;
}

function persistNow(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = null;
  if (!cache) return;
  try {
    storage()?.setItem(ORIENTATION_VIEWS_KEY, JSON.stringify(cache));
  } catch {
    // Unwritable storage just means the view isn't remembered past this session.
  }
}

if (typeof window !== 'undefined') {
  // A page about to be hidden or closed may never run the delayed write.
  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow();
  });
}

// What this device last showed `referenceId` at in `orientation`, if anything.
export function readOrientationView(
  referenceId: string | null | undefined,
  orientation: ViewOrientation,
): RememberedView | undefined {
  if (!referenceId) return undefined;
  return load()[referenceId]?.[orientation];
}

export function writeOrientationView(
  referenceId: string | null | undefined,
  orientation: ViewOrientation,
  view: RememberedView,
): void {
  if (!referenceId) return;
  const current = load();
  const next = rememberView(current, referenceId, orientation, view);
  if (next === current) return;
  cache = next;
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, PERSIST_DELAY_MS);
}
