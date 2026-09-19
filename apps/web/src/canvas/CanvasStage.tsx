'use client';

import { useEffect, useRef, useState } from 'react';
import { deriveAdjustments, generateGridGeometry, resolveAnnotationGeometry, type GridGeometry, type ResolvedAnnotation } from '@artiso/core-engine';
import { AnnotationLayer, GridLayer, ImageLayer, InputController, Viewport, type GridDrawLayer } from '@artiso/renderer';
import type { Annotation, GridConfig } from '@artiso/shared-types';
import { useWorkspaceStore, type PaneSession } from '@/state/workspace-store';

interface Engine {
  viewport: Viewport;
  imageLayer: ImageLayer;
  gridLayer: GridLayer;
  annotationLayer: AnnotationLayer;
  input: InputController;
  pixelWidth: number;
  pixelHeight: number;
  dirty: boolean;
  raf: number;
  draft: ResolvedAnnotation | null;
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
  workingWidth: number;
  workingHeight: number;
  editStack: PaneSession['editStack'];
  gridConfig: GridConfig;
  secondaryGridConfig: GridConfig | null;
  annotations: Annotation[];
  presentationMode: boolean;
}

// What this pane draws: a parked split-view session if one was passed in,
// otherwise the workspace store's live (focused) session. Presentation mode
// is workspace-wide either way.
function readView(session: PaneSession | undefined): ViewData {
  const store = useWorkspaceStore.getState();
  const source = session ?? store;
  return {
    workingBitmap: source.workingBitmap,
    workingWidth: source.workingWidth,
    workingHeight: source.workingHeight,
    editStack: source.editStack,
    gridConfig: source.gridConfig,
    secondaryGridConfig: source.secondaryGridConfig,
    annotations: source.annotations,
    presentationMode: store.presentationMode,
  };
}

