import { create } from 'zustand';
import type { CheckPhoto, PhotoPoint } from '@artiso/shared-types';

// A Check Photo ready to draw: the record and the photo straightened to the
// paper (core-engine's warpPerspective), drawn over the paper rectangle.
export interface ShownCheckPhoto {
  photo: CheckPhoto;
  straightened: HTMLCanvasElement;
}

// Corner placement in progress. `isNew` is a just-taken photo that is only
// saved once its corners are placed (cancelling keeps the previous one);
// otherwise the existing photo's corners are being adjusted.
export interface CheckAlignment {
  referenceId: string;
  bitmap: ImageBitmap;
  corners: PhotoPoint[];
  isNew: boolean;
  // Only for a new photo: the image to save, already at working resolution.
  blob: Blob | null;
}

interface CheckPhotoState {
  // Per reference, so each pane of a split view shows its own reference's photo.
  byReference: Record<string, ShownCheckPhoto>;
  // The Drawing Check's comparison controls: view state only, never saved on
  // the reference (GLOSSARY.md, Drawing Check).
  opacity: number;
  holding: boolean;
  alignment: CheckAlignment | null;
  busy: boolean;
  error: string | null;
  setOpacity: (opacity: number) => void;
  setHolding: (holding: boolean) => void;
  setShown: (referenceId: string, shown: ShownCheckPhoto | null) => void;
  setAlignment: (alignment: CheckAlignment | null) => void;
  setAlignmentCorners: (corners: PhotoPoint[]) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

export const DEFAULT_CHECK_OPACITY = 0.5;

export const useCheckPhotoStore = create<CheckPhotoState>((set, get) => ({
  byReference: {},
  opacity: DEFAULT_CHECK_OPACITY,
  holding: false,
  alignment: null,
  busy: false,
  error: null,
  setOpacity: (opacity) => set({ opacity }),
  setHolding: (holding) => set({ holding }),
  setShown: (referenceId, shown) => {
    const next = { ...get().byReference };
    if (shown) next[referenceId] = shown;
    else delete next[referenceId];
    set({ byReference: next });
  },
  setAlignment: (alignment) => {
    const previous = get().alignment;
    if (previous && previous.bitmap !== alignment?.bitmap) previous.bitmap.close();
    set({ alignment });
  },
  setAlignmentCorners: (corners) => {
    const alignment = get().alignment;
    if (alignment) set({ alignment: { ...alignment, corners } });
  },
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
}));
