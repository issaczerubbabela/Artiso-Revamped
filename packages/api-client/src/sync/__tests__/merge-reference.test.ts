import { describe, expect, it } from 'vitest';
import type { Annotation, Reference } from '@artiso/shared-types';
import { deepEqual, mergeReferences } from '../merge-reference';

const ID = '11111111-1111-4111-8111-111111111111';
const ann = (n: number): Annotation => ({
  type: 'arrow',
  id: `00000000-0000-4000-8000-00000000000${n}`,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
  color: '#ff0000',
  thickness: 'medium',
});

function reference(overrides: Partial<Reference> = {}): Reference {
  return {
    id: ID,
    projectId: ID,
    originalAssetId: ID,
    editStack: [],
    gridConfig: { type: 'rectangular', rows: 8, cols: 8, color: '#ffffff', opacity: 70, thickness: 'medium', numberingMode: 'off', visible: true, snapToImage: true },
    secondaryGridConfig: null,
    paper: null,
    crop: null,
    gridSettings: null,
    annotations: [],
    removedAnnotationIds: [],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

const OLDER = '2026-01-02T00:00:00.000Z';
const NEWER = '2026-01-03T00:00:00.000Z';

describe('mergeReferences', () => {
  it('keeps a change only one side made (three-way against base)', () => {
    const base = reference();
    const local = reference({ editStack: [{ type: 'brightness', value: 20 }], updatedAt: OLDER });
    const remote = reference({ gridConfig: { ...base.gridConfig, rows: 12 } as Reference['gridConfig'], updatedAt: NEWER });
    const merged = mergeReferences(base, local, remote);
    expect(merged.editStack).toEqual([{ type: 'brightness', value: 20 }]);
    expect((merged.gridConfig as { rows: number }).rows).toBe(12);
  });

  it('resolves a group both sides changed by last-write-wins, in either direction', () => {
    const base = reference();
    const localGrid = { ...base.gridConfig, rows: 4 } as Reference['gridConfig'];
    const remoteGrid = { ...base.gridConfig, rows: 10 } as Reference['gridConfig'];
    const localNewer = mergeReferences(base, reference({ gridConfig: localGrid, updatedAt: NEWER }), reference({ gridConfig: remoteGrid, updatedAt: OLDER }));
    const remoteNewer = mergeReferences(base, reference({ gridConfig: localGrid, updatedAt: OLDER }), reference({ gridConfig: remoteGrid, updatedAt: NEWER }));
    expect((localNewer.gridConfig as { rows: number }).rows).toBe(4);
    expect((remoteNewer.gridConfig as { rows: number }).rows).toBe(10);
  });

  it('falls back to last-write-wins when there is no base to compare against', () => {
    const local = reference({ notes: 'mine', updatedAt: OLDER });
    const remote = reference({ notes: 'theirs', updatedAt: NEWER });
    expect(mergeReferences(null, local, remote).notes).toBe('theirs');
  });

  it('merges geometry and tonal edits as independent groups', () => {
    const base = reference();
    const local = reference({ editStack: [{ type: 'rotate', degrees: 90 }], updatedAt: OLDER });
    const remote = reference({ editStack: [{ type: 'brightness', value: 30 }], updatedAt: NEWER });
    const merged = mergeReferences(base, local, remote);
    expect(merged.editStack).toEqual(expect.arrayContaining([{ type: 'rotate', degrees: 90 }, { type: 'brightness', value: 30 }]));
    expect(merged.editStack).toHaveLength(2);
  });

  it('unions annotations so both people\'s additions survive', () => {
    const base = reference({ annotations: [ann(1)] });
    const local = reference({ annotations: [ann(1), ann(2)], updatedAt: OLDER });
    const remote = reference({ annotations: [ann(1), ann(3)], updatedAt: NEWER });
    const ids = mergeReferences(base, local, remote).annotations.map((a) => a.id);
    expect(ids).toEqual([ann(1).id, ann(3).id, ann(2).id]);
  });

  it('does not resurrect an annotation the other side deleted', () => {
    const base = reference({ annotations: [ann(1), ann(2)] });
    // Remote deleted #2 (tombstoned); local still has it and added #3.
    const local = reference({ annotations: [ann(1), ann(2), ann(3)], updatedAt: OLDER });
    const remote = reference({ annotations: [ann(1)], removedAnnotationIds: [ann(2).id], updatedAt: NEWER });
    const merged = mergeReferences(base, local, remote);
    expect(merged.annotations.map((a) => a.id)).toEqual([ann(1).id, ann(3).id]);
    expect(merged.removedAnnotationIds).toEqual([ann(2).id]);
  });

  it('carries a local deletion through a merge as well', () => {
    const base = reference({ annotations: [ann(1), ann(2)] });
    const local = reference({ annotations: [ann(1)], removedAnnotationIds: [ann(2).id], updatedAt: NEWER });
    const remote = reference({ annotations: [ann(1), ann(2)], updatedAt: OLDER });
    expect(mergeReferences(base, local, remote).annotations.map((a) => a.id)).toEqual([ann(1).id]);
  });

  it('produces a version above both inputs so the server accepts it', () => {
    const merged = mergeReferences(null, reference({ version: 7 }), reference({ version: 4 }));
    expect(merged.version).toBe(8);
  });

  it('takes identity fields from the remote copy', () => {
    const remote = reference({ createdAt: '2025-06-01T00:00:00.000Z' });
    expect(mergeReferences(null, reference(), remote).createdAt).toBe('2025-06-01T00:00:00.000Z');
  });
});

describe('deepEqual', () => {
  it('ignores object key order (jsonb reorders keys)', () => {
    expect(deepEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
  });
  it('is order-sensitive for arrays and detects differences', () => {
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
