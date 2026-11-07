import { create } from 'zustand';
import {
  cellGridSize,
  cellKey,
  invalidatesDoneCells,
  nextCell,
  parseCellKey,
  type CellGrid,
  type CellLayout,
  type CellRef,
} from '@artiso/core-engine';
import { DEFAULT_CELL_FOCUS_DIM_PERCENT } from '@artiso/renderer';

// Cell Focus and Done Cells (GLOSSARY.md), remembered per reference on this
// device only. Like View Rotation they describe how *this* artist is working
// through *this* reference at this desk, so they sit with the other
// device-local display settings in localStorage: never synced, never in the
// EditStack, never exported. Each split-view pane shows a different reference
// (the same one can't be open twice), so "per reference" is also "per pane".

const STORAGE_KEY = 'artiso.cellFocus.v1';
// Oldest entries are dropped beyond this, so the map can't grow without bound.
const MAX_ENTRIES = 200;
export const CELL_FOCUS_DIM_MIN = 10;
export const CELL_FOCUS_DIM_MAX = 95;

export interface CellFocusEntry {
  // Whether Cell Focus is on for this reference.
  active: boolean;
  // The focused cell (kept while focus is off, so turning it back on resumes).
  cell: CellRef | null;
  // Done Cells, as core-engine cell keys.
  done: string[];
  // What the cells were counted on; a change that invalidates it clears them.
  layout: CellLayout | null;
}

interface Persisted {
  // How dark everything outside the focused cell is, in percent.
  dimPercent: number;
  // Whether ← → step over Done Cells.
  skipDone: boolean;
  references: Record<string, CellFocusEntry>;
}

// "Done Cells cleared" with an Undo, shown for a few seconds after a cell-size
// or paper change.
export interface DoneCellsNotice {
  id: number;
  referenceId: string;
  count: number;
  undo: (() => void) | null;
}

const EMPTY_ENTRY: CellFocusEntry = { active: false, cell: null, done: [], layout: null };

const DEFAULTS: Persisted = { dimPercent: DEFAULT_CELL_FOCUS_DIM_PERCENT, skipDone: false, references: {} };

export function gridOf(layout: CellLayout): CellGrid {
  return { paper: { widthMm: layout.widthMm, heightMm: layout.heightMm }, cellMm: layout.cellMm };
}

function clampDim(value: number): number {
  return Math.min(CELL_FOCUS_DIM_MAX, Math.max(CELL_FOCUS_DIM_MIN, Math.round(value)));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLayout(value: unknown): CellLayout | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!isFiniteNumber(v.widthMm) || !isFiniteNumber(v.heightMm) || !isFiniteNumber(v.cellMm) || !(v.cellMm > 0)) return null;
  const c = v.crop as Record<string, unknown> | null | undefined;
  const crop =
    c && isFiniteNumber(c.x) && isFiniteNumber(c.y) && isFiniteNumber(c.w) && isFiniteNumber(c.h)
      ? { x: c.x, y: c.y, w: c.w, h: c.h }
      : null;
  return { widthMm: v.widthMm, heightMm: v.heightMm, cellMm: v.cellMm, crop };
}

function parseEntry(value: unknown): CellFocusEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const cell = typeof v.cell === 'string' ? parseCellKey(v.cell) : null;
  const done = Array.isArray(v.done) ? v.done.filter((k): k is string => typeof k === 'string' && parseCellKey(k) !== null) : [];
  return { active: v.active === true && cell !== null, cell, done, layout: parseLayout(v.layout) };
}

// Every storage access is guarded: it throws in some private windows and with
// blocked site data, and doesn't exist during server prerendering.
function read(): Persisted {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const json = JSON.parse(raw) as Record<string, unknown>;
    const references: Record<string, CellFocusEntry> = {};
    if (json.references && typeof json.references === 'object') {
      for (const [id, value] of Object.entries(json.references as Record<string, unknown>)) {
        const entry = parseEntry(value);
        if (entry) references[id] = entry;
      }
    }
    return {
      dimPercent: isFiniteNumber(json.dimPercent) ? clampDim(json.dimPercent) : DEFAULTS.dimPercent,
      skipDone: json.skipDone === true,
      references,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(value: Persisted): void {
  const references: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(value.references)) {
    references[id] = { ...entry, cell: entry.cell ? cellKey(entry.cell) : null };
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dimPercent: value.dimPercent, skipDone: value.skipDone, references }));
    }
  } catch {
    // Unwritable storage just means progress isn't remembered.
  }
}

function clampCell(cell: CellRef | null, layout: CellLayout): CellRef | null {
  if (!cell) return null;
  const { cols, rows } = cellGridSize(gridOf(layout));
  return { col: Math.min(cell.col, cols - 1), row: Math.min(cell.row, rows - 1) };
}

interface CellFocusState extends Persisted {
  // Bumped whenever the focused cell should be brought into view; the pane
  // showing that reference pans to it.
  revealRequest: { referenceId: string; token: number } | null;
  notice: DoneCellsNotice | null;

