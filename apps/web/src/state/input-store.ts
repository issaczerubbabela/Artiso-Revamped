import { create } from 'zustand';

// How the canvas takes input on this device (GLOSSARY.md, "Input"): Pencil-only
// Drawing and Touch Lock. Both describe this device and this desk -- a Pencil
// belongs to the iPad, not to the reference -- so neither is ever synced.
//
// Pencil-only Drawing starts unset and switches on the first time a Pencil
// draws on the canvas; after that it is a remembered choice the artist can
// switch off (and back on) in the Draw panel. Someone who never uses a Pencil
// never leaves 'unset', so fingers keep drawing for them as they always did.
//
// Touch Lock freezes the view against bumps and a resting palm. It is a glance
// of the moment, like Show/hide grid, so it is not remembered across reloads.

const STORAGE_KEY = 'artiso.input.v1';

export type PencilOnlyDrawing = 'unset' | 'on' | 'off';

function read(): PencilOnlyDrawing {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'unset';
    const value = (JSON.parse(raw) as Record<string, unknown>).pencilOnly;
    return value === 'on' || value === 'off' ? value : 'unset';
  } catch {
    return 'unset';
  }
}

function write(pencilOnly: PencilOnlyDrawing): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({ pencilOnly }));
  } catch {
    // Unwritable storage just means the choice isn't remembered.
  }
}

interface InputState {
  pencilOnly: PencilOnlyDrawing;
  // The Draw panel's switch.
  setPencilOnly: (on: boolean) => void;
  // A Pencil started a stroke: switches Pencil-only Drawing on, unless the
  // artist has already decided either way.
  pencilDetected: () => void;

  touchLocked: boolean;
  setTouchLocked: (locked: boolean) => void;
}

export const useInputStore = create<InputState>((set, get) => ({
  pencilOnly: read(),
  setPencilOnly: (on) => {
    const pencilOnly = on ? 'on' : 'off';
    set({ pencilOnly });
    write(pencilOnly);
  },
  pencilDetected: () => {
    if (get().pencilOnly !== 'unset') return;
    set({ pencilOnly: 'on' });
    write('on');
  },
  touchLocked: false,
  setTouchLocked: (touchLocked) => set({ touchLocked }),
}));

export const isPencilOnly = (): boolean => useInputStore.getState().pencilOnly === 'on';
export const isTouchLocked = (): boolean => useInputStore.getState().touchLocked;
