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

  describe('paper, crop and grid settings', () => {
    const A4_PORTRAIT = { preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 } as const;
    const A4_LANDSCAPE = { preset: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 } as const;
    const PORTRAIT_CROP = { x: 0, y: 0, w: 2100, h: 2970 };
    const LANDSCAPE_CROP = { x: 0, y: 0, w: 2970, h: 2100 };
    const settings = (cellMm: number): NonNullable<Reference['gridSettings']> => ({
      cellMm,
      showSquares: true,
      showDiagonals: false,
      showRadial: false,
      radialStepDeg: 15,
      labels: { enabled: true, columns: 'letters', rows: 'numbers' },
      style: { color: '#ffffff', widthPx: 1, opacity: 0.7 },
      marginMm: 0,
    });
    const framed = reference({ paper: A4_PORTRAIT, crop: PORTRAIT_CROP, gridSettings: settings(25) });

    it('keeps a framing change only one side made', () => {
      const local = reference({ ...framed, crop: { ...PORTRAIT_CROP, x: 40 }, updatedAt: OLDER });
      const remote = reference({ ...framed, updatedAt: NEWER });
      const merged = mergeReferences(framed, local, remote);
      expect(merged.crop).toEqual({ ...PORTRAIT_CROP, x: 40 });
      expect(merged.paper).toEqual(A4_PORTRAIT);
    });

    it('never pairs one side\'s paper with the other side\'s crop', () => {
      // Local turns the paper landscape (and re-crops to match); remote only
      // nudges the portrait crop. Taken field by field that would pair a
      // landscape paper with a portrait crop.
      const local = reference({ ...framed, paper: A4_LANDSCAPE, crop: LANDSCAPE_CROP });
      const remote = reference({ ...framed, crop: { ...PORTRAIT_CROP, y: 30 } });

      const localNewer = mergeReferences(framed, { ...local, updatedAt: NEWER }, { ...remote, updatedAt: OLDER });
      expect(localNewer.paper).toEqual(A4_LANDSCAPE);
      expect(localNewer.crop).toEqual(LANDSCAPE_CROP);

      const remoteNewer = mergeReferences(framed, { ...local, updatedAt: OLDER }, { ...remote, updatedAt: NEWER });
      expect(remoteNewer.paper).toEqual(A4_PORTRAIT);
      expect(remoteNewer.crop).toEqual({ ...PORTRAIT_CROP, y: 30 });
    });

    it('merges grid settings independently of the framing', () => {
      const local = reference({ ...framed, gridSettings: settings(40), updatedAt: OLDER });
      const remote = reference({ ...framed, crop: { ...PORTRAIT_CROP, x: 12 }, updatedAt: NEWER });
      const merged = mergeReferences(framed, local, remote);
      expect(merged.gridSettings?.cellMm).toBe(40);
      expect(merged.crop).toEqual({ ...PORTRAIT_CROP, x: 12 });
    });

    it('keeps a legacy reference\'s migration when the other side has not migrated it yet', () => {
      // Both started from an unmigrated copy; only this device opened it.
      const base = reference();
      const local = reference({ paper: A4_PORTRAIT, crop: PORTRAIT_CROP, gridSettings: settings(25), updatedAt: OLDER });
      const remote = reference({ notes: 'edited elsewhere', updatedAt: NEWER });
      const merged = mergeReferences(base, local, remote);
      expect(merged.paper).toEqual(A4_PORTRAIT);
      expect(merged.crop).toEqual(PORTRAIT_CROP);
      expect(merged.gridSettings).toEqual(settings(25));
      expect(merged.notes).toBe('edited elsewhere');
    });

    it('stays null when neither side has migrated', () => {
      const merged = mergeReferences(reference(), reference(), reference());
      expect(merged.paper).toBeNull();
      expect(merged.crop).toBeNull();
      expect(merged.gridSettings).toBeNull();
    });
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
