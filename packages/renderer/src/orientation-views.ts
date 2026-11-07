import { normalizeAngle } from './view-rotation';

// Orientation memory (issue #10): landscape and portrait each remember their own
// zoom, pan and View Rotation per reference, on this device only. Like View
// Rotation itself (docs/adr/0002-view-rotation-is-view-state.md) this is view
// state: never an edit, never synced, never exported.
//
// Pure: the app keeps the map in localStorage; this module parses, migrates and
// updates it.

export type ViewOrientation = 'landscape' | 'portrait';

// Landscape when the viewport is wider than tall.
export function viewOrientation(width: number, height: number): ViewOrientation {
  return width > height ? 'landscape' : 'portrait';
}

// One orientation's view. `scale` with `centerX`/`centerY` (the content point at
// the centre of the visible region) is a zoomed-in view; without them the view
// fits the reference at `rotation`. Storing the centre rather than the raw
// translation keeps it right when the chrome or window size differs a little.
export interface RememberedView {
  rotation: number;
  scale?: number;
  centerX?: number;
  centerY?: number;
}

export interface OrientationViews {
  landscape?: RememberedView;
  portrait?: RememberedView;
}

export type OrientationViewMap = Record<string, OrientationViews>;

export const ORIENTATION_VIEWS_KEY = 'artiso.orientationViews.v1';
// What the app stored before: one angle (radians) per reference id.
export const LEGACY_VIEW_ROTATION_KEY = 'artiso.viewRotation.v1';
// Oldest references are dropped beyond this, so the map can't grow without bound.
export const MAX_REMEMBERED_REFERENCES = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseView(value: unknown): RememberedView | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.rotation)) return undefined;
  const view: RememberedView = { rotation: normalizeAngle(value.rotation) };
  if (isFiniteNumber(value.scale) && value.scale > 0 && isFiniteNumber(value.centerX) && isFiniteNumber(value.centerY)) {
    view.scale = value.scale;
    view.centerX = value.centerX;
    view.centerY = value.centerY;
  }
  return view;
}

// The stored map, with anything malformed dropped.
export function parseOrientationViews(json: unknown): OrientationViewMap {
  const views: OrientationViewMap = {};
  if (!isRecord(json)) return views;
  for (const [id, entry] of Object.entries(json)) {
    if (!isRecord(entry)) continue;
    const slots: OrientationViews = {};
    const landscape = parseView(entry.landscape);
    const portrait = parseView(entry.portrait);
    if (landscape) slots.landscape = landscape;
    if (portrait) slots.portrait = portrait;
    if (slots.landscape || slots.portrait) views[id] = slots;
  }
  return views;
}

// The single per-reference angle the app stored before, copied into both slots
// as an angle only, so each orientation fits the reference at it.
export function migrateViewRotations(json: unknown): OrientationViewMap {
  const views: OrientationViewMap = {};
  if (!isRecord(json)) return views;
  for (const [id, angle] of Object.entries(json)) {
    if (!isFiniteNumber(angle)) continue;
    const rotation = normalizeAngle(angle);
    views[id] = { landscape: { rotation }, portrait: { rotation } };
  }
  return views;
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

// Reads the stored map from its raw storage strings. The legacy angles are
// migrated only while the new form has never been written (`migrated` says so,
// and the caller then saves the result in the new form).
export function loadOrientationViews(
  rawViews: string | null,
  rawLegacy: string | null,
): { views: OrientationViewMap; migrated: boolean } {
  if (rawViews !== null) return { views: parseOrientationViews(parseJson(rawViews)), migrated: false };
  const legacy = parseJson(rawLegacy);
  if (legacy === undefined) return { views: {}, migrated: false };
  return { views: migrateViewRotations(legacy), migrated: true };
}

function sameView(a: RememberedView | undefined, b: RememberedView): boolean {
  return (
    a !== undefined && a.rotation === b.rotation && a.scale === b.scale && a.centerX === b.centerX && a.centerY === b.centerY
  );
}

// `views` with `referenceId`'s `orientation` slot set to `view`. The reference
// moves to the end, so the map stays in least-recently-used order and the
// oldest are dropped past `maxEntries`. Returns `views` itself when nothing
// changed, so callers can skip writing.
export function rememberView(
  views: OrientationViewMap,
  referenceId: string,
  orientation: ViewOrientation,
  view: RememberedView,
  maxEntries: number = MAX_REMEMBERED_REFERENCES,
): OrientationViewMap {
  const entry = views[referenceId];
  if (sameView(entry?.[orientation], view)) return views;
  const next: OrientationViewMap = {};
  for (const [id, slots] of Object.entries(views)) if (id !== referenceId) next[id] = slots;
  next[referenceId] = { ...entry, [orientation]: { ...view } };
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - maxEntries))) delete next[id];
  return next;
}
