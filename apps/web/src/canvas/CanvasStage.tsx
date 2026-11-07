'use client';

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  cellAt,
  cellBounds,
  cellKey,
  cellLabel,
  cropFromView,
  deriveAdjustments,
  formatMeasurement,
  invalidatesDoneCells,
  measureDistance,
  nearestAxis,
  snapToAxis,
  parseCellKey,
  frameInViewport,
  generateGridGeometry,
  paperAspect,
  physicalPpi,
  pxPerMmCss,
  resolveAnnotationGeometry,
  viewFromCrop,
  type FrameRect,
  type GridGeometry,
  type MeasureAxis,
  type ResolvedAnnotation,
} from '@artiso/core-engine';
import {
  AnnotationLayer,
  CheckPhotoLayer,
  DrawingGridLayer,
  GridLayer,
  HoldDetector,
  ImageLayer,
  InputController,
  NO_INSETS,
  Viewport,
  createCropConstraint,
  drawCellFocus,
  drawCropFrame,
  drawMeasurement,
  drawPencilHover,
  viewOrientation,
  viewRotationDegrees,
  type GridDrawLayer,
  type RememberedView,
  type ViewOrientation,
  type ViewportInsets,
  type ViewportOptions,
  type ViewportState,
} from '@artiso/renderer';
import type { Annotation, Crop, GridConfig, GridSettings, Paper } from '@artiso/shared-types';
import { cellFocusEntry, useCellFocusStore } from '@/state/cell-focus-store';
import { useCheckPhotoStore } from '@/state/check-photo-store';
import { isGridOffCanvas, useDisplayStore } from '@/state/display-store';
import { isPencilOnly, isTouchLocked, useInputStore } from '@/state/input-store';
import { useMeasureStore } from '@/state/measure-store';
import { readOrientationView, writeOrientationView } from '@/state/orientation-view-store';
import { useWorkspaceStore, type FramingDraft, type PaneSession } from '@/state/workspace-store';

// The drawing view's zoom and pan limits (Grid-Feature-Spec.md §10): content is
// the paper in mm, so `scale` is CSS px per mm. The smallest zoom fits the paper
// in the viewport; 30 px/mm is well past pixel-level detail on a phone.
const DRAW_VIEWPORT: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };

// Space kept around the crop frame inside the viewport (CSS px).
const CROP_FRAME_MARGIN = 24;
const PRESENTATION_LABEL_SCALE = 2;
const PRESENTATION_MIN_LINE_PX = 2.5;

// What the parent hears about this pane's view: for the zoom pill's readout and
// its 1:1 badge.
export interface StageViewInfo {
  // CSS px per mm of paper (the viewport scale).
  scale: number;
  // The scale at which the whole paper fits; the zoom readout is relative to it.
  fitScale: number;
  isRealSize: boolean;
  // Whether Real size can be reached (the screen has been calibrated).
  realSizeAvailable: boolean;
  // View Rotation, radians in (-π, π].
  rotation: number;
}

// What a pane's controls can do to its own view. Each pane in a split view has
// its own viewport, so the controls act per pane rather than through a global.
export interface CanvasStageHandle {
  fit: () => void;
  // Zooms to 1 mm on paper = 1 mm on the screen; false if not calibrated yet.
  realSize: () => boolean;
  // Turns the view back to 0° about the visible centre.
  resetRotation: () => void;
  // The paper point (mm) under a client point, or null outside the drawing view.
  contentPointAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  // Cell Focus: pans just enough to show this paper rect, if it is off screen.
  revealContentRect: (rect: { x: number; y: number; w: number; h: number }) => void;
}

// Space kept between a revealed cell and the edge of the visible region (CSS px).
const REVEAL_MARGIN = 16;

interface Engine {
  viewport: Viewport;
  imageLayer: ImageLayer;
  // The Drawing Check's Check Photo, between the reference and the grid.
  checkPhotoLayer: CheckPhotoLayer;
  gridLayer: GridLayer;
  drawingGridLayer: DrawingGridLayer;
  annotationLayer: AnnotationLayer;
  input: InputController;
  // Canvas size in CSS px; the backing stores are `dpr` times larger.
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  // The strips of the canvas that floating chrome covers. The surface is
  // full-bleed; content fits and centres in what is left.
  insets: ViewportInsets;
  dirty: boolean;
  raf: number;
  draft: ResolvedAnnotation | null;

  // What the viewport is currently configured for, so a change of mode, bitmap
  // or paper is noticed and the view rebuilt exactly when it needs to be.
  mode: 'draw' | 'crop';
  configuredBitmap: ImageBitmap | null;
  configuredContent: string;
  // Crop tool: the fixed frame, and the last crop this pane reported to the store
  // (so a crop change that came from *outside* -- the paper changing -- is told
  // apart from the user's own panning).
  frame: FrameRect | null;
  lastEmittedCrop: Crop | null;
  lastInfo: StageViewInfo | null;
  // The reference the drawing view was last set up for: its view is restored
  // from (and remembered to) this device's storage under this id.
  referenceId: string | null;
  // Landscape or portrait (the window, wider than tall or not): each remembers
  // its own zoom, pan and View Rotation per reference.
  orientation: ViewOrientation;
  // The window has turned but the canvas hasn't been resized yet: the view on
  // screen still belongs to the old orientation and is not remembered.
  turning: boolean;
  // The artist's place (zoom, angle and the point at the visible centre) as the
  // window began to resize, before the canvas or the chrome changed.
  place: RememberedView | null;
  // The window size the place was last taken for.
  windowWidth: number;
  windowHeight: number;
  // The view put back after a resize. The chrome for the new window size can
  // arrive a moment after the canvas resizes; until the artist touches the
  // view or picks a tool, a change of insets re-applies this rather than
  // nudging the place off-centre.
  restored: RememberedView | null;
  // The angle the canvas was last shown at, in whole degrees (data attribute).
  shownDegrees: number | null;
  // What Cell Focus last painted (data attribute), '' for nothing.
  shownFocus: string;
  // Where a hovering Pencil is (CSS px on the canvas), or null.
  hover: { x: number; y: number } | null;
  // What the Pencil hover and the Measurement last painted (data attributes).
  shownHover: string;
  shownMeasurement: string;
}

