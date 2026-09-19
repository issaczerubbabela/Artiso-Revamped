'use client';

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  cropFromView,
  deriveAdjustments,
  frameInViewport,
  generateGridGeometry,
  paperAspect,
  physicalPpi,
  pxPerMmCss,
  resolveAnnotationGeometry,
  viewFromCrop,
  type FrameRect,
  type GridGeometry,
  type ResolvedAnnotation,
} from '@artiso/core-engine';
import {
  AnnotationLayer,
  DrawingGridLayer,
  GridLayer,
  ImageLayer,
  InputController,
  NO_INSETS,
  Viewport,
  createCropConstraint,
  drawCropFrame,
  type GridDrawLayer,
  type ViewportInsets,
  type ViewportOptions,
  type ViewportState,
} from '@artiso/renderer';
import type { Annotation, Crop, GridConfig, GridSettings, Paper } from '@artiso/shared-types';
import { useDisplayStore } from '@/state/display-store';
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
}

// What a pane's controls can do to its own view. Each pane in a split view has
// its own viewport, so the controls act per pane rather than through a global.
export interface CanvasStageHandle {
  fit: () => void;
  // Zooms to 1 mm on paper = 1 mm on the screen; false if not calibrated yet.
  realSize: () => boolean;
}

interface Engine {
  viewport: Viewport;
  imageLayer: ImageLayer;
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
  return { scale: view.scale, translateX: view.tx, translateY: view.ty };
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
          engine.viewport.zoomToFit();
          engine.dirty = true;
        },
        realSize: () => {
          const engine = engineRef.current;
          if (!engine) return false;
          const ok = engine.viewport.setRealSize();
          engine.dirty = true;
          return ok;
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
      const gridCanvas = gridCanvasRef.current;
      const annotationCanvas = annotationCanvasRef.current;
      const initial = readView(sessionRef.current);
      if (!container || !imageCanvas || !gridCanvas || !annotationCanvas || !initial.workingBitmap) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const cssWidth = Math.max(1, rect.width);
      const cssHeight = Math.max(1, rect.height);
      for (const canvas of [imageCanvas, gridCanvas, annotationCanvas]) {
        canvas.width = Math.max(1, Math.round(cssWidth * dpr));
        canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      }

      const viewport = new Viewport(cssWidth, cssHeight, initial.paper.widthMm, initial.paper.heightMm, DRAW_VIEWPORT);
      viewport.setInsets(insetsRef.current);
      const imageLayer = new ImageLayer(imageCanvas);
      // Two passes share the grid canvas: the guides beneath, then the grid.
      const gridLayer = new GridLayer(gridCanvas);
      const drawingGridLayer = new DrawingGridLayer(gridCanvas);
      const annotationLayer = new AnnotationLayer(annotationCanvas);

      const engine: Engine = {
        viewport,
        imageLayer,
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
          const { paper } = state.framingDraft;
          engine.drawingGridLayer.draw(
            {
              paper,
              settings: state.gridSettings,
              view: { scale: engine.frame.w / paper.widthMm, translateX: engine.frame.x, translateY: engine.frame.y },
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
          return;
        }

        const { paper, presentationMode } = state;
        engine.imageLayer.draw(view, w, h, adjustments, ratio);

        const labelScale = presentationMode ? PRESENTATION_LABEL_SCALE : 1;
        const hasGuide = state.secondaryGridConfig !== null;
        if (state.secondaryGridConfig) {
          const geometry = getCachedGridGeometry(geometryCacheRef, paper.widthMm, paper.heightMm, state.secondaryGridConfig);
          const layers: GridDrawLayer[] = [
            { geometry, config: presentationStyle(state.secondaryGridConfig, presentationMode) },
          ];
          engine.gridLayer.draw(layers, view, w, h, { labelScale, pixelRatio: ratio });
        }
        engine.drawingGridLayer.draw(
          { paper, settings: presentationSettings(state.gridSettings, presentationMode), view, width: w, height: h },
          { pixelRatio: ratio, labelScale, clear: !hasGuide },
        );

        const resolved = getCachedAnnotationGeometry(annotationCacheRef, paper.widthMm, paper.heightMm, state.annotations);
        engine.annotationLayer.draw(resolved, engine.draft, view, w, h, ratio);
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
        const cb = onViewChangeRef.current;
        if (!cb || engine.mode !== 'draw') return;
        const info: StageViewInfo = {
          scale: engine.viewport.getState().scale,
          fitScale: engine.viewport.getFitScale(),
          isRealSize: engine.viewport.isRealSize(),
          realSizeAvailable: engine.viewport.getRealScale() !== null,
        };
        const last = engine.lastInfo;
        if (
          last &&
          last.scale === info.scale &&
          last.fitScale === info.fitScale &&
          last.isRealSize === info.isRealSize &&
          last.realSizeAvailable === info.realSizeAvailable
        )
          return;
        engine.lastInfo = info;
        cb(info);
      }

      engine.input = new InputController({
        element: container,
        viewport,
        onChange: () => {
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
        isGestureLocked: () => {
          const state = useWorkspaceStore.getState();
          return state.presentationMode || (!sessionRef.current && state.toolMode === 'annotate');
        },
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

      const resizeObserver = new ResizeObserver(() => {
        const nextRect = container.getBoundingClientRect();
        const nextDpr = window.devicePixelRatio || 1;
        const nextWidth = Math.max(1, nextRect.width);
        const nextHeight = Math.max(1, nextRect.height);
        if (nextWidth === engine.cssWidth && nextHeight === engine.cssHeight && nextDpr === engine.dpr) return;
        for (const canvas of [imageCanvas, gridCanvas, annotationCanvas]) {
          canvas.width = Math.max(1, Math.round(nextWidth * nextDpr));
          canvas.height = Math.max(1, Math.round(nextHeight * nextDpr));
        }
        engine.cssWidth = nextWidth;
        engine.cssHeight = nextHeight;
        engine.dpr = nextDpr;
        engine.viewport.resize(nextWidth, nextHeight);
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

      return () => {
        unsubscribeDisplay();
        resizeObserver.disconnect();
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
      if (presentationMode) engine.viewport.reset();
      engine.dirty = true;
    }, [presentationMode]);

    // Wires pointer capture for the Annotate tool onto its own (top) canvas --
    // only active in that tool mode, so every other mode's pan/zoom behaves
    // exactly as before.
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

      function handlePointerDown(event: PointerEvent): void {
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

        canvas!.setPointerCapture(event.pointerId);
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
        const draft = engine!.draft;
        if (!draft) return;
        const point = contentPointFromEvent(event);
        if (draft.type === 'freehand') draft.points.push({ x: point.x, y: point.y, pressure: event.pressure || undefined });
        else if (draft.type === 'circle') {
          draft.radiusX = Math.abs(point.x - draft.centerX);
          draft.radiusY = Math.abs(point.y - draft.centerY);
        } else if (draft.type === 'arrow') draft.end = point;
        engine!.dirty = true;
      }

      function handlePointerUp(event: PointerEvent): void {
        const draft = engine!.draft;
        engine!.draft = null;
        if (canvas!.hasPointerCapture(event.pointerId)) canvas!.releasePointerCapture(event.pointerId);
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
        <canvas ref={gridCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <canvas
          ref={annotationCanvasRef}
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
  engine.insets = insets;
  engine.viewport.setInsets(insets);
  if (engine.mode === 'crop') {
    engine.configuredContent = '';
    engine.lastEmittedCrop = null;
  }
  engine.dirty = true;
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
    engine.mode = 'draw';
    engine.configuredBitmap = workingBitmap;
    engine.configuredContent = content;
    engine.frame = null;
    engine.lastEmittedCrop = null;
  }
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
