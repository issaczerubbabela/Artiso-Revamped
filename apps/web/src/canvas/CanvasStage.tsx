'use client';

import { useEffect, useRef } from 'react';
import { deriveAdjustments, generateGridGeometry, type GridGeometry } from '@artiso/core-engine';
import { GridLayer, ImageLayer, InputController, Viewport, type GridDrawLayer } from '@artiso/renderer';
import type { GridConfig } from '@artiso/shared-types';
import { useWorkspaceStore } from '@/state/workspace-store';

interface Engine {
  viewport: Viewport;
  imageLayer: ImageLayer;
  gridLayer: GridLayer;
  input: InputController;
  pixelWidth: number;
  pixelHeight: number;
  dirty: boolean;
  raf: number;
}

type GeometryCache = { current: { key: string; geometry: GridGeometry } | null };

// The canvas mount point (docs/architecture/05-canvas-renderer.md): two
// stacked canvases (WebGL image layer below, Canvas2D grid layer above) plus
// a requestAnimationFrame dirty-flag loop so pan/zoom repaints happen
// without forcing a React re-render on every pointer move.
export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const geometryCacheRef = useRef<{ key: string; geometry: GridGeometry } | null>(null);
  const secondaryGeometryCacheRef = useRef<{ key: string; geometry: GridGeometry } | null>(null);

  // Mounted exactly once: Viewport (and therefore the user's current pan/zoom)
  // survives every later adjustment, grid-config, or geometry-op change --
  // only this component unmounting (switching away from the reference
  // entirely) resets it.
  useEffect(() => {
    const container = containerRef.current;
    const imageCanvas = imageCanvasRef.current;
    const gridCanvas = gridCanvasRef.current;
    const initial = useWorkspaceStore.getState();
    if (!container || !imageCanvas || !gridCanvas || !initial.workingBitmap) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
    imageCanvas.width = pixelWidth;
    imageCanvas.height = pixelHeight;
    gridCanvas.width = pixelWidth;
    gridCanvas.height = pixelHeight;

    const viewport = new Viewport(pixelWidth, pixelHeight, initial.workingWidth, initial.workingHeight);
    const imageLayer = new ImageLayer(imageCanvas);
    const gridLayer = new GridLayer(gridCanvas);
    imageLayer.setSource(initial.workingBitmap);

    const engine: Engine = {
      viewport,
      imageLayer,
      gridLayer,
      input: undefined as unknown as InputController,
      pixelWidth,
      pixelHeight,
      dirty: true,
      raf: 0,
    };

    function redraw() {
      const state = useWorkspaceStore.getState();
      if (!state.workingBitmap) return;
      const adjustments = deriveAdjustments(state.editStack);
      engine.imageLayer.draw(engine.viewport.getState(), engine.pixelWidth, engine.pixelHeight, adjustments);
      const geometry = getCachedGridGeometry(
        geometryCacheRef,
        state.workingWidth,
        state.workingHeight,
        state.gridConfig,
      );
      const layers: GridDrawLayer[] = [{ geometry, config: state.gridConfig }];
      if (state.secondaryGridConfig) {
        const secondaryGeometry = getCachedGridGeometry(
          secondaryGeometryCacheRef,
          state.workingWidth,
          state.workingHeight,
          state.secondaryGridConfig,
        );
        layers.push({ geometry: secondaryGeometry, config: state.secondaryGridConfig });
      }
      engine.gridLayer.draw(layers, engine.viewport.getState(), engine.pixelWidth, engine.pixelHeight);
    }

    engine.input = new InputController({
      element: container,
      viewport,
      onChange: () => {
        engine.dirty = true;
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
      engine.pixelWidth = nextWidth;
      engine.pixelHeight = nextHeight;
      engine.viewport.resize(nextWidth, nextHeight);
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

  const workingBitmap = useWorkspaceStore((s) => s.workingBitmap);
  const workingWidth = useWorkspaceStore((s) => s.workingWidth);
  const workingHeight = useWorkspaceStore((s) => s.workingHeight);
  const editStack = useWorkspaceStore((s) => s.editStack);
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const secondaryGridConfig = useWorkspaceStore((s) => s.secondaryGridConfig);
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
  }, [editStack, gridConfig, secondaryGridConfig]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || viewportResetSignal === 0) return;
    engine.viewport.reset();
    engine.dirty = true;
  }, [viewportResetSignal]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <canvas ref={imageCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas ref={gridCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
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