type GeometryCache = { current: { key: string; geometry: GridGeometry } | null };
type AnnotationCache = { current: { key: string; resolved: ResolvedAnnotation[] } | null };

interface NotePrompt {
  cssX: number;
  cssY: number;
  normX: number;
  normY: number;
}

interface ViewData {
  referenceId: string | null;
  workingBitmap: ImageBitmap | null;
  editStack: PaneSession['editStack'];
  secondaryGridConfig: GridConfig | null;
  paper: Paper;
  gridSettings: GridSettings;
  orientedWidth: number;
  orientedHeight: number;
  annotations: Annotation[];
  presentationMode: boolean;
  // Set only for the focused pane while the Paper & crop tool is open and the
  // image to pan under the frame has loaded.
  cropSource: ImageBitmap | null;
  framingDraft: FramingDraft | null;
}

// What this pane draws: a parked split-view session if one was passed in,
// otherwise the workspace store's live (focused) session. Presentation mode
// is workspace-wide either way; the crop tool only ever belongs to the focused pane.
function readView(session: PaneSession | undefined): ViewData {
  const store = useWorkspaceStore.getState();
  const source = session ?? store;
  const cropping = !session && store.toolMode === 'paper';
  return {
    referenceId: source.referenceId,
    workingBitmap: source.workingBitmap,
    editStack: source.editStack,
    secondaryGridConfig: source.secondaryGridConfig,
    paper: source.paper,
    gridSettings: source.gridSettings,
    orientedWidth: source.orientedWidth,
    orientedHeight: source.orientedHeight,
    annotations: source.annotations,
    presentationMode: store.presentationMode,
    cropSource: cropping ? store.cropSource : null,
    framingDraft: cropping ? store.framingDraft : null,
  };
}

const isCropping = (view: ViewData): boolean => view.cropSource !== null && view.framingDraft !== null;

function toViewportState(view: { scale: number; tx: number; ty: number }): ViewportState {
  return { scale: view.scale, translateX: view.tx, translateY: view.ty, rotation: 0 };
}

// The mount point for one pane (docs/architecture/05-canvas-renderer.md): three
// stacked canvases (WebGL image layer, Canvas2D grid layer, Canvas2D annotation
// layer) plus a requestAnimationFrame dirty-flag loop so pan/zoom repaints
// happen without forcing a React re-render on every pointer move.
//
// Content is the paper, in millimetres: the image is stretched over the paper
// rectangle and the grid is generated in the same units, so the viewport's
// `scale` is CSS px per mm and Real size is a single number. Everything -- the
// viewport, pointer coordinates, layout -- is in CSS px; the canvases are backed
// at devicePixelRatio and draw under a matching transform.
//
// While the Paper & crop tool is open the same viewport is repurposed: content
// is the oriented image, a fixed paper-shaped frame is overlaid, and the user
// pans/zooms the image beneath it (the crop is whatever the frame shows).
//
// `session` is set for a split view's parked (non-focused) pane, which draws
// that snapshot with its own independent pan/zoom and takes no tool input;
// the focused pane omits it and reads the live workspace store.
export const CanvasStage = forwardRef<
  CanvasStageHandle,
  { session?: PaneSession; onViewChange?: (info: StageViewInfo) => void; insets?: ViewportInsets }