  // Focuses `cell` (turning Cell Focus on). `reveal` pans to it if off screen.
  focusCell: (referenceId: string, layout: CellLayout, cell: CellRef, options?: { reveal?: boolean }) => void;
  // Turns Cell Focus on at the remembered cell, or at `fallback` if none.
  activate: (referenceId: string, layout: CellLayout, fallback: CellRef) => void;
  exit: (referenceId: string) => void;
  // ← / →: the previous or next cell in grid order, over Done Cells if skipping.
  step: (referenceId: string, layout: CellLayout, direction: 1 | -1) => void;
  // Marks or unmarks the focused cell as a Done Cell.
  toggleDone: (referenceId: string, layout: CellLayout) => void;
  setDimPercent: (percent: number) => void;
  setSkipDone: (skip: boolean) => void;
  // Brings a reference's cells in line with its current paper and cell size.
  // A change that moves the cells clears the Done Cells; with `announce` (the
  // change happened while the reference was open) a notice offers `revert`
  // to put the grid back, which also brings the Done Cells back.
  reconcile: (referenceId: string, layout: CellLayout, options?: { announce?: boolean; revert?: () => void }) => void;
  dismissNotice: (id: number) => void;
}

let noticeIds = 0;
let revealTokens = 0;
// Set by a notice's Undo: once the grid is back to this layout, this entry is
// restored instead of being cleared again.
let pendingRestore: { referenceId: string; entry: CellFocusEntry } | null = null;

export const useCellFocusStore = create<CellFocusState>((set, get) => {
  const persist = (patch: Partial<Persisted> & Partial<Pick<CellFocusState, 'revealRequest' | 'notice'>>) => {
    set(patch);
    const { dimPercent, skipDone, references } = get();
    write({ dimPercent, skipDone, references });
  };

  // This reference's entry, consistent with `layout` (a stale one is cleared).
  const entryFor = (referenceId: string, layout: CellLayout): CellFocusEntry => {
    const entry = get().references[referenceId] ?? EMPTY_ENTRY;
    if (entry.layout && invalidatesDoneCells(entry.layout, layout)) {
      return { ...entry, cell: clampCell(entry.cell, layout), done: [], layout };
    }
    return { ...entry, layout };
  };

  const putEntry = (referenceId: string, entry: CellFocusEntry, extra: Partial<Pick<CellFocusState, 'revealRequest' | 'notice'>> = {}) => {
    const references = { ...get().references };
    // Re-inserted at the end, so the map stays in least-recently-used order.
    delete references[referenceId];
    references[referenceId] = entry;
    const ids = Object.keys(references);
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_ENTRIES))) delete references[id];
    persist({ references, ...extra });
  };

  const reveal = (referenceId: string) => ({ revealRequest: { referenceId, token: ++revealTokens } });

  return {
    ...read(),
    revealRequest: null,
    notice: null,

    focusCell: (referenceId, layout, cell, options = {}) => {
      const entry = entryFor(referenceId, layout);
      putEntry(referenceId, { ...entry, active: true, cell }, options.reveal ? reveal(referenceId) : {});
    },

    activate: (referenceId, layout, fallback) => {
      const entry = entryFor(referenceId, layout);
      putEntry(referenceId, { ...entry, active: true, cell: entry.cell ?? fallback }, reveal(referenceId));
    },

    exit: (referenceId) => {
      const entry = get().references[referenceId];
      if (!entry?.active) return;
      putEntry(referenceId, { ...entry, active: false });
    },

    step: (referenceId, layout, direction) => {
      const entry = entryFor(referenceId, layout);
      if (!entry.active) return;
      const skip = get().skipDone ? new Set(entry.done) : undefined;
      const cell = nextCell(gridOf(layout), entry.cell, direction, { skip });
      if (!cell) return;
      putEntry(referenceId, { ...entry, cell }, reveal(referenceId));
    },

    toggleDone: (referenceId, layout) => {
      const entry = entryFor(referenceId, layout);
      if (!entry.active || !entry.cell) return;
      const key = cellKey(entry.cell);
      const done = entry.done.includes(key) ? entry.done.filter((k) => k !== key) : [...entry.done, key];
      putEntry(referenceId, { ...entry, done });
    },

    setDimPercent: (percent) => {
      if (Number.isFinite(percent)) persist({ dimPercent: clampDim(percent) });
    },
    setSkipDone: (skipDone) => persist({ skipDone }),

    reconcile: (referenceId, layout, options = {}) => {
      const entry = get().references[referenceId];
      if (!entry) return;
      if (!entry.layout) {
        putEntry(referenceId, { ...entry, layout });
        return;
      }
      if (!invalidatesDoneCells(entry.layout, layout)) return;

      const restore = pendingRestore;
      if (restore && restore.referenceId === referenceId && restore.entry.layout && !invalidatesDoneCells(restore.entry.layout, layout)) {
        pendingRestore = null;
        putEntry(referenceId, restore.entry, { notice: null });
        return;
      }
      pendingRestore = null;

      const cleared: CellFocusEntry = { ...entry, cell: clampCell(entry.cell, layout), done: [], layout };
      const announce = options.announce === true && entry.done.length > 0;
      const revert = options.revert;
      const notice: DoneCellsNotice | null = announce
        ? {
            id: ++noticeIds,
            referenceId,
            count: entry.done.length,
            undo: revert
              ? () => {
                  pendingRestore = { referenceId, entry };
                  set({ notice: null });
                  revert();
                }
              : null,
          }
        : get().notice;
      putEntry(referenceId, cleared, { notice });
    },

    dismissNotice: (id) => {
      if (get().notice?.id === id) set({ notice: null });
    },
  };
});

// The entry for a reference, for drawing and the controls.
export function cellFocusEntry(referenceId: string | null | undefined): CellFocusEntry | null {
  if (!referenceId) return null;
  return useCellFocusStore.getState().references[referenceId] ?? null;
}
