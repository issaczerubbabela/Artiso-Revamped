import { create } from 'zustand';
import {
  DEFAULT_GRID_SETTINGS,
  applyGeometryOps,
  decodeOriginalBitmap,
  initialCrop,
  paperAspect,
  paperFor,
  recenterCrop,
  renderFramedBitmap,
  swapOrientation,
  transformRectByOp,
} from '@artiso/core-engine';
import type {
  Annotation,
  Crop,
  ExportSettings,
  FilterId,
  GridConfig,
  GridSettings,
  Operation,
  Paper,
  ProjectRole,
} from '@artiso/shared-types';
import { getAssetBlob, scheduleReferenceSync, updateReference } from '@artiso/api-client';
import { useAuthStore } from './auth-store';
import { DEFAULT_GRID_CONFIG } from './default-grid-config';
import { DEFAULT_EXPORT_SETTINGS } from './default-export-settings';
import { buildGridConfigForType } from './build-grid-config-for-type';
import { useTabsStore } from './tabs-store';

export type ToolMode = 'idle' | 'paper' | 'rotateFlip' | 'adjustments' | 'filters' | 'grid' | 'annotate' | 'export' | 'presets';
export type AnnotationTool = 'arrow' | 'circle' | 'note' | 'freehand';

// What the drawing view starts from before any reference is loaded; never drawn.
const DEFAULT_PAPER: Paper = paperFor('A4', 'portrait');
const DEFAULT_CROP: Crop = { x: 0, y: 0, w: DEFAULT_PAPER.widthMm, h: DEFAULT_PAPER.heightMm };

// Everything that defines one open reference: what loadReference takes, and
// what a split view's non-focused pane keeps parked as a snapshot.
export interface PaneSession {
  projectId: string;
  // Labels this reference's tab in the multi-reference workspace.
  projectName: string;
  referenceId: string;
  assetId: string;
  // The bitmap that is drawn: the crop region of the oriented original, at
  // working resolution, stretched over the paper. Crop is never baked into the
  // EditStack (docs/phases/phase-9-drawing-grid-overhaul.md).
  workingBitmap: ImageBitmap;
  workingWidth: number;
  workingHeight: number;
  editStack: Operation[];
  // Legacy rows x cols grid. Kept on the reference so older clients still work,
  // but ignored once the reference has a paper.
  gridConfig: GridConfig;
  // The Guides layer (perspective / thirds / golden ratio), drawn beneath the grid.
  secondaryGridConfig: GridConfig | null;
  paper: Paper;
  // Pixels of the oriented original; aspect always equals the paper's.
  crop: Crop;
  gridSettings: GridSettings;
  // The original's size after rotate/flip: the space `crop` is measured in.
  orientedWidth: number;
  orientedHeight: number;
  annotations: Annotation[];
  removedAnnotationIds: string[];
  // The current user's access to this reference's project. 'viewer' makes
  // the whole session read-only (see canEdit below).
  role: ProjectRole;
}

// The fields a sync merge can change without touching the working bitmap.
// (paper/crop are not here: changing them changes the bitmap, so they force a
// reload -- see live-refresh.ts.)
export type SyncedFields = Pick<
  PaneSession,
  'editStack' | 'gridConfig' | 'secondaryGridConfig' | 'gridSettings' | 'annotations' | 'removedAnnotationIds'
>;

// The paper and crop being edited in the Paper & crop tool. They are edited
// together and only written to the reference when the tool is left, so a paper
// and a crop of a different aspect are never persisted (or synced) as a pair.
export interface FramingDraft {
  paper: Paper;
  crop: Crop;
}

// A partial update to the grid settings; `labels` and `style` merge field by field.
export type GridSettingsPatch = Partial<Omit<GridSettings, 'labels' | 'style'>> & {
  labels?: Partial<GridSettings['labels']>;
  style?: Partial<GridSettings['style']>;
};