>(
  function CanvasStage({ session, onViewChange, insets = NO_INSETS }, ref) {
    const sessionRef = useRef(session);
    const onViewChangeRef = useRef(onViewChange);
    const insetsRef = useRef(insets);
    const isParked = session !== undefined;
    const containerRef = useRef<HTMLDivElement>(null);
    const imageCanvasRef = useRef<HTMLCanvasElement>(null);
    const checkCanvasRef = useRef<HTMLCanvasElement>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const geometryCacheRef = useRef<{ key: string; geometry: GridGeometry } | null>(null);
    const annotationCacheRef = useRef<{ key: string; resolved: ResolvedAnnotation[] } | null>(null);
    const [notePrompt, setNotePrompt] = useState<NotePrompt | null>(null);
    const noteInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      sessionRef.current = session;
    }, [session]);
    useEffect(() => {
      onViewChangeRef.current = onViewChange;
    }, [onViewChange]);

    // Floating chrome moved: tell the viewport which part of the canvas is
    // still visible. A layout effect, so a panel that just appeared never gets a
    // frame of the photo drawn underneath it. (The engine itself is created in
    // the mount effect below, which reads insetsRef for the very first fit.)
    useLayoutEffect(() => {
      insetsRef.current = insets;
      const engine = engineRef.current;
      if (engine) applyInsets(engine, insets);
    }, [insets.left, insets.top, insets.right, insets.bottom]);  // eslint-disable-line react-hooks/exhaustive-deps

    useImperativeHandle(
      ref,
      () => ({
        fit: () => {
          const engine = engineRef.current;
          if (!engine) return;
          engine.input.engine.stopMotion();
          engine.restored = null;
          engine.viewport.zoomToFit();
          engine.dirty = true;
        },
        realSize: () => {
          const engine = engineRef.current;
          if (!engine) return false;
          engine.input.engine.stopMotion();
          engine.restored = null;
          const ok = engine.viewport.setRealSize();
          engine.dirty = true;
          return ok;
        },
        resetRotation: () => {
          const engine = engineRef.current;
          if (!engine || engine.mode !== 'draw') return;
          engine.input.engine.stopMotion();
          engine.restored = null;
          engine.viewport.setRotation(0);
          engine.dirty = true;
        },
        contentPointAt: (clientX, clientY) => {
          const engine = engineRef.current;
          const container = containerRef.current;
          if (!engine || !container || engine.mode !== 'draw') return null;
          const rect = container.getBoundingClientRect();
          return engine.viewport.screenToImage({ x: clientX - rect.left, y: clientY - rect.top });
        },
        revealContentRect: (rect) => {
          const engine = engineRef.current;
          if (!engine || engine.mode !== 'draw') return;
          engine.input.engine.stopMotion();
          if (engine.viewport.revealRect(rect, REVEAL_MARGIN)) engine.dirty = true;
        },
      }),
      [],
    );

    // Mounted exactly once: Viewport (and therefore the user's current pan/zoom)
    // survives every later adjustment, grid-config, or geometry-op change --
    // only this component unmounting (switching away from the reference
    // entirely) resets it.
    useEffect(() => {
      const container = containerRef.current;
      const imageCanvas = imageCanvasRef.current;
      const checkCanvas = checkCanvasRef.current;
      const gridCanvas = gridCanvasRef.current;
      const annotationCanvas = annotationCanvasRef.current;
      const initial = readView(sessionRef.current);
      if (!container || !imageCanvas || !checkCanvas || !gridCanvas || !annotationCanvas || !initial.workingBitmap) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      for (const canvas of [imageCanvas, checkCanvas, gridCanvas, annotationCanvas]) {
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      }

      const viewport = new Viewport(cssWidth, cssHeight, initial.paper.widthMm, initial.paper.heightMm, DRAW_VIEWPORT);
      viewport.setInsets(insetsRef.current);
      const imageLayer = new ImageLayer(imageCanvas);
      const checkPhotoLayer = new CheckPhotoLayer(checkCanvas);
      // Two passes share the grid canvas: the guides beneath, then the grid.
      const gridLayer = new GridLayer(gridCanvas);
      const drawingGridLayer = new DrawingGridLayer(gridCanvas);
      const annotationLayer = new AnnotationLayer(annotationCanvas);

      const engine: Engine = {
        viewport,
        imageLayer,
        checkPhotoLayer,
        gridLayer,
        drawingGridLayer,
        annotationLayer,
        input: undefined as unknown as InputController,
        cssWidth,
        cssHeight,
        dpr,
        insets: insetsRef.current,
        dirty: true,
        raf: 0,
        draft: null,
        mode: 'draw',
        configuredBitmap: null,
        configuredContent: '',
        frame: null,
        lastEmittedCrop: null,
        lastInfo: null,
        referenceId: null,
        orientation: windowOrientation(),
        turning: false,
        place: null,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        restored: null,
        shownDegrees: null,
        shownFocus: '',
        hover: null,
        shownHover: '',
        shownMeasurement: '',
      };

      function applyRealScale(): void {
        const screen = useDisplayStore.getState().screen;
        // CSS px per mm at true size depends on the pixel ratio, which changes
        // with browser zoom, so it is recomputed rather than stored.
        engine.viewport.setRealScale(screen ? pxPerMmCss(physicalPpi(screen), window.devicePixelRatio || 1) : null);
      }

      function redraw() {
        const state = readView(sessionRef.current);
        if (!state.workingBitmap) return;
        syncEngine(engine, state);
        const view = engine.viewport.getState();
        const adjustments = deriveAdjustments(state.editStack);
        const { cssWidth: w, cssHeight: h, dpr: ratio } = engine;

        if (engine.mode === 'crop' && state.framingDraft && engine.frame) {
          // Crop tool: the image under the fixed frame, with the grid previewed
          // inside it and everything outside dimmed.
          engine.imageLayer.draw(view, w, h, adjustments, ratio);
          engine.checkPhotoLayer.clear(w, h, ratio);
          const { paper } = state.framingDraft;
          engine.drawingGridLayer.draw(
            {
              paper,
              settings: state.gridSettings,
              view: { scale: engine.frame.w / paper.widthMm, translateX: engine.frame.x, translateY: engine.frame.y, rotation: 0 },
              width: w,
              height: h,
            },
            { pixelRatio: ratio },
          );
          const ctx = gridCanvas!.getContext('2d');
          if (ctx) {
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            drawCropFrame(ctx, w, h, engine.frame);
          }
          engine.annotationLayer.draw([], null, view, w, h, ratio);
          showFocus('');
          showPointerOverlays('', '');
          return;
        }

        const { paper, presentationMode } = state;
        engine.imageLayer.draw(view, w, h, adjustments, ratio);
        // The Drawing Check: view state only, never part of the reference.
        const check = useCheckPhotoStore.getState();
        const shown = state.referenceId ? check.byReference[state.referenceId] : undefined;
        engine.checkPhotoLayer.draw(shown?.straightened ?? null, paper, check, view, w, h, ratio);

        const labelScale = presentationMode ? PRESENTATION_LABEL_SCALE : 1;
        const hasGuide = state.secondaryGridConfig !== null;
        // Show/hide grid (the canvas menu, G) or Space held: the guides and
        // the grid both go.
        const gridOff = isGridOffCanvas(useDisplayStore.getState());
        if (gridOff) {
          const ctx = gridCanvas!.getContext('2d');
          if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, gridCanvas!.width, gridCanvas!.height);
          }
        } else if (state.secondaryGridConfig) {
          const geometry = getCachedGridGeometry(geometryCacheRef, paper.widthMm, paper.heightMm, state.secondaryGridConfig);
          const layers: GridDrawLayer[] = [
            { geometry, config: presentationStyle(state.secondaryGridConfig, presentationMode) },
          ];
          engine.gridLayer.draw(layers, view, w, h, { labelScale, pixelRatio: ratio });
        }
        if (!gridOff) {
          engine.drawingGridLayer.draw(
            { paper, settings: presentationSettings(state.gridSettings, presentationMode), view, width: w, height: h },
            { pixelRatio: ratio, labelScale, clear: !hasGuide },
          );
        }
        showFocus(drawFocus(state, view));

        const resolved = getCachedAnnotationGeometry(annotationCacheRef, paper.widthMm, paper.heightMm, state.annotations);
        engine.annotationLayer.draw(resolved, engine.draft, view, w, h, ratio);
        drawPointerOverlays(state, view);
      }

      // Over the annotations: the Measurement (the focused pane's Measure tool)
      // and the Pencil hover -- crosshair, the cell under the tip and its label,
      // in every mode. View state only.
      function drawPointerOverlays(state: ViewData, view: ViewportState): void {
        const ctx = annotationCanvas!.getContext('2d');
        if (!ctx) return;
        const { cssWidth: w, cssHeight: h, dpr: ratio } = engine;
        const { cellMm, showSquares, labels } = state.gridSettings;

        let measured = '';
        const measurement = useMeasureStore.getState().measurement;
        if (!sessionRef.current && measurement && measurement.referenceId === state.referenceId) {
          const { unit, dpi } = useDisplayStore.getState();
          measured = formatMeasurement(measureDistance(measurement.start, measurement.end, cellMm), unit, dpi);
          drawMeasurement(ctx, { start: measurement.start, end: measurement.end, label: measured }, view, w, h, ratio);
        }

        let hovered = '';
        if (engine.hover) {
          const grid = { paper: state.paper, cellMm };
          const cell = showSquares ? cellAt(grid, engine.viewport.screenToImage(engine.hover)) : null;
          const label = cell ? cellLabel(cell, labels) : null;
          drawPencilHover(ctx, { tip: engine.hover, cell: cell ? cellBounds(grid, cell) : null, label }, view, w, h, ratio);
          // '+' for the crosshair alone (off the paper, or no squares).
          hovered = label ?? '+';
        }
        showPointerOverlays(hovered, measured);
      }

      // What the Pencil hover and the Measurement have painted, as data
      // attributes, so tests wait for the canvas rather than for time.
      function showPointerOverlays(hovered: string, measured: string): void {
        if (engine.shownHover !== hovered) {
          engine.shownHover = hovered;
          if (hovered) container!.dataset.pencilHover = hovered;
          else delete container!.dataset.pencilHover;
        }
        if (engine.shownMeasurement !== measured) {
          engine.shownMeasurement = measured;
          if (measured) container!.dataset.measurement = measured;
          else delete container!.dataset.measurement;
        }
      }

      // Cell Focus (device-local view state): the dim, the focused cell's
      // outline and the Done Cell ticks, over the grid. Only with squares on.
      // Returns what was drawn ('' for nothing): the focused cell's key, the
      // number of Done Cells and the darkening.
      function drawFocus(state: ViewData, view: ViewportState): string {
        const entry = cellFocusEntry(state.referenceId);
        if (!entry?.active || !entry.cell || !state.gridSettings.showSquares) return '';
        const grid = { paper: state.paper, cellMm: state.gridSettings.cellMm };
        // Counted on another grid: the Done Cells guard is about to clear them.
        const current = { ...(entry.layout ?? { crop: null }), widthMm: state.paper.widthMm, heightMm: state.paper.heightMm, cellMm: grid.cellMm };
        if (entry.layout !== null && invalidatesDoneCells(entry.layout, current)) return '';
        const ctx = gridCanvas!.getContext('2d');
        if (!ctx) return '';
        const done = entry.done.flatMap((key) => {
          const cell = parseCellKey(key);
          return cell ? [cellBounds(grid, cell)] : [];
        });
        const { dimPercent } = useCellFocusStore.getState();
        drawCellFocus(ctx, { focus: cellBounds(grid, entry.cell), dimPercent, done }, view, engine.cssWidth, engine.cssHeight, engine.dpr);
        return `${cellKey(entry.cell)}:${done.length}:${dimPercent}`;
      }

      // What Cell Focus has painted, as a data attribute (like the View
      // Rotation's), so tests can wait for the canvas rather than for time.
      function showFocus(shown: string): void {
        if (engine.shownFocus === shown) return;
        engine.shownFocus = shown;
        if (shown) container!.dataset.cellFocus = shown;
        else delete container!.dataset.cellFocus;
      }

      // Reports the user's own panning/zooming of the image in the crop tool back
      // to the store, so the panel and the eventual commit see the crop.
      function emitCrop(): void {
        if (engine.mode !== 'crop' || !engine.frame) return;
        const s = engine.viewport.getState();
        const crop = cropFromView({ scale: s.scale, tx: s.translateX, ty: s.translateY }, engine.frame);
        const last = engine.lastEmittedCrop;
        if (last && Math.abs(last.x - crop.x) < 1e-6 && Math.abs(last.y - crop.y) < 1e-6 && Math.abs(last.w - crop.w) < 1e-6) return;
        engine.lastEmittedCrop = crop;
        useWorkspaceStore.getState().setDraftCrop(crop);
      }

      function reportView(): void {
        const { rotation } = engine.viewport.getState();
        // What is on screen right now: the Paper tool always shows 0°.
        const shown = engine.mode === 'draw' ? viewRotationDegrees(rotation) : 0;
        if (shown !== engine.shownDegrees) {
          engine.shownDegrees = shown;
          container!.dataset.viewRotation = String(shown);
        }
        if (engine.mode !== 'draw') return;
        // Remembered on this device only, for this orientation (a no-op unless
        // the view changed).
        if (!engine.turning) writeOrientationView(engine.referenceId, engine.orientation, engine.viewport.getRememberedView());
        const cb = onViewChangeRef.current;
        if (!cb) return;
        const info: StageViewInfo = {
          scale: engine.viewport.getState().scale,
          fitScale: engine.viewport.getFitScale(),
          isRealSize: engine.viewport.isRealSize(),
          realSizeAvailable: engine.viewport.getRealScale() !== null,
          rotation,
        };
        const last = engine.lastInfo;
        if (
          last &&
          last.scale === info.scale &&
          last.fitScale === info.fitScale &&
          last.isRealSize === info.isRealSize &&
          last.realSizeAvailable === info.realSizeAvailable &&
          last.rotation === info.rotation
        )
          return;
        engine.lastInfo = info;
        cb(info);
      }

      engine.input = new InputController({
        element: container,
        viewport,
        onChange: () => {
          engine.restored = null;
          engine.dirty = true;
        },
        // Drawing a stroke and panning the canvas are mutually exclusive
        // gestures over the same pointer events -- while the Annotate tool is
        // active, pan/zoom is suppressed the same way Settings' (future)
        // Gesture Lock suppresses it, rather than fighting over the same drag.
        // Presentation mode locks gestures too, so a classroom display can't
        // be nudged out of framing by an accidental touch.
        // Only the focused pane takes tool input, so a parked pane keeps its
        // own free pan/zoom while the other one is annotated.
        // Touch Lock freezes the view outright. In the Draw tool the canvas
        // draws -- unless Pencil-only Drawing is on, when the fingers move the
        // view and only they reach the gesture engine (acceptsPointer below).
        isGestureLocked: () => {
          const state = useWorkspaceStore.getState();
          if (state.presentationMode || isTouchLocked()) return true;
          return !sessionRef.current && state.toolMode === 'annotate' && !isPencilOnly();
        },
        acceptsPointer: (pointerType) => {
          const drawing = !sessionRef.current && useWorkspaceStore.getState().toolMode === 'annotate';
          return !drawing || !isPencilOnly() || pointerType === 'touch';
        },
        // Lock rotation (device-local); the Paper tool always frames at 0°,
        // since a crop is an axis-aligned rectangle of the image.
        isRotationLocked: () => useDisplayStore.getState().rotationLocked || engine.mode === 'crop',
        prefersReducedMotion: () =>
          typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        // The crop is read off the view every frame: it must never overshoot.
        allowsZoomOvershoot: () => engine.mode !== 'crop',
      });
      engineRef.current = engine;
      applyRealScale();

      // Rescheduled *first*: if a draw ever throws (a bad value mid-edit), the
      // loop must survive it rather than freeze the canvas for good.
      function loop() {
        engine.raf = requestAnimationFrame(loop);
        if (!engine.dirty) return;
        engine.dirty = false;
        try {
          redraw();
          emitCrop();
          reportView();
        } catch (error) {
          console.error('Canvas redraw failed', error);
        }
      }
      engine.raf = requestAnimationFrame(loop);

      const unsubscribeDisplay = useDisplayStore.subscribe(() => {
        applyRealScale();
        engine.dirty = true;
      });
      const unsubscribeCheck = useCheckPhotoStore.subscribe(() => {
        engine.dirty = true;
      });
      const unsubscribeCellFocus = useCellFocusStore.subscribe(() => {
        engine.dirty = true;
      });
      const unsubscribeMeasure = useMeasureStore.subscribe(() => {
        engine.dirty = true;
      });

      // Pencil hover: a Pencil over the canvas with nothing pressed. It shows
      // in every mode and under Touch Lock; it goes as soon as the Pencil
      // touches down, lifts away or leaves the canvas.
      const onPenHover = (event: PointerEvent) => {
        if (event.pointerType !== 'pen') return;
        if (event.buttons !== 0) {
          clearHover(event);
          return;
        }
        const r = container.getBoundingClientRect();
        engine.hover = { x: event.clientX - r.left, y: event.clientY - r.top };
        engine.dirty = true;
      };
      const clearHover = (event: PointerEvent) => {
        if (event.pointerType !== 'pen' || !engine.hover) return;
        engine.hover = null;
        engine.dirty = true;
      };
      container.addEventListener('pointerover', onPenHover);
      container.addEventListener('pointermove', onPenHover);
      container.addEventListener('pointerdown', clearHover);
      container.addEventListener('pointerleave', clearHover);
      container.addEventListener('pointercancel', clearHover);

      const resizeObserver = new ResizeObserver(() => {
        const nextRect = container.getBoundingClientRect();
        const nextDpr = window.devicePixelRatio || 1;
        const nextWidth = Math.max(1, nextRect.width);
        const nextHeight = Math.max(1, nextRect.height);
        if (nextWidth === engine.cssWidth && nextHeight === engine.cssHeight && nextDpr === engine.dpr) return;
        for (const canvas of [imageCanvas, checkCanvas, gridCanvas, annotationCanvas]) {
          canvas.width = Math.max(1, Math.round(nextWidth * nextDpr));
          canvas.height = Math.max(1, Math.round(nextHeight * nextDpr));
        }
        engine.cssWidth = nextWidth;
        engine.cssHeight = nextHeight;
        engine.dpr = nextDpr;
        engine.viewport.resize(nextWidth, nextHeight);
        const orientation = windowOrientation();
        const place = engine.place;
        engine.place = null;
        engine.turning = false;
        if (orientation !== engine.orientation) {
          // Turned between landscape and portrait (or a Stage Manager window
          // reshaped past square): put back how this reference was last framed
          // in the new orientation, or fit it, square, the first time.
          engine.orientation = orientation;
          if (engine.mode === 'draw') {
            const view = readOrientationView(engine.referenceId, orientation) ?? { rotation: 0 };
            engine.input.engine.stopMotion();
            engine.viewport.restoreView(view);
            engine.restored = view;
          }
        } else if (place && engine.mode === 'draw') {
          // The same orientation, a new size (Split View, Slide Over, Stage
          // Manager): the same place stays in the middle of what is visible.
          engine.viewport.restoreView(place);
          engine.restored = place;
        }
        applyRealScale();
        // The crop frame depends on the viewport size: rebuild it on the next
        // draw. (The drawing view keeps its framing across a resize instead.)
        if (engine.mode === 'crop') engine.configuredContent = '';
        // Presentation mode's chrome removal changes the container size right
        // after the mode flips, so re-fit here too -- gestures are locked and
        // the viewer couldn't recover a good framing themselves.
        if (useWorkspaceStore.getState().presentationMode) engine.viewport.zoomToFit();
        engine.dirty = true;
      });
      resizeObserver.observe(container);
      const onWindowResize = () => noteWindowResize(engine);
      window.addEventListener('resize', onWindowResize);

      return () => {
        unsubscribeDisplay();
        unsubscribeCheck();
        unsubscribeCellFocus();
        unsubscribeMeasure();
        container.removeEventListener('pointerover', onPenHover);
        container.removeEventListener('pointermove', onPenHover);
        container.removeEventListener('pointerdown', clearHover);
        container.removeEventListener('pointerleave', clearHover);
        container.removeEventListener('pointercancel', clearHover);
        resizeObserver.disconnect();
        window.removeEventListener('resize', onWindowResize);
        cancelAnimationFrame(engine.raf);
        engine.input.dispose();
        engine.imageLayer.dispose();
        engineRef.current = null;
      };
    }, []);

    const storeBitmap = useWorkspaceStore((s) => s.workingBitmap);
    const storePaper = useWorkspaceStore((s) => s.paper);
    const storeEditStack = useWorkspaceStore((s) => s.editStack);
    const storeGridSettings = useWorkspaceStore((s) => s.gridSettings);
    const storeSecondaryGridConfig = useWorkspaceStore((s) => s.secondaryGridConfig);
    const storeAnnotations = useWorkspaceStore((s) => s.annotations);
    const workingBitmap = session ? session.workingBitmap : storeBitmap;
    const paper = session ? session.paper : storePaper;
    const editStack = session ? session.editStack : storeEditStack;
    const gridSettings = session ? session.gridSettings : storeGridSettings;
    const secondaryGridConfig = session ? session.secondaryGridConfig : storeSecondaryGridConfig;
    const annotations = session ? session.annotations : storeAnnotations;
    const toolMode = useWorkspaceStore((s) => s.toolMode);
    const presentationMode = useWorkspaceStore((s) => s.presentationMode);
    const cropSource = useWorkspaceStore((s) => s.cropSource);
    const framingDraft = useWorkspaceStore((s) => s.framingDraft);

    // A new bitmap, paper size, or the crop tool opening/closing/changing paper
    // rebuilds the view (syncEngine decides what actually needs redoing).
    // Adjustment/filter/grid-settings changes never reach this effect's
    // dependency list, matching ki-grid-image-independence: they only mark the
    // frame dirty, never touch the Viewport or geometry cache.
    useEffect(() => {
      const engine = engineRef.current;
      if (!engine || !workingBitmap) return;
      // A panel opening keeps the framing on screen, as it always has.
      engine.restored = null;
      engine.dirty = true;
    }, [workingBitmap, paper, toolMode, cropSource, framingDraft]);

    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.dirty = true;
    }, [editStack, gridSettings, secondaryGridConfig, annotations, isParked]);

    // Entering presentation mode re-fits the view, since gestures are locked
    // and the viewer couldn't otherwise recover a good framing.
    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.restored = null;
      if (presentationMode) engine.viewport.reset();
      engine.dirty = true;
    }, [presentationMode]);

    // Wires pointer capture for the Annotate tool onto its own (top) canvas --
    // only active in that tool mode, so every other mode's pan/zoom behaves
    // exactly as before.
    //
    // Who draws (GLOSSARY.md, "Input"): the first Pencil stroke switches
    // Pencil-only Drawing on, after which fingers never draw -- they fall
    // through to the gesture engine and move the view, so a resting palm leaves
    // no mark. Without it a finger draws as it always has, and a second finger
    // turns a finger stroke into a gesture (a two-finger tap undoes) instead.
    // Under Touch Lock the canvas takes nothing at all.
    useEffect(() => {
      const engine = engineRef.current;
      const canvas = annotationCanvasRef.current;
      const container = containerRef.current;
      if (!engine || !canvas || !container) return;

      if (toolMode !== 'annotate' || isParked) {
        canvas.style.pointerEvents = 'none';
        return;
      }
      canvas.style.pointerEvents = 'auto';

      // Annotations live in the paper's millimetre space and are stored
      // normalized to the paper, so a point is converted straight from CSS px.
      function contentPointFromEvent(event: PointerEvent): { x: number; y: number } {
        const rect = canvas!.getBoundingClientRect();
        return engine!.viewport.screenToImage({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }

      // The pointer drawing the current stroke or Measurement, and its type.
      let active: { id: number; type: string } | null = null;
      // Measure: the snapped axis once the drag has been held at its end.
      let measureAxis: MeasureAxis | null = null;
      const hold = new HoldDetector({
        onHold: () => {
          const measurement = useMeasureStore.getState().measurement;
          if (!active || !measurement || measureAxis) return;
          measureAxis = nearestAxis(measurement.start, measurement.end);
          const end = snapToAxis(measurement.start, measurement.end, measureAxis);
          useMeasureStore.getState().setMeasurement({ ...measurement, end, snapped: true });
        },
      });

      function cancelActive(): void {
        if (!active) return;
        if (canvas!.hasPointerCapture(active.id)) canvas!.releasePointerCapture(active.id);
        active = null;
        hold.stop();
        if (engine!.draft) {
          engine!.draft = null;
          engine!.dirty = true;
        }
        if (useWorkspaceStore.getState().annotationTool === 'measure') useMeasureStore.getState().setMeasurement(null);
      }

      function handlePointerDown(event: PointerEvent): void {
        if (isTouchLocked()) return;
        if (event.pointerType === 'pen') useInputStore.getState().pencilDetected();
        // Pencil-only Drawing: a finger is for the view, never a mark.
        if (event.pointerType === 'touch' && isPencilOnly()) return;
        if (active) {
          // A second finger on a finger stroke makes it a gesture; anything
          // landing beside a Pencil stroke (a palm) is ignored.
          if (event.pointerType === 'touch' && active.type === 'touch') cancelActive();
          return;
        }

        const { annotationTool, annotationColor, annotationThickness } = useWorkspaceStore.getState();
        const point = contentPointFromEvent(event);

        if (annotationTool === 'note') {
          // Without this, the browser's default mousedown focus change fires
          // right after the prompt input mounts and blurs it, closing the
          // prompt before the user can type.
          event.preventDefault();
          const containerRect = container!.getBoundingClientRect();
          setNotePrompt({
            cssX: event.clientX - containerRect.left,
            cssY: event.clientY - containerRect.top,
            normX: point.x / paper.widthMm,
            normY: point.y / paper.heightMm,
          });
          return;
        }

        try {
          canvas!.setPointerCapture(event.pointerId);
        } catch {
          // A pointer that is already gone can't be captured; the stroke still works.
        }
        active = { id: event.pointerId, type: event.pointerType };

        if (annotationTool === 'measure') {
          // The next measure replaces the last one.
          measureAxis = null;
          useMeasureStore
            .getState()
            .setMeasurement({ referenceId: useWorkspaceStore.getState().referenceId, start: point, end: point, snapped: false });
          hold.start({ x: event.clientX, y: event.clientY });
          return;
        }
        if (annotationTool === 'freehand') {
          engine!.draft = {
            type: 'freehand',
            id: 'draft',
            points: [{ x: point.x, y: point.y, pressure: event.pressure || undefined }],
            color: annotationColor,
            thickness: annotationThickness,
          };
        } else if (annotationTool === 'circle') {
          engine!.draft = {
            type: 'circle',
            id: 'draft',
            centerX: point.x,
            centerY: point.y,
            radiusX: 0,
            radiusY: 0,
            color: annotationColor,
            thickness: annotationThickness,
          };
        } else {
          engine!.draft = { type: 'arrow', id: 'draft', start: point, end: point, color: annotationColor, thickness: annotationThickness };
        }
        engine!.dirty = true;
      }

      function handlePointerMove(event: PointerEvent): void {
        if (!active || active.id !== event.pointerId) return;
        const point = contentPointFromEvent(event);
        const measurement = useMeasureStore.getState().measurement;
        if (useWorkspaceStore.getState().annotationTool === 'measure' && measurement) {
          const end = measureAxis ? snapToAxis(measurement.start, point, measureAxis) : point;
          useMeasureStore.getState().setMeasurement({ ...measurement, end });
          hold.move({ x: event.clientX, y: event.clientY });
          return;
        }
        const draft = engine!.draft;
        if (!draft) return;
        if (draft.type === 'freehand') draft.points.push({ x: point.x, y: point.y, pressure: event.pressure || undefined });
        else if (draft.type === 'circle') {
          draft.radiusX = Math.abs(point.x - draft.centerX);
          draft.radiusY = Math.abs(point.y - draft.centerY);
        } else if (draft.type === 'arrow') draft.end = point;
        engine!.dirty = true;
      }

      function handlePointerUp(event: PointerEvent): void {
        if (!active || active.id !== event.pointerId) return;
        active = null;
        hold.stop();
        if (canvas!.hasPointerCapture(event.pointerId)) canvas!.releasePointerCapture(event.pointerId);
        const measurement = useMeasureStore.getState().measurement;
        if (useWorkspaceStore.getState().annotationTool === 'measure') {
          // A tap with no drag measures nothing; a drag stays up until the next.
          if (measurement && measurement.start.x === measurement.end.x && measurement.start.y === measurement.end.y) {
            useMeasureStore.getState().setMeasurement(null);
          }
          return;
        }
        const draft = engine!.draft;
        engine!.draft = null;
        if (draft && paper.widthMm > 0 && paper.heightMm > 0) {
          const annotation = normalizeDraftAnnotation(draft, paper.widthMm, paper.heightMm);
          if (annotation) useWorkspaceStore.getState().addAnnotation(annotation);
        }
        engine!.dirty = true;
      }

      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerUp);
      return () => {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
        hold.stop();
        canvas.style.pointerEvents = 'none';
      };
    }, [toolMode, paper, isParked]);

    // Deferred a tick (rather than autoFocus) so focus lands after the
    // pointerdown/pointerup sequence that opened the prompt has fully finished.
    useEffect(() => {
      if (!notePrompt) return;
      const timer = setTimeout(() => noteInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }, [notePrompt]);

    function commitNote(): void {
      const prompt = notePrompt;
      setNotePrompt(null);
      const text = noteInputRef.current?.value.trim();
      if (!prompt || !text) return;
      const { annotationColor, annotationThickness, addAnnotation } = useWorkspaceStore.getState();
      const annotation: Annotation = {
        type: 'note',
        id: crypto.randomUUID(),
        position: { x: prompt.normX, y: prompt.normY },
        text,
        color: annotationColor,
        thickness: annotationThickness,
      };
      addAnnotation(annotation);
    }

    return (
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
        <canvas ref={imageCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas
          ref={checkCanvasRef}
          data-testid="check-photo-layer"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <canvas ref={gridCanvasRef} data-layer="grid" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas
          ref={annotationCanvasRef}
          data-layer="annotation"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
        />
        {notePrompt ? (
          <input
            ref={noteInputRef}
            placeholder="Note…"
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitNote();
              if (event.key === 'Escape') setNotePrompt(null);
            }}
            onBlur={commitNote}
            style={{
              position: 'absolute',
              left: notePrompt.cssX,
              top: notePrompt.cssY,
              minHeight: 'var(--touch-target-min)',
              padding: '0 var(--space-sm)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-family-body)',
              fontSize: 'var(--font-body-size)',
              zIndex: 1,
            }}
          />
        ) : null}
      </div>
    );
  },
);

