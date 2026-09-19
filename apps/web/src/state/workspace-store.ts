import { create } from 'zustand';
import { applyGeometryOps } from '@artiso/core-engine';
import type { Annotation, ExportSettings, FilterId, GridConfig, Operation } from '@artiso/shared-types';
import { scheduleReferenceSync, updateReference } from '@artiso/api-client';
import { useAuthStore } from './auth-store';
import { DEFAULT_GRID_CONFIG } from './default-grid-config';
import { DEFAULT_EXPORT_SETTINGS } from './default-export-settings';
import { buildGridConfigForType } from './build-grid-config-for-type';

export type ToolMode = 'idle' | 'crop' | 'rotateFlip' | 'adjustments' | 'filters' | 'grid' | 'annotate' | 'export' | 'presets';
export type AnnotationTool = 'arrow' | 'circle' | 'note' | 'freehand';

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
  annotations: Annotation[];
}

interface WorkspaceState {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // Presentation/classroom mode (docs/phases/phase-7-guides-workspace-
  // export.md): a display toggle over the same component tree -- chrome
  // hidden, gestures locked, high-contrast grid with larger labels -- not a
  // separate app. Transient per session, never persisted on the Reference.
  presentationMode: boolean;
  setPresentationMode: (enabled: boolean) => void;

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
  // Annotation layer (docs/phases/phase-7-guides-workspace-export.md): drawn
  // on top of the image/grid, never affecting the EditStack pipeline or grid
  // geometry -- an independent overlay, same as the grid.
  annotations: Annotation[];