type OrientationOperation = Extract<Operation, { type: 'rotate' | 'flip' }>;

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

  // Split view (docs/phases/phase-8-collaboration-split-view.md): this store
  // stays the live session of the *focused* pane, so every panel and action
  // works unchanged. The other pane's session is parked here as a snapshot
  // and rendered read-through; focusing it swaps the two. splitFocusedSide is
  // which physical side the focused pane occupies.
  splitParked: PaneSession | null;
  splitFocusedSide: 'left' | 'right';
  openSplit: (session: PaneSession) => void;
  focusSplitPane: () => void;
  closeSplit: () => void;

  projectId: string | null;
  projectName: string | null;
  role: ProjectRole;
  referenceId: string | null;
  assetId: string | null;
  workingBitmap: ImageBitmap | null;
  workingWidth: number;
  workingHeight: number;
  editStack: Operation[];
  gridConfig: GridConfig;
  // The Guides layer: an optional guide (perspective / thirds / golden ratio)
  // drawn beneath the grid. null means none -- GridPanel's "Add guide" action
  // is what first populates this via setSecondaryGridType.
  secondaryGridConfig: GridConfig | null;
  paper: Paper;
  crop: Crop;
  gridSettings: GridSettings;
  orientedWidth: number;
  orientedHeight: number;
  // Annotation layer (docs/phases/phase-7-guides-workspace-export.md): drawn
  // on top of the image/grid, never affecting the EditStack pipeline or grid
  // geometry -- an independent overlay, same as the grid.
  annotations: Annotation[];
  // Tombstones for deleted annotations, so a collaborative merge can't
  // resurrect them (docs/phases/phase-8-collaboration-split-view.md).
  removedAnnotationIds: string[];

  // The Paper & crop tool's transient state. `cropSource` is the whole oriented
  // image at working resolution (what the user pans/zooms under the fixed
  // frame); `framingDraft` is the paper + crop being edited. Both exist only
  // while the tool is open.
  cropSource: ImageBitmap | null;
  framingDraft: FramingDraft | null;
  setDraftPaper: (paper: Paper) => void;
  setDraftCrop: (crop: Crop) => void;
  resetDraftCrop: () => void;

  // Applies changes a sync merge brought in (a collaborator's edits) to the
  // open session without scheduling a persist -- they're already saved.
  adoptSyncedFields: (fields: SyncedFields) => void;
  // Replaces the split view's parked snapshot, keeping which side is focused.
  replaceParked: (session: PaneSession) => void;

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

  loadReference: (input: PaneSession) => void;
  // Rotate / flip: applied to the working bitmap, appended to the EditStack, and
  // carried through to the crop (the crop rectangle turns with the image) and the
  // paper (a quarter turn swaps its orientation, so the picture keeps its shape).
  appendGeometryOp: (op: OrientationOperation) => Promise<void>;
  setAdjustment: (type: 'brightness' | 'contrast' | 'saturation', value: number) => void;
  setFilter: (filterId: FilterId | null, params?: Record<string, number>) => void;
  setGridSettings: (patch: GridSettingsPatch) => void;
  setSecondaryGridConfig: (patch: Partial<GridConfig>) => void;
  setSecondaryGridType: (type: GridConfig['type']) => void;
  removeSecondaryGrid: () => void;
  addAnnotation: (annotation: Annotation) => void;
  removeLastAnnotation: () => void;
  clearAnnotations: () => void;
  applyPreset: (input: { gridSettings?: GridSettings; filterStack: Operation[]; exportSettings: ExportSettings }) => void;
  reset: () => void;
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let pendingPersist: (() => void) | null = null;

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
    | 'projectId'
    | 'referenceId'
    | 'editStack'
    | 'gridConfig'
    | 'secondaryGridConfig'
    | 'paper'
    | 'crop'
    | 'gridSettings'
    | 'annotations'
    | 'removedAnnotationIds'
    | 'role'
  >,
): void {
  if (!state.referenceId || !state.projectId) return;
  // A viewer never writes -- server RLS would reject it anyway.
  if (state.role === 'viewer') return;
  const { referenceId, projectId, editStack, gridConfig, secondaryGridConfig, paper, crop, gridSettings, annotations, removedAnnotationIds } =
    state;
  clearTimeout(persistTimer);
  pendingPersist = () => {
    pendingPersist = null;
    void updateReference(referenceId, {
      editStack,
      gridConfig,
      secondaryGridConfig,
      paper,
      crop,
      gridSettings,
      annotations,
      removedAnnotationIds,
    }).then(() => {
      if (useAuthStore.getState().user) scheduleReferenceSync(projectId, referenceId);
    });
  };
  persistTimer = setTimeout(() => pendingPersist?.(), 400);
}

// Writes any debounced edit immediately. The persist timer is a single
// global one, so switching to another reference's tab without flushing
// first would let that reference's next edit clear this one's pending
// write and silently drop it.
export function flushPersist(): void {
  clearTimeout(persistTimer);
  pendingPersist?.();
}