// Puts new insets into effect. In the crop tool the frame is centred in the
// visible region, so it is rebuilt on the next draw -- and the image is put back
// where the *current crop* says it belongs, so a panel opening or closing never
// changes what the user has framed.
function applyInsets(engine: Engine, insets: ViewportInsets): void {
  // The chrome for a new window size can arrive before the window's resize
  // event: take the artist's place before the new insets move it.
  noteWindowResize(engine);
  engine.insets = insets;
  engine.viewport.setInsets(insets);
  if (engine.restored && engine.mode === 'draw') engine.viewport.restoreView(engine.restored);
  if (engine.mode === 'crop') {
    engine.configuredContent = '';
    engine.lastEmittedCrop = null;
  }
  engine.dirty = true;
}

// The window has changed size (seen from its resize event, or from the chrome
// it brought, whichever comes first): take the artist's place before the canvas
// or the chrome moves it, so the resize can put it back. When the window has
// turned, that place is the old orientation's view: remembered now, and not
// overwritten by frames drawn before the canvas catches up.
function noteWindowResize(engine: Engine): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width === engine.windowWidth && height === engine.windowHeight) return;
  engine.windowWidth = width;
  engine.windowHeight = height;
  if (engine.mode !== 'draw') return;
  const place = engine.place ?? engine.restored ?? engine.viewport.getRememberedView();
  engine.place = place;
  const turning = viewOrientation(width, height) !== engine.orientation;
  if (turning && !engine.turning) writeOrientationView(engine.referenceId, engine.orientation, place);
  engine.turning = turning;
}