  // Transient, per-session drawing settings for the *next* annotation to be
  // created -- not persisted on the Reference itself (only committed
  // annotations are), matching how a brush's current color/size in most
  // drawing tools is app state, not part of any one stroke's saved data.
  annotationTool: AnnotationTool;
  annotationColor: string;
  annotationThickness: 'thin' | 'medium' | 'thick';
  setAnnotationTool: (tool: AnnotationTool) => void;
  setAnnotationStyle: (patch: Partial<{ annotationColor: string; annotationThickness: 'thin' | 'medium' | 'thick' }>) => void;

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
  addAnnotation: (annotation: Annotation) => void;
  removeLastAnnotation: () => void;
  clearAnnotations: () => void;
  applyPreset: (input: { gridConfig: GridConfig; filterStack: Operation[]; exportSettings: ExportSettings }) => void;
  reset: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

// Debounced so a slider drag or a rapid grid-config change doesn't write to
// IndexedDB on every intermediate tick. The (signed-in only) network push is
// handed off to api-client's own sync queue, which debounces again on its
// own longer ~2s window (docs/architecture/08) -- this local persist and the
// network sync are deliberately two separate debounces, not one.
//
// Takes the relevant slice of state itself (rather than each field as its
// own parameter) so adding a new persisted field only means updating this
// function once, not every call site.
function schedulePersist(
  state: Pick<
    WorkspaceState,
    'projectId' | 'referenceId' | 'editStack' | 'gridConfig' | 'secondaryGridConfig' | 'annotations'
  >,
): void {
  if (!state.referenceId || !state.projectId) return;
  const { referenceId, projectId, editStack, gridConfig, secondaryGridConfig, annotations } = state;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void updateReference(referenceId, { editStack, gridConfig, secondaryGridConfig, annotations }).then(() => {
      if (useAuthStore.getState().user) scheduleReferenceSync(projectId, referenceId);
    });
  }, 400);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  toolMode: 'idle',
  setToolMode: (mode) => set({ toolMode: mode }),

  presentationMode: false,
  // Entering also closes any open tool panel so nothing lingers behind the
  // hidden chrome (and so the Draw tool's pointer capture is released).
  setPresentationMode: (enabled) => set(enabled ? { presentationMode: true, toolMode: 'idle' } : { presentationMode: false }),

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
  annotations: [],

  annotationTool: 'arrow',
  annotationColor: '#ff3b30',
  annotationThickness: 'medium',
  setAnnotationTool: (tool) => set({ annotationTool: tool }),
  setAnnotationStyle: (patch) => set(patch),

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
      annotations: input.annotations,
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
    schedulePersist({ ...state, editStack });
  },

  // One slider, one current value -- a later commit replaces the earlier
  // entry rather than compounding (matches core-engine's deriveAdjustments).
  setAdjustment: (type, value) => {
    const state = get();
    const editStack = [...state.editStack.filter((op) => op.type !== type), { type, value } as Operation];
    set({ editStack });
    schedulePersist({ ...state, editStack });
  },

  // At most one active structural filter at a time -- setting a new one (or
  // null, to turn filtering off) replaces whatever was active, matching
  // core-engine's deriveAdjustments last-wins rule.
  setFilter: (filterId, params) => {
    const state = get();
    const withoutFilter = state.editStack.filter((op) => op.type !== 'filter');
    const editStack: Operation[] = filterId ? [...withoutFilter, { type: 'filter', id: filterId, params }] : withoutFilter;
    set({ editStack });
    schedulePersist({ ...state, editStack });
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
    schedulePersist({ ...state, gridConfig });
  },

  // Switching guide type can't be a patch -- rows/cols mean nothing to a
  // radial grid -- so this replaces the config wholesale, carrying over
  // only the shared style fields (color/opacity/thickness/visible).
  setGridType: (type) => {
    const state = get();
    const { color, opacity, thickness, visible } = state.gridConfig;
    const gridConfig = buildGridConfigForType(type, { color, opacity, thickness, visible });
    set({ gridConfig });
    schedulePersist({ ...state, gridConfig });
  },

  // Same patch-merge contract as setGridConfig, but for the optional
  // secondary (layered) guide -- a no-op if no secondary layer is active,
  // since GridPanel only shows these controls once one exists.
  setSecondaryGridConfig: (patch) => {
    const state = get();
    if (!state.secondaryGridConfig) return;
    const secondaryGridConfig = { ...state.secondaryGridConfig, ...patch } as GridConfig;
    set({ secondaryGridConfig });
    schedulePersist({ ...state, secondaryGridConfig });
  },

  // Also doubles as "add a layer" when no secondary config exists yet --
  // GridPanel's "Add layer" button calls this directly with a starting type.
  setSecondaryGridType: (type) => {
    const state = get();
    const base = state.secondaryGridConfig ?? state.gridConfig;
    const { color, opacity, thickness, visible } = base;
    const secondaryGridConfig = buildGridConfigForType(type, { color, opacity, thickness, visible });
    set({ secondaryGridConfig });
    schedulePersist({ ...state, secondaryGridConfig });
  },

  removeSecondaryGrid: () => {
    const state = get();
    set({ secondaryGridConfig: null });
    schedulePersist({ ...state, secondaryGridConfig: null });
  },

  // Appends a fully-formed Annotation (id/geometry/style already resolved by
  // the caller -- see CanvasStage's pointer handling for how a draft becomes
  // one of these on commit).
  addAnnotation: (annotation) => {
    const state = get();
    const annotations = [...state.annotations, annotation];
    set({ annotations });
    schedulePersist({ ...state, annotations });
  },

  // Deliberately simple undo -- one step, not a full history stack
  // (ki-simplicity-first): removing/editing an individual earlier annotation
  // is a reasonable follow-up refinement, not required for the layer to be
  // useful.
  removeLastAnnotation: () => {
    const state = get();
    const annotations = state.annotations.slice(0, -1);
    set({ annotations });
    schedulePersist({ ...state, annotations });
  },

  clearAnnotations: () => {
    const state = get();
    set({ annotations: [] });
    schedulePersist({ ...state, annotations: [] });
  },

  // Grid + filter stack from a saved Preset, layered on top of whatever
  // geometry (crop/rotate/flip) already happened to this specific photo --
  // a preset is a reusable style, not a framing decision. Presets don't
  // carry a secondary guide or annotations (PresetSchema has no such
  // fields), so applying one only ever touches the primary gridConfig.
  applyPreset: (input) => {
    const state = get();
    const geometryOps = state.editStack.filter(
      (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
    );
    const editStack = [...geometryOps, ...input.filterStack];
    set({ editStack, gridConfig: input.gridConfig, exportSettings: input.exportSettings });
    schedulePersist({ ...state, editStack, gridConfig: input.gridConfig });
  },

  reset: () =>
    set({
      toolMode: 'idle',
      presentationMode: false,
      projectId: null,
      referenceId: null,
      assetId: null,
      workingBitmap: null,
      workingWidth: 0,
      workingHeight: 0,
      editStack: [],
      gridConfig: DEFAULT_GRID_CONFIG,
      secondaryGridConfig: null,
      annotations: [],
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      importError: null,
    }),
}));