// True while an edit is waiting out the persist debounce. A sync merge must
// not overwrite the in-memory session then, or it would discard that edit.
export function hasPendingPersist(): boolean {
  return pendingPersist !== null;
}

function sessionToState(session: PaneSession) {
  return {
    projectId: session.projectId,
    projectName: session.projectName,
    referenceId: session.referenceId,
    assetId: session.assetId,
    workingBitmap: session.workingBitmap,
    workingWidth: session.workingWidth,
    workingHeight: session.workingHeight,
    editStack: session.editStack,
    gridConfig: session.gridConfig,
    secondaryGridConfig: session.secondaryGridConfig,
    paper: session.paper,
    crop: session.crop,
    gridSettings: session.gridSettings,
    orientedWidth: session.orientedWidth,
    orientedHeight: session.orientedHeight,
    annotations: session.annotations,
    removedAnnotationIds: session.removedAnnotationIds,
    role: session.role,
  };
}

function activeSession(state: WorkspaceState): PaneSession | null {
  if (!state.projectId || !state.referenceId || !state.assetId || !state.workingBitmap) return null;
  return {
    projectId: state.projectId,
    projectName: state.projectName ?? '',
    referenceId: state.referenceId,
    assetId: state.assetId,
    workingBitmap: state.workingBitmap,
    workingWidth: state.workingWidth,
    workingHeight: state.workingHeight,
    editStack: state.editStack,
    gridConfig: state.gridConfig,
    secondaryGridConfig: state.secondaryGridConfig,
    paper: state.paper,
    crop: state.crop,
    gridSettings: state.gridSettings,
    orientedWidth: state.orientedWidth,
    orientedHeight: state.orientedHeight,
    annotations: state.annotations,
    removedAnnotationIds: state.removedAnnotationIds,
    role: state.role,
  };
}

// Every mutating action checks this: a viewer's session is read-only. The
// tool buttons are disabled too, but this is what actually guarantees nothing
// changes -- e.g. via a stale panel or a preset apply.
function canEdit(state: WorkspaceState): boolean {
  return state.role !== 'viewer';
}

const CROP_EPSILON = 1e-6;

function sameCrop(a: Crop, b: Crop): boolean {
  return (
    Math.abs(a.x - b.x) < CROP_EPSILON &&
    Math.abs(a.y - b.y) < CROP_EPSILON &&
    Math.abs(a.w - b.w) < CROP_EPSILON &&
    Math.abs(a.h - b.h) < CROP_EPSILON
  );
}

function closeBitmap(bitmap: ImageBitmap | null): void {
  try {
    bitmap?.close();
  } catch {
    // Already closed.
  }
}