// The canvas mount point (docs/architecture/05-canvas-renderer.md): three
// stacked canvases (WebGL image layer, Canvas2D grid layer, Canvas2D
// annotation layer) plus a requestAnimationFrame dirty-flag loop so pan/zoom
// repaints happen without forcing a React re-render on every pointer move.
//
// `session` is set for a split view's parked (non-focused) pane, which draws
// that snapshot with its own independent pan/zoom and takes no tool input;
// the focused pane omits it and reads the live workspace store.
export function CanvasStage({ session }: { session?: PaneSession } = {}) {
  const sessionRef = useRef(session);
  const isParked = session !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const geometryCacheRef = useRef<{ key: string; geometry: GridGeometry } | null>(null);
  const secondaryGeometryCacheRef = useRef<{ key: string; geometry: GridGeometry } | null>(null);
  const annotationCacheRef = useRef<{ key: string; resolved: ResolvedAnnotation[] } | null>(null);
  const [notePrompt, setNotePrompt] = useState<NotePrompt | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    imageCanvas.width = pixelWidth;
    imageCanvas.height = pixelHeight;
    gridCanvas.width = pixelWidth;
    gridCanvas.height = pixelHeight;
    annotationCanvas.width = pixelWidth;
    annotationCanvas.height = pixelHeight;

    const viewport = new Viewport(pixelWidth, pixelHeight, initial.workingWidth, initial.workingHeight);
    const imageLayer = new ImageLayer(imageCanvas);
    const gridLayer = new GridLayer(gridCanvas);
    const annotationLayer = new AnnotationLayer(annotationCanvas);
    imageLayer.setSource(initial.workingBitmap);

    const engine: Engine = {
      viewport,
      imageLayer,
      gridLayer,
      annotationLayer,
      input: undefined as unknown as InputController,
      pixelWidth,
      pixelHeight,
      dirty: true,
      raf: 0,
      draft: null,
    };

    function redraw() {
      const state = readView(sessionRef.current);
      if (!state.workingBitmap) return;
      const adjustments = deriveAdjustments(state.editStack);
      engine.imageLayer.draw(engine.viewport.getState(), engine.pixelWidth, engine.pixelHeight, adjustments);

      const geometry = getCachedGridGeometry(geometryCacheRef, state.workingWidth, state.workingHeight, state.gridConfig);
      const layers: GridDrawLayer[] = [{ geometry, config: presentationStyle(state.gridConfig, state.presentationMode) }];
      if (state.secondaryGridConfig) {
        const secondaryGeometry = getCachedGridGeometry(
          secondaryGeometryCacheRef,
          state.workingWidth,
          state.workingHeight,
          state.secondaryGridConfig,
        );
        layers.push({
          geometry: secondaryGeometry,
          config: presentationStyle(state.secondaryGridConfig, state.presentationMode),
        });
      }
      engine.gridLayer.draw(layers, engine.viewport.getState(), engine.pixelWidth, engine.pixelHeight, {
        labelScale: state.presentationMode ? PRESENTATION_LABEL_SCALE : 1,
      });

      const resolved = getCachedAnnotationGeometry(annotationCacheRef, state.workingWidth, state.workingHeight, state.annotations);
      engine.annotationLayer.draw(resolved, engine.draft, engine.viewport.getState(), engine.pixelWidth, engine.pixelHeight);
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

    function loop() {
      if (engine.dirty) {
        redraw();
        engine.dirty = false;
      }
      engine.raf = requestAnimationFrame(loop);
    }
    engine.raf = requestAnimationFrame(loop);

    const resizeObserver = new ResizeObserver(() => {
      const nextRect = container.getBoundingClientRect();
      const nextDpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(nextRect.width * nextDpr));
      const nextHeight = Math.max(1, Math.round(nextRect.height * nextDpr));
      if (nextWidth === engine.pixelWidth && nextHeight === engine.pixelHeight) return;
      imageCanvas.width = nextWidth;
      imageCanvas.height = nextHeight;
      gridCanvas.width = nextWidth;
      gridCanvas.height = nextHeight;
      annotationCanvas.width = nextWidth;
      annotationCanvas.height = nextHeight;
      engine.pixelWidth = nextWidth;
      engine.pixelHeight = nextHeight;
      engine.viewport.resize(nextWidth, nextHeight);
      // Presentation mode's chrome removal changes the container size right
      // after the mode flips, so re-fit here too -- gestures are locked and
      // the viewer couldn't recover a good framing themselves.
      if (useWorkspaceStore.getState().presentationMode) engine.viewport.zoomToFit();
      engine.dirty = true;
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(engine.raf);
      engine.input.dispose();
      engine.imageLayer.dispose();
      engineRef.current = null;
    };
  }, []);

  const storeBitmap = useWorkspaceStore((s) => s.workingBitmap);
  const storeWidth = useWorkspaceStore((s) => s.workingWidth);
  const storeHeight = useWorkspaceStore((s) => s.workingHeight);
  const storeEditStack = useWorkspaceStore((s) => s.editStack);
  const storeGridConfig = useWorkspaceStore((s) => s.gridConfig);
  const storeSecondaryGridConfig = useWorkspaceStore((s) => s.secondaryGridConfig);
  const storeAnnotations = useWorkspaceStore((s) => s.annotations);
  const workingBitmap = session ? session.workingBitmap : storeBitmap;
  const workingWidth = session ? session.workingWidth : storeWidth;
  const workingHeight = session ? session.workingHeight : storeHeight;
  const editStack = session ? session.editStack : storeEditStack;
  const gridConfig = session ? session.gridConfig : storeGridConfig;
  const secondaryGridConfig = session ? session.secondaryGridConfig : storeSecondaryGridConfig;
  const annotations = session ? session.annotations : storeAnnotations;
  const toolMode = useWorkspaceStore((s) => s.toolMode);
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  const viewportResetSignal = useWorkspaceStore((s) => s.viewportResetSignal);

  // A committed geometry op (crop/rotate/flip) swaps the bitmap -- re-fit the
  // view to it. Adjustment/filter/grid-config changes never reach this
  // effect's dependency list, matching ki-grid-image-independence: they only
  // mark the frame dirty, never touch the Viewport or geometry cache.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !workingBitmap) return;
    engine.imageLayer.setSource(workingBitmap);
    engine.viewport.setContentSize(workingWidth, workingHeight);
    engine.dirty = true;
  }, [workingBitmap, workingWidth, workingHeight]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.dirty = true;
  }, [editStack, gridConfig, secondaryGridConfig, annotations, isParked]);

  // Entering presentation mode re-fits the view, since gestures are locked
  // and the viewer couldn't otherwise recover a good framing.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (presentationMode) engine.viewport.reset();
    engine.dirty = true;
  }, [presentationMode]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || viewportResetSignal === 0 || isParked) return;
    engine.viewport.reset();
    engine.dirty = true;
  }, [viewportResetSignal, isParked]);

  // Wires pointer capture for the Annotate tool onto its own (top) canvas --
  // only active in that tool mode, so every other mode's pan/zoom and DOM
  // overlays (e.g. CropOverlay) behave exactly as before.
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

    const dpr = window.devicePixelRatio || 1;

    function imagePointFromEvent(event: PointerEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return engine!.viewport.screenToImage({ x: (event.clientX - rect.left) * dpr, y: (event.clientY - rect.top) * dpr });
    }

    function handlePointerDown(event: PointerEvent): void {
      const { annotationTool, annotationColor, annotationThickness } = useWorkspaceStore.getState();
      const point = imagePointFromEvent(event);

      if (annotationTool === 'note') {
        // Without this, the browser's default mousedown focus change fires
        // right after the prompt input mounts and blurs it, closing the
        // prompt before the user can type.
        event.preventDefault();
        const containerRect = container!.getBoundingClientRect();
        setNotePrompt({
          cssX: event.clientX - containerRect.left,
          cssY: event.clientY - containerRect.top,
          normX: point.x / workingWidth,
          normY: point.y / workingHeight,
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
      const point = imagePointFromEvent(event);
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
      if (draft && workingWidth > 0 && workingHeight > 0) {
        const annotation = normalizeDraftAnnotation(draft, workingWidth, workingHeight);
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
  }, [toolMode, workingWidth, workingHeight, isParked]);

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
            fontFamily: 'var(--font-family-base)',
            fontSize: 'var(--font-body-size)',
            zIndex: 1,
          }}
        />
      ) : null}
    </div>
  );
}

const PRESENTATION_LABEL_SCALE = 2;

// High-contrast display override for presentation/classroom mode: full
// opacity and at least "thick" lines so the grid reads from across a room.
// Applied at draw time only -- the stored GridConfig is never touched.
function presentationStyle(config: GridConfig, presentationMode: boolean): GridConfig {
  if (!presentationMode) return config;
  const boosted = config.thickness === 'veryThin' || config.thickness === 'thin' || config.thickness === 'medium';
  return { ...config, opacity: 100, thickness: boosted ? 'thick' : config.thickness };
}

// Which fields affect geometry differs per grid type (rows/cols for
// rectangular, rings/spokes for radial, ...), so rather than enumerate them
// per type here, the cache key just serializes the whole config -- it's a
// small object and this only runs once per redraw, not per frame.
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

// Converts an in-progress draft (image-space pixels, built up while
// dragging) into a persistable Annotation (normalized [0,1]) on pointer-up.
// Returns null for a degenerate/accidental gesture (a click with no drag) so
// it's never committed as a zero-length annotation.
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
