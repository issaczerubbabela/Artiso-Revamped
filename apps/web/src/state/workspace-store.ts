import { create } from 'zustand';
import { applyGeometryOps } from '@artiso/core-engine';
import type { ExportSettings, FilterId, GridConfig, Operation } from '@artiso/shared-types';
import { scheduleReferenceSync, updateReference } from '@artiso/api-client';
import { useAuthStore } from './auth-store';
import { DEFAULT_GRID_CONFIG } from './default-grid-config';
import { DEFAULT_EXPORT_SETTINGS } from './default-export-settings';
import { buildGridConfigForType } from './build-grid-config-for-type';

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
  secondaryGridConfig: GridConfig | null;
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
  // Layered grids (docs/phases/phase-7-guides-workspace-export.md): an
  // optional second guide overlaid on the primary one. null means no layer
  // -- GridPanel's "Add layer" action is what first populates this via
  // setSecondaryGridType.
  secondaryGridConfig: GridConfig | null;

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
  setGridType: (type: GridConfig['type']) => void;
  setSecondaryGridConfig: (patch: Partial<GridConfig>) => void;
  setSecondaryGridType: (type: GridConfig['type']) => void;
  removeSecondaryGrid: () => void;
  applyPreset: (input: { gridConfig: GridConfig; filterStack: Operation[]; exportSettings: ExportSettings }) => void;
  reset: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

// Debounced so a slider drag or a rapid grid-config change doesn't write to
// IndexedDB on every intermediate tick. The (signed-in only) network push is
// handed off to api-client's own sync queue, which debounces again on its
// own longer ~2s window (docs/architecture/08) -- this local persist and the
// network sync are deliberately two separate debounces, not one.
function schedulePersist(
  projectId: string,
  referenceId: string,
  patch: { editStack: Operation[]; gridConfig: GridConfig; secondaryGridConfig: GridConfig | null },
): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void updateReference(referenceId, patch).then(() => {
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
  secondaryGridConfig: null,

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
      secondaryGridConfig: input.secondaryGridConfig,
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
    schedulePersist(state.projectId, state.referenceId, { editStack, gridConfig: state.gridConfig, secondaryGridConfig: state.secondaryGridConfig });
  },

  // One slider, one current value -- a later commit replaces the earlier
  // entry rather than compounding (matches core-engine's deriveAdjustments).
  setAdjustment: (type, value) => {
    const state = get();
    const editStack = [...state.editStack.filter((op) => op.type !== type), { type, value } as Operation];
    set({ editStack });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack, gridConfig: state.gridConfig, secondaryGridConfig: state.secondaryGridConfig });
    }
  },

  // At most one active structural filter at a time -- setting a new one (or
  // null, to turn filtering off) replaces whatever was active, matching
  // core-engine's deriveAdjustments last-wins rule.
  setFilter: (filterId, params) => {
    const state = get();
    const withoutFilter = state.editStack.filter((op) => op.type !== 'filter');
    const editStack: Operation[] = filterId ? [...withoutFilter, { type: 'filter', id: filterId, params }] : withoutFilter;
    set({ editStack });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack, gridConfig: state.gridConfig, secondaryGridConfig: state.secondaryGridConfig });
    }
  },

  // Callers only ever patch fields that belong to the currently-active
  // type's controls (see GridPanel.tsx's per-type sections), so the merge
  // is safe even though Partial<GridConfig> spans the whole discriminated
  // union -- switching type itself goes through setGridType below, which
  // replaces the config wholesale instead of patching it.
  setGridConfig: (patch) => {
    const state = get();
    const gridConfig = { ...state.gridConfig, ...patch } as GridConfig;
    set({ gridConfig });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack: state.editStack, gridConfig, secondaryGridConfig: state.secondaryGridConfig });
    }
  },

  // Switching guide type can't be a patch -- rows/cols mean nothing to a
  // radial grid -- so this replaces the config wholesale, carrying over
  // only the shared style fields (color/opacity/thickness/visible).
  setGridType: (type) => {
    const state = get();
    const { color, opacity, thickness, visible } = state.gridConfig;
    const gridConfig = buildGridConfigForType(type, { color, opacity, thickness, visible });
    set({ gridConfig });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack: state.editStack, gridConfig, secondaryGridConfig: state.secondaryGridConfig });
    }
  },

  // Same patch-merge contract as setGridConfig, but for the optional
  // secondary (layered) guide -- a no-op if no secondary layer is active,
  // since GridPanel only shows these controls once one exists.
  setSecondaryGridConfig: (patch) => {
    const state = get();
    if (!state.secondaryGridConfig) return;
    const secondaryGridConfig = { ...state.secondaryGridConfig, ...patch } as GridConfig;
    set({ secondaryGridConfig });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack: state.editStack, gridConfig: state.gridConfig, secondaryGridConfig });
    }
  },

  // Also doubles as "add a layer" when no secondary config exists yet --
  // GridPanel's "Add layer" button calls this directly with a starting type.
  setSecondaryGridType: (type) => {
    const state = get();
    const base = state.secondaryGridConfig ?? state.gridConfig;
    const { color, opacity, thickness, visible } = base;
    const secondaryGridConfig = buildGridConfigForType(type, { color, opacity, thickness, visible });
    set({ secondaryGridConfig });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack: state.editStack, gridConfig: state.gridConfig, secondaryGridConfig });
    }
  },

  removeSecondaryGrid: () => {
    const state = get();
    set({ secondaryGridConfig: null });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack: state.editStack, gridConfig: state.gridConfig, secondaryGridConfig: null });
    }
  },

  // Grid + filter stack from a saved Preset, layered on top of whatever
  // geometry (crop/rotate/flip) already happened to this specific photo --
  // a preset is a reusable style, not a framing decision. Presets don't
  // carry a secondary guide (PresetSchema has no such field yet), so
  // applying one only ever touches the primary gridConfig.
  applyPreset: (input) => {
    const state = get();
    const geometryOps = state.editStack.filter(
      (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
    );
    const editStack = [...geometryOps, ...input.filterStack];
    set({ editStack, gridConfig: input.gridConfig, exportSettings: input.exportSettings });
    if (state.referenceId && state.projectId) {
      schedulePersist(state.projectId, state.referenceId, { editStack, gridConfig: input.gridConfig, secondaryGridConfig: state.secondaryGridConfig });
    }
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
      secondaryGridConfig: null,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      importError: null,
    }),
}));