// The whole oriented original at working resolution, for the crop tool.
async function renderCropSource(assetId: string, editStack: readonly Operation[]): Promise<ImageBitmap | null> {
  const blob = await getAssetBlob(assetId, 'original');
  if (!blob) return null;
  const original = await decodeOriginalBitmap(blob);
  try {
    return (await renderFramedBitmap(original, editStack, null)).bitmap;
  } finally {
    original.close();
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  toolMode: 'idle',
  // A viewer can look and export, but not open any editing tool. Entering the
  // Paper & crop tool loads the oriented image to pan under the frame; leaving
  // it writes whatever was framed back to the reference.
  setToolMode: (mode) => {
    const state = get();
    if (state.role === 'viewer' && mode !== 'idle' && mode !== 'export') return;
    const entering = mode === 'paper' && state.toolMode !== 'paper';
    const leaving = state.toolMode === 'paper' && mode !== 'paper';
    if (entering && (!state.workingBitmap || !state.assetId)) return;

    if (entering) {
      // The draft exists straight away so the panel has something to show; the
      // image to pan under the frame follows once it has been decoded.
      set({ toolMode: mode, framingDraft: { paper: state.paper, crop: state.crop } });
      const { assetId, referenceId, editStack } = state;
      void renderCropSource(assetId as string, editStack).then((bitmap) => {
        const now = get();
        if (!bitmap || now.toolMode !== 'paper' || now.referenceId !== referenceId) {
          closeBitmap(bitmap);
          return;
        }
        closeBitmap(now.cropSource);
        set({ cropSource: bitmap });
      });
      return;
    }

    set({ toolMode: mode });
    if (leaving) void commitFraming();
  },

  presentationMode: false,
  // Entering also closes any open tool panel so nothing lingers behind the
  // hidden chrome (and so the Draw tool's pointer capture is released).
  setPresentationMode: (enabled) => {
    if (enabled) get().setToolMode('idle');
    set(enabled ? { presentationMode: true } : { presentationMode: false });
  },

  isImporting: false,
  importError: null,
  setImporting: (isImporting) => set({ isImporting }),
  setImportError: (message) => set({ importError: message }),

  splitParked: null,
  splitFocusedSide: 'left',
  openSplit: (session) => set({ splitParked: session, splitFocusedSide: 'left' }),
  // Swaps the focused and parked sessions. The outgoing session's pending
  // edit is flushed first (persist is one global timer, see flushPersist), and
  // a framing edit in progress is written back since it belongs to one pane.
  focusSplitPane: () => {
    const state = get();
    const parked = state.splitParked;
    if (!parked || !activeSession(state)) return;
    if (state.toolMode === 'paper') get().setToolMode('idle');
    const current = activeSession(get());
    if (!current) return;
    flushPersist();
    set({
      ...sessionToState(parked),
      splitParked: current,
      splitFocusedSide: state.splitFocusedSide === 'left' ? 'right' : 'left',
    });
  },
  closeSplit: () => set({ splitParked: null, splitFocusedSide: 'left' }),

  projectId: null,
  projectName: null,
  role: 'owner',
  referenceId: null,
  assetId: null,
  workingBitmap: null,
  workingWidth: 0,
  workingHeight: 0,
  editStack: [],
  gridConfig: DEFAULT_GRID_CONFIG,
  secondaryGridConfig: null,
  paper: DEFAULT_PAPER,
  crop: DEFAULT_CROP,
  gridSettings: DEFAULT_GRID_SETTINGS,
  orientedWidth: 0,
  orientedHeight: 0,
  annotations: [],
  removedAnnotationIds: [],

  cropSource: null,
  framingDraft: null,
  // Turning the draft paper re-fits the draft crop to the new aspect, keeping its
  // centre and area (a portrait crop becomes the same-sized landscape one).
  setDraftPaper: (paper) => {
    const { framingDraft, orientedWidth, orientedHeight } = get();
    if (!framingDraft || !canEdit(get())) return;
    const crop = recenterCrop(framingDraft.crop, paperAspect(paper), orientedWidth, orientedHeight);
    set({ framingDraft: { paper, crop } });
  },
  setDraftCrop: (crop) => {
    const { framingDraft } = get();
    if (!framingDraft) return;
    set({ framingDraft: { ...framingDraft, crop } });
  },
  resetDraftCrop: () => {
    const { framingDraft, orientedWidth, orientedHeight } = get();
    if (!framingDraft) return;
    set({ framingDraft: { ...framingDraft, crop: initialCrop(orientedWidth, orientedHeight, paperAspect(framingDraft.paper)) } });
  },

  adoptSyncedFields: (fields) => set(fields),
  replaceParked: (session) => set({ splitParked: session }),

  annotationTool: 'arrow',
  annotationColor: '#ff3b30',
  annotationThickness: 'medium',
  setAnnotationTool: (tool) => set({ annotationTool: tool }),
  setAnnotationStyle: (patch) => set(patch),

  exportSettings: DEFAULT_EXPORT_SETTINGS,
  setExportSettings: (patch) => set((state) => ({ exportSettings: { ...state.exportSettings, ...patch } })),

  loadReference: (input) => {
    // Any reference being swapped out gets its debounced edit written first
    // (see flushPersist) -- covers import, open-project, and tab switching.
    flushPersist();
    closeBitmap(get().cropSource);
    useTabsStore.getState().openTab({ projectId: input.projectId, referenceId: input.referenceId, title: input.projectName });
    set((state) => ({
      ...sessionToState(input),
      // The same reference can't be open in both panes (their edits would
      // diverge), so loading the parked one into the focused pane ends the split.
      ...(state.splitParked?.referenceId === input.referenceId ? { splitParked: null, splitFocusedSide: 'left' as const } : {}),
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      toolMode: 'idle' as const,
      cropSource: null,
      framingDraft: null,
      importError: null,
    }));
  },

  // The one commit path for rotate/flip: re-runs the new op against the current
  // working bitmap (not the whole stack from scratch) and appends it -- rotate/
  // flip are single-action per .agents/workflows/build-crop-rotate-flip.md.
  // Crop is no longer an EditStack operation; it is the Paper & crop tool's
  // `crop`. The crop rectangle turns with the image, and a quarter turn swaps the
  // paper's orientation so the picture keeps the shape of its frame.
  appendGeometryOp: async (op) => {
    const state = get();
    if (!canEdit(state)) return;
    if (!state.workingBitmap || !state.referenceId || !state.projectId) return;
    const result = await applyGeometryOps(state.workingBitmap, [op]);
    const turned = transformRectByOp(state.crop, { width: state.orientedWidth, height: state.orientedHeight }, op);
    const quarterTurn = op.type === 'rotate' && (op.degrees === 90 || op.degrees === 270);
    const paper = quarterTurn ? swapOrientation(state.paper) : state.paper;
    const editStack = [...state.editStack, op];
    set({
      workingBitmap: result.bitmap,
      workingWidth: result.width,
      workingHeight: result.height,
      editStack,
      crop: turned.rect,
      paper,
      orientedWidth: turned.plane.width,
      orientedHeight: turned.plane.height,
    });
    schedulePersist({ ...state, editStack, crop: turned.rect, paper });
  },

  // One slider, one current value -- a later commit replaces the earlier
  // entry rather than compounding (matches core-engine's deriveAdjustments).
  setAdjustment: (type, value) => {
    const state = get();
    if (!canEdit(state)) return;
    const editStack = [...state.editStack.filter((op) => op.type !== type), { type, value } as Operation];
    set({ editStack });
    schedulePersist({ ...state, editStack });
  },

  // At most one active structural filter at a time -- setting a new one (or
  // null, to turn filtering off) replaces whatever was active, matching
  // core-engine's deriveAdjustments last-wins rule.
  setFilter: (filterId, params) => {
    const state = get();
    if (!canEdit(state)) return;
    const withoutFilter = state.editStack.filter((op) => op.type !== 'filter');
    const editStack: Operation[] = filterId ? [...withoutFilter, { type: 'filter', id: filterId, params }] : withoutFilter;
    set({ editStack });
    schedulePersist({ ...state, editStack });
  },

  // Every change repaints the grid lines/labels and nothing else -- the image
  // pipeline is untouched (ki-grid-image-independence).
  setGridSettings: (patch) => {
    const state = get();
    if (!canEdit(state)) return;
    const { labels, style, ...rest } = patch;
    const gridSettings: GridSettings = {
      ...state.gridSettings,
      ...rest,
      labels: { ...state.gridSettings.labels, ...labels },
      style: { ...state.gridSettings.style, ...style },
    };
    set({ gridSettings });
    schedulePersist({ ...state, gridSettings });
  },

  // Same patch-merge contract, for the optional Guides layer -- a no-op if no
  // guide is active, since GridPanel only shows these controls once one exists.
  setSecondaryGridConfig: (patch) => {
    const state = get();
    if (!canEdit(state) || !state.secondaryGridConfig) return;
    const secondaryGridConfig = { ...state.secondaryGridConfig, ...patch } as GridConfig;
    set({ secondaryGridConfig });
    schedulePersist({ ...state, secondaryGridConfig });
  },

  // Also doubles as "add a guide" when none exists yet. Switching type can't be a
  // patch (a perspective guide's fields mean nothing to a golden-ratio one), so
  // this replaces the config wholesale, carrying over only the shared style.
  setSecondaryGridType: (type) => {
    const state = get();
    if (!canEdit(state)) return;
    const base = state.secondaryGridConfig ?? state.gridConfig;
    const { color, opacity, thickness, visible } = base;
    const secondaryGridConfig = buildGridConfigForType(type, { color, opacity, thickness, visible });
    set({ secondaryGridConfig });
    schedulePersist({ ...state, secondaryGridConfig });
  },

  removeSecondaryGrid: () => {
    const state = get();
    if (!canEdit(state)) return;
    set({ secondaryGridConfig: null });
    schedulePersist({ ...state, secondaryGridConfig: null });
  },

  // Appends a fully-formed Annotation (id/geometry/style already resolved by
  // the caller -- see CanvasStage's pointer handling for how a draft becomes
  // one of these on commit).
  addAnnotation: (annotation) => {
    const state = get();
    if (!canEdit(state)) return;
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
    if (!canEdit(state)) return;
    const last = state.annotations[state.annotations.length - 1];
    if (!last) return;
    const annotations = state.annotations.slice(0, -1);
    const removedAnnotationIds = [...state.removedAnnotationIds, last.id];
    set({ annotations, removedAnnotationIds });
    schedulePersist({ ...state, annotations, removedAnnotationIds });
  },

  clearAnnotations: () => {
    const state = get();
    if (!canEdit(state)) return;
    const removedAnnotationIds = [...state.removedAnnotationIds, ...state.annotations.map((a) => a.id)];
    set({ annotations: [], removedAnnotationIds });
    schedulePersist({ ...state, annotations: [], removedAnnotationIds });
  },

  // Grid settings + filter stack from a saved Preset, layered on top of whatever
  // geometry (rotate/flip) already happened to this specific photo -- a preset is
  // a reusable style, not a framing decision. A preset saved before the drawing-
  // grid overhaul carries no gridSettings, so applying it leaves the grid alone.
  applyPreset: (input) => {
    const state = get();
    if (!canEdit(state)) return;
    const geometryOps = state.editStack.filter(
      (op) => op.type === 'crop' || op.type === 'rotate' || op.type === 'flip',
    );
    const editStack = [...geometryOps, ...input.filterStack];
    const gridSettings = input.gridSettings ?? state.gridSettings;
    set({ editStack, gridSettings, exportSettings: input.exportSettings });
    schedulePersist({ ...state, editStack, gridSettings });
  },

  reset: () => {
    closeBitmap(get().cropSource);
    set({
      toolMode: 'idle',
      presentationMode: false,
      splitParked: null,
      splitFocusedSide: 'left',
      projectId: null,
      projectName: null,
      referenceId: null,
      assetId: null,
      workingBitmap: null,
      workingWidth: 0,
      workingHeight: 0,
      editStack: [],
      gridConfig: DEFAULT_GRID_CONFIG,
      secondaryGridConfig: null,
      paper: DEFAULT_PAPER,
      crop: DEFAULT_CROP,
      gridSettings: DEFAULT_GRID_SETTINGS,
      orientedWidth: 0,
      orientedHeight: 0,
      cropSource: null,
      framingDraft: null,
      annotations: [],
      removedAnnotationIds: [],
      role: 'owner',
      exportSettings: DEFAULT_EXPORT_SETTINGS,
      importError: null,
    });
  },
}));

