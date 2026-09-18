import { create } from 'zustand';
import { applyGeometryOps } from '@artiso/core-engine';
import type { ExportSettings, FilterId, GridConfig, Operation } from '@artiso/shared-types';
import { scheduleReferenceSync, updateReference } from '@artiso/api-client';
import { useAuthStore } from './auth-store';
import { DEFAULT_GRID_CONFIG } from './default-grid-config';
import { DEFAULT_EXPORT_SETTINGS } from './default-export-settings';

export type ToolMode = 'idle' | 'crop' | 'rotateFlip' | 'adjustments' | 'filters' | 'grid' | 'export' | 'presets';

interface LoadedReference {
  projectId: string;
  referenceId: string;
  assetId: string;
  workingBitmap: ImageBitmap;
  workingWidth: number;
  workingHeight: number;
  editStack: Operation[];
  gridConfig: GridConfig;
}

interface WorkspaceState {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  isImporting: boolean;
  importError: string | null;
  setImporting: (isImporting: boolean) => void;
  setImportError: (message: string | null) => void;

  projectId: string | null;
  referenceId: string | null;
  assetId: string | null;
  workingBitmap: ImageBitmap | null;
  workingWidth: number;
  workingHeight: number;
  editStack: Operation[];
  gridConfig: GridConfig;

  // Transient, per-session UI state -- not part of the persisted Reference
  // (only a saved Preset durably bundles export settings). Shared between
  // ExportPanel and PresetsPanel so a saved preset captures whatever the
  // user currently has configured for export.
  exportSettings: ExportSettings;
  setExportSettings: (patch: Partial<ExportSettings>) => void;

  // Bumped to ask CanvasStage to reset the Viewport to fit-to-frame. The Crop
  // panel's overlay assumes the image is shown at fit scale so it can
  // position handles without needing live access to the renderer's Viewport
  // (see CropPanel.tsx) -- a deliberate Phase 1 simplification; cropping at
  // an arbitrary pan/zoom is a follow-up refinement, not required for the
  // golden path.
  viewportResetSignal: number;
  requestViewportReset: () => void;

  loadReference: (input: LoadedReference) => void;
  appendGeometryOp: (op: Operation) => Promise<void>;
  setAdjustment: (type: 'brightness' | 'contrast' | 'saturation', value: number) => void;
  setFilter: (filterId: FilterId | null, params?: Record<string, number>) => void;
  setGridConfig: (patch: Partial<GridConfig>) => void;
  applyPreset: (input: { gridConfig: GridConfig; filterStack: Operation[]; exportSettings: ExportSettings }) => void;
  reset: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

// Debounced so a slider drag or a rapid grid-config change doesn't write to
// IndexedDB on every intermediate tick. The (signed-in only) network push is
// handed off to api-client's own sync queue, which debounces again on its
// own longer ~2s window (docs/architecture/08) -- this local persist and the
// network sync are deliberately two separate debounces, not one.
function schedulePersist(projectId: string, referenceId: string, editStack: Operation[], gridConfig: GridConfig): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void updateReference(referenceId, { editStack, gridConfig }).then(() => {
      if (useAuthStore.getState().user) scheduleReferenceSync(projectId, referenceId);
    });
  }, 400);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  toolMode: 'idle',
  setToolMode: (mode) => set({ toolMode: mode }),

  isImporting: false,
  importError: null,
  setImporting: (isImporting) => set({ isImporting }),
  setImportError: (message) => set({ importError: message }),

  projectId: null,
  referenceId: null,
  assetId: null,
  workingBitmap: null,
  workingWidth: 0,
  workingHeight: 0,
  editStack: [],
  gridConfig: DEFAULT_GRID_CONFIG,

  exportSettings: DEFAULT_EXPORT_SETTINGS,
  setExportSettings: (patch) => set((state) => ({ exportSettings: { ...state.exportSettings, ...patch } })),

  viewportResetSignal: 0,
  requestViewportReset: () => set((state) => ({ viewportResetSignal: state.viewportResetSignal + 1 })),

  loadReference: (input) =>
    set({
      projectId: input.projectId,
      referenceId: input.referenceId,
      assetId: input.assetId,
      workingBitmap: input.workingBitmap,
      workingWidth: input.workingWidth,
      workingHeight: input.workingHeight,
      editStack: input.editStack,
      gridConfig: input.gridConfig,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      toolMode: 'idle',
      importError: null,
    }),

  // The one commit path for crop/rotate/flip: re-runs the new op against the
  // current working bitmap (not the whole stack from scratch) and appends it
  // -- rotate/flip are single-action per
  // .agents/workflows/build-crop-rotate-flip.md, crop's interactive handles
  // live in the Crop panel's own local state and only call this on Apply.
  appendGeometryOp: async (op) => {
    const state = get();
    if (!state.workingBitmap || !state.referenceId || !state.projectId) return;
    const result = await applyGeometryOps(state.workingBitmap, [op]);
    const editStack = [...state.editStack, op];
    set({
      workingBitmap: result.bitmap,
      workingWidth: result.width,
      workingHeight: result.height,
      editStack,
    });
    schedulePersist(state.projectId, state.referenceId, editStack, state.gridConfig);
  },

  // One slider, one current value -- a later commit replaces the earlier
  // entry rather than compounding (matches core-engine's deriveAdjustments).
  setAdjustment: (type, value) => {
    const state = get();
    const editStack = [...state.editStack.filter((op) => op.type !== type), { type, value } as Operation];
    set({ editStack });
    if (state.referenceId && state.projectId) schedulePersist(state.projectId, state.referenceId, editStack, state.gridConfig);
  },

  // At most one active structural filter at a time -- setting a new one (or
  // null, to turn filtering off) replaces whatever was active, matching
  // core-engine's deriveAdjustments last-wins rule.
  setFilter: (filterId, params) => {
    const state = get();
    const withoutFilter = state.editStack.filter((op) => op.type !== 'filter');
    const editStack: Operation[] = filterId ? [...withoutFilter, { type: 'filter', id: filterId, params }] : withoutFilter;
    set({ editStack });
    if (state.referenceId && state.projectId) schedulePersist(state.projectId, state.referenceId, editStack, state.gridConfig);
  },

  setGridConfig: (patch) => {
    const state = get();
    const gridConfig = { ...state.gridConfig, ...patch };
    set({ gridConfig });
    if (state.referenceId && state.projectId) schedulePersist(state.projectId, state.referenceId, state.editStack, gridConfig);
  },

  // Grid + filter stack from a saved Preset, layered on top of whatever
  // geometry (crop/rotate/flip) already happened to this specific photo --
  // a preset is a reusable style, not a framing decision.
  applyPreset: (input) => {
    const state = get();
    const geometryOps = state.editStack.filter(
      (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
    );
    const editStack = [...geometryOps, ...input.filterStack];
    set({ editStack, gridConfig: input.gridConfig, exportSettings: input.exportSettings });
    if (state.referenceId && state.projectId) schedulePersist(state.projectId, state.referenceId, editStack, input.gridConfig);
  },

  reset: () =>
    set({
      toolMode: 'idle',
      projectId: null,
      referenceId: null,
      assetId: null,
      workingBitmap: null,
      workingWidth: 0,
      workingHeight: 0,
      editStack: [],
      gridConfig: DEFAULT_GRID_CONFIG,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      importError: null,
    }),
}));
