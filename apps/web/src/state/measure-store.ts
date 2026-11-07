import { create } from 'zustand';
import { useWorkspaceStore } from './workspace-store';

// The Measurement on screen (GLOSSARY.md): transient UI state of the Draw
// panel's Measure tool. One at a time -- the next measure replaces it -- and it
// is never persisted, synced or exported: it lives only in memory.

export interface ActiveMeasurement {
  referenceId: string | null;
  // The line's ends, in paper mm.
  start: { x: number; y: number };
  end: { x: number; y: number };
  // Held at the end: the line is snapped onto the paper's horizontal or vertical.
  snapped: boolean;
}

interface MeasureState {
  measurement: ActiveMeasurement | null;
  setMeasurement: (measurement: ActiveMeasurement | null) => void;
}

export const useMeasureStore = create<MeasureState>((set) => ({
  measurement: null,
  setMeasurement: (measurement) => set({ measurement }),
}));

// Putting Measure down -- another Draw tool, closing Draw, another reference --
// takes the Measurement with it, so measuring never leaves anything behind.
useWorkspaceStore.subscribe((state) => {
  const { measurement } = useMeasureStore.getState();
  if (!measurement) return;
  if (state.toolMode !== 'annotate' || state.annotationTool !== 'measure' || state.referenceId !== measurement.referenceId) {
    useMeasureStore.getState().setMeasurement(null);
  }
});
