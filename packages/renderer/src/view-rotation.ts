// Pure helpers for View Rotation (GLOSSARY.md) and for the gesture motion that
// follows a release. No DOM, no clock: the GestureEngine composes them.

const DEG = Math.PI / 180;
const QUARTER_TURN = Math.PI / 2;

// A two-finger twist has to turn this far before the view starts to turn, so a
// pinch never tilts the reference by accident. After that the angle follows
// the fingers 1:1.
export const ROTATION_DEAD_ZONE_RAD = 10 * DEG;

// On release the angle snaps to the nearest right angle when within this of
// it. There are no other snap angles, so fine angles near 45° stay reachable.
export const ROTATION_SNAP_RAD = 5 * DEG;

// The angle in (-π, π], with -0 turned into 0.
export function normalizeAngle(radians: number): number {
  if (!Number.isFinite(radians)) return 0;
  const turn = Math.PI * 2;
  let a = radians % turn;
  if (a <= -Math.PI) a += turn;
  else if (a > Math.PI) a -= turn;
  return a === 0 ? 0 : a;
}

// The angle a release settles on: the nearest of 0°, 90°, 180° and 270° when
// within ROTATION_SNAP_RAD of it, otherwise the angle itself -- always
// normalized to (-π, π].
export function snapViewRotation(radians: number): number {
  const angle = normalizeAngle(radians);
  const nearest = Math.round(angle / QUARTER_TURN) * QUARTER_TURN;
  if (Math.abs(angle - nearest) <= ROTATION_SNAP_RAD + 1e-12) return normalizeAngle(nearest);
  return angle;
}

// The angle as the zoom pill shows it: whole degrees in (-180, 180].
export function viewRotationDegrees(radians: number): number {
  const degrees = Math.round(normalizeAngle(radians) / DEG);
  return degrees === -180 ? 180 : degrees === 0 ? 0 : degrees;
}

// How far past a zoom limit a pinch may stretch, as a log ratio: the view can
// overshoot by at most ~30%, with more and more resistance the further it goes.
const RUBBER_BAND_LOG_LIMIT = Math.log(1.3);

// The scale shown while a pinch has gone past `limit` (the nearest scale the
// zoom limits allow): the raw finger scale with resistance, approaching but
// never exceeding the overshoot limit. Within the limits it is `raw` itself.
export function rubberBandScale(raw: number, limit: number): number {
  if (!(raw > 0) || !(limit > 0)) return limit;
  if (raw === limit) return raw;
  const excess = Math.log(raw / limit);
  const c = RUBBER_BAND_LOG_LIMIT;
  const damped = Math.sign(excess) * c * (1 - 1 / (1 + Math.abs(excess) / c));
  return limit * Math.exp(damped);
}