// The crop frame, centred in the part of the canvas that chrome does not cover.
function frameInVisibleRegion(engine: Engine, aspect: number): FrameRect {
  const { left, top, right, bottom } = engine.insets;
  const width = Math.max(1, engine.cssWidth - left - right);
  const height = Math.max(1, engine.cssHeight - top - bottom);
  const frame = frameInViewport(width, height, aspect, CROP_FRAME_MARGIN);
  return { x: frame.x + left, y: frame.y + top, w: frame.w, h: frame.h };
}

// Brings the engine's image source, viewport content and limits in line with
// what should be shown right now, doing only what changed. Runs at the top of
// every redraw, so a mode switch, a new bitmap, a new paper or a resized
// viewport is picked up on the very next frame.
function syncEngine(engine: Engine, state: ViewData): void {
  if (isCropping(state)) {
    const { framingDraft, cropSource, orientedWidth, orientedHeight } = state;
    const draft = framingDraft as FramingDraft;
    const source = cropSource as ImageBitmap;
    const frame = frameInVisibleRegion(engine, paperAspect(draft.paper));
    const content = `crop:${orientedWidth}x${orientedHeight}:${frame.x},${frame.y},${frame.w},${frame.h}`;

    if (engine.mode !== 'crop' || engine.configuredBitmap !== source) {
      engine.imageLayer.setSource(source);
      engine.imageLayer.setContentSize(orientedWidth, orientedHeight);
      engine.viewport.setConstraint(null);
      engine.viewport.setContentSize(orientedWidth, orientedHeight);
      engine.mode = 'crop';
      engine.configuredBitmap = source;
      engine.configuredContent = '';
      engine.lastEmittedCrop = null;
    }
    // The frame moved (paper aspect or viewport size changed) or the crop changed
    // from outside this pane: rebuild the limits and put the image where the
    // draft crop says it should be.
    if (engine.configuredContent !== content || draft.crop !== engine.lastEmittedCrop) {
      engine.frame = frame;
      engine.viewport.setConstraint(createCropConstraint(orientedWidth, orientedHeight, frame));
      if (draft.crop !== engine.lastEmittedCrop) {
        engine.viewport.setState(toViewportState(viewFromCrop(draft.crop, frame)));
        engine.lastEmittedCrop = draft.crop;
      }
      engine.configuredContent = content;
    }
    return;
  }

  const { paper, workingBitmap } = state;
  const content = `draw:${paper.widthMm}x${paper.heightMm}`;
  if (engine.mode !== 'draw' || engine.configuredBitmap !== workingBitmap || engine.configuredContent !== content) {
    if (workingBitmap) engine.imageLayer.setSource(workingBitmap);
    engine.imageLayer.setContentSize(paper.widthMm, paper.heightMm);
    engine.viewport.setConstraint(null);
    engine.viewport.setContentSize(paper.widthMm, paper.heightMm);
    // Fitted at this reference's remembered View Rotation for the current
    // orientation: restored on reload and on leaving the Paper tool (which
    // frames at 0°).
    engine.referenceId = state.referenceId;
    engine.restored = null;
    engine.viewport.zoomToFit(readOrientationView(state.referenceId, engine.orientation)?.rotation ?? 0);
    engine.mode = 'draw';
    engine.configuredBitmap = workingBitmap;
    engine.configuredContent = content;
    engine.frame = null;
    engine.lastEmittedCrop = null;
  }
}

