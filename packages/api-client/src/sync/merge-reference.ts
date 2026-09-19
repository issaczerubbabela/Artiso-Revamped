import type { Annotation, Operation, Reference } from '@artiso/shared-types';

// Collaborative merge (docs/phases/phase-8-collaboration-split-view.md).
//
// Two people edited the same Reference from a common starting point ("base",
// the last copy this device synced) and each has since produced their own
// version. Whole-reference last-write-wins would silently throw away one
// person's work, so this merges by field group instead:
//
//   - annotations: unioned by id, so two people's additions both survive,
//     minus anything either side deleted (removedAnnotationIds tombstones --
//     without them a union would resurrect a deletion from the other side).
//   - every other group (geometry ops, adjustments/filters, primary grid,
//     layered grid, framing = paper + crop together, grid settings, notes):
//     three-way against base. If only one side changed
//     a group, that side's change wins; if both changed it, the more
//     recently updated side wins (last-write-wins, scoped to that group
//     instead of the whole reference).
//
// Pure -- no IO, no clock beyond the timestamp on the result -- so the
// rules above are directly unit-testable.
export function mergeReferences(base: Reference | null, local: Reference, remote: Reference): Reference {
  const localIsNewer = local.updatedAt >= remote.updatedAt;

  function pick<T>(baseValue: T | undefined, localValue: T, remoteValue: T): T {
    if (deepEqual(localValue, remoteValue)) return localValue;
    if (base) {
      if (deepEqual(localValue, baseValue)) return remoteValue;
      if (deepEqual(remoteValue, baseValue)) return localValue;
    }
    return localIsNewer ? localValue : remoteValue;
  }

  // editStack mixes two independent concerns: geometry (crop/rotate/flip)
  // and tonal edits (adjustments/filters). One person cropping while another
  // brightens shouldn't conflict, so they merge as separate groups. Replay
  // order between the two doesn't matter -- the pipeline is fixed
  // (geometry, then adjustments, then filters) regardless of array order.
  const [baseGeometry, baseTonal] = base ? splitEditStack(base.editStack) : [undefined, undefined];
  const [localGeometry, localTonal] = splitEditStack(local.editStack);
  const [remoteGeometry, remoteTonal] = splitEditStack(remote.editStack);
  const editStack = [
    ...pick(baseGeometry, localGeometry, remoteGeometry),
    ...pick(baseTonal, localTonal, remoteTonal),
  ];

  // paper and crop are one group: a crop is only valid for the paper aspect it
  // was made against, so merging them separately could pair one person's
  // portrait paper with the other's landscape crop.
  const framing = pick(
    base ? { paper: base.paper, crop: base.crop } : undefined,
    { paper: local.paper, crop: local.crop },
    { paper: remote.paper, crop: remote.crop },
  );

  const removedAnnotationIds = [...new Set([...remote.removedAnnotationIds, ...local.removedAnnotationIds])];

  return {
    id: remote.id,
    projectId: remote.projectId,
    originalAssetId: remote.originalAssetId,
    editStack,
    gridConfig: pick(base?.gridConfig, local.gridConfig, remote.gridConfig),
    secondaryGridConfig: pick(base?.secondaryGridConfig, local.secondaryGridConfig, remote.secondaryGridConfig),
    paper: framing.paper,
    crop: framing.crop,
    gridSettings: pick(base?.gridSettings, local.gridSettings, remote.gridSettings),
    annotations: mergeAnnotations(local.annotations, remote.annotations, new Set(removedAnnotationIds)),
    removedAnnotationIds,
    notes: pick(base?.notes, local.notes, remote.notes),
    createdAt: remote.createdAt,
    updatedAt: new Date().toISOString(),
    // Strictly above both inputs so the server's version guard accepts it.
    version: Math.max(local.version, remote.version) + 1,
  };
}

function mergeAnnotations(local: Annotation[], remote: Annotation[], removed: Set<string>): Annotation[] {
  // Remote's copy wins for an id both sides have -- annotations are
  // immutable once drawn, so the two copies are identical anyway. Remote
  // order first, then this side's additions, so newly drawn ones stack on top.
  const byId = new Map<string, Annotation>();
  for (const annotation of remote) byId.set(annotation.id, annotation);
  for (const annotation of local) if (!byId.has(annotation.id)) byId.set(annotation.id, annotation);
  return [...byId.values()].filter((annotation) => !removed.has(annotation.id));
}

function splitEditStack(editStack: Operation[]): [Operation[], Operation[]] {
  const geometry: Operation[] = [];
  const tonal: Operation[] = [];
  for (const op of editStack) {
    if (op.type === 'crop' || op.type === 'rotate' || op.type === 'flip') geometry.push(op);
    else tonal.push(op);
  }
  return [geometry, tonal];
}

// Order-insensitive on object keys: a value round-tripped through Postgres
// jsonb comes back with its keys reordered, so comparing JSON.stringify
// output would report false differences. Arrays stay order-sensitive.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  return aKeys.length === bKeys.length && aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]));
}