// Leaving the Paper & crop tool writes the framing back: the paper always, and,
// if the crop moved, a new working bitmap rendered from the crop region of the
// original (so a small crop of a big photo stays sharp). Nothing is baked into
// the original or the EditStack.
async function commitFraming(): Promise<void> {
  const before = useWorkspaceStore.getState();
  const draft = before.framingDraft;
  const clear = () => {
    closeBitmap(useWorkspaceStore.getState().cropSource);
    useWorkspaceStore.setState({ cropSource: null, framingDraft: null });
  };
  if (!draft || !canEdit(before) || !before.assetId || !before.referenceId) {
    clear();
    return;
  }

  const paperChanged =
    draft.paper.preset !== before.paper.preset ||
    draft.paper.orientation !== before.paper.orientation ||
    draft.paper.widthMm !== before.paper.widthMm ||
    draft.paper.heightMm !== before.paper.heightMm;
  const cropChanged = !sameCrop(draft.crop, before.crop);
  if (!paperChanged && !cropChanged) {
    clear();
    return;
  }

  const referenceId = before.referenceId;
  let framed: Awaited<ReturnType<typeof renderFramedBitmap>> | null = null;
  if (cropChanged) {
    const blob = await getAssetBlob(before.assetId, 'original');
    if (blob) {
      const original = await decodeOriginalBitmap(blob);
      try {
        framed = await renderFramedBitmap(original, before.editStack, draft.crop);
      } finally {
        original.close();
      }
    }
  }

  const now = useWorkspaceStore.getState();
  // The user moved on to another reference while this was rendering.
  if (now.referenceId !== referenceId) {
    closeBitmap(framed?.bitmap ?? null);
    return;
  }
  // Could not re-render (original unavailable): keep the previous framing whole
  // rather than pairing a new paper with the old bitmap.
  if (cropChanged && !framed) {
    clear();
    return;
  }

  closeBitmap(now.cropSource);
  useWorkspaceStore.setState({
    paper: draft.paper,
    crop: draft.crop,
    ...(framed ? { workingBitmap: framed.bitmap, workingWidth: framed.width, workingHeight: framed.height } : {}),
    cropSource: null,
    framingDraft: null,
  });
  schedulePersist({ ...now, paper: draft.paper, crop: draft.crop });
}