// Landscape when the window is wider than tall. The window, not this pane: a
// split-view pane is tall and narrow whichever way the iPad is turned.
function windowOrientation(): ViewOrientation {
  return viewOrientation(window.innerWidth, window.innerHeight);
}

// High-contrast display override for presentation/classroom mode: full opacity
// and at least a "thick" line so the grid reads from across a room. Applied at
// draw time only -- the stored settings are never touched.
function presentationSettings(settings: GridSettings, presentationMode: boolean): GridSettings {
  if (!presentationMode) return settings;
  return {
    ...settings,
    style: { ...settings.style, opacity: 1, widthPx: Math.max(settings.style.widthPx, PRESENTATION_MIN_LINE_PX) },
  };
}

// The same override for the Guides layer's (legacy 0..100, enum thickness) style.
function presentationStyle(config: GridConfig, presentationMode: boolean): GridConfig {
  if (!presentationMode) return config;
  const boosted = config.thickness === 'veryThin' || config.thickness === 'thin' || config.thickness === 'medium';
  return { ...config, opacity: 100, thickness: boosted ? 'thick' : config.thickness };
}

// Guide geometry is generated over the paper in mm and cached: pan/zoom must
// never regenerate it (ki-grid-image-independence).
function getCachedGridGeometry(cache: GeometryCache, width: number, height: number, config: GridConfig): GridGeometry {
  const key = `${width}x${height}:${JSON.stringify(config)}`;
  if (cache.current?.key === key) return cache.current.geometry;
  const geometry = generateGridGeometry(width, height, config);
  cache.current = { key, geometry };
  return geometry;
}

// Same "resolve once per redraw, not per frame" cache as the grid geometry
// above -- pan/zoom must never re-resolve annotations (ki-grid-image-
// independence's pattern extended to the annotation overlay).
function getCachedAnnotationGeometry(
  cache: AnnotationCache,
  width: number,
  height: number,
  annotations: Annotation[],
): ResolvedAnnotation[] {
  const key = `${width}x${height}:${JSON.stringify(annotations)}`;
  if (cache.current?.key === key) return cache.current.resolved;
  const resolved = resolveAnnotationGeometry(width, height, annotations);
  cache.current = { key, resolved };
  return resolved;
}

// Converts an in-progress draft (paper millimetres, built up while dragging)
// into a persistable Annotation (normalized [0,1] against the paper) on
// pointer-up. Returns null for a degenerate/accidental gesture (a click with no
// drag) so it's never committed as a zero-length annotation.
function normalizeDraftAnnotation(draft: ResolvedAnnotation, width: number, height: number): Annotation | null {
  const id = crypto.randomUUID();
  switch (draft.type) {
    case 'arrow': {
      if (draft.start.x === draft.end.x && draft.start.y === draft.end.y) return null;
      return {
        type: 'arrow',
        id,
        start: { x: draft.start.x / width, y: draft.start.y / height },
        end: { x: draft.end.x / width, y: draft.end.y / height },
        color: draft.color,
        thickness: draft.thickness,
      };
    }
    case 'circle': {
      // Under a millimetre in both directions is an accidental tap, not a circle.
      if (draft.radiusX < 1 && draft.radiusY < 1) return null;
      return {
        type: 'circle',
        id,
        center: { x: draft.centerX / width, y: draft.centerY / height },
        radiusX: draft.radiusX / width,
        radiusY: draft.radiusY / height,
        color: draft.color,
        thickness: draft.thickness,
      };
    }
    case 'freehand': {
      if (draft.points.length < 2) return null;
      return {
        type: 'freehand',
        id,
        points: draft.points.map((point) => ({ x: point.x / width, y: point.y / height, pressure: point.pressure })),
        color: draft.color,
        thickness: draft.thickness,
      };
    }
    case 'note':
      // Notes never go through the draft/drag path -- they're placed and
      // committed directly via CanvasStage's inline text prompt.
      return null;
  }
}
