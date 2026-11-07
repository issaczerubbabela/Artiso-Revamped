'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { LongPressDetector, NO_INSETS } from '@artiso/renderer';
import { CanvasStage, type CanvasStageHandle, type StageViewInfo } from '@/canvas/CanvasStage';
import { useChromeInsets } from '@/components/chrome/chrome-insets';
import type { PaneSession } from '@/state/workspace-store';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { ZoomPill } from './ZoomPill';
import { CanvasMenu, type CanvasMenuItem } from './CanvasMenu';

// Where a pane's zoom pill sits when nothing floats over that corner.
const PILL_MARGIN_PX = 16;

// One pane: its canvas plus its own view controls. Each pane in a split view has
// its own viewport, so Fit and Real size act on this pane's canvas and nothing
// else. `session` is the parked pane's snapshot; the focused pane omits it.
//
// The pane fills its container edge to edge and floating chrome sits over it, so
// it measures which part of itself that chrome covers and tells the canvas to
// fit inside the rest (docs/architecture/06-workspace-interaction.md, "Inset-
// aware view"). Presentation mode has no chrome, so it fits the whole pane.
export function PaneStage({ session }: { session?: PaneSession }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<CanvasStageHandle>(null);
  const [info, setInfo] = useState<StageViewInfo | null>(null);
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  // The controls belong to the drawing view; the Paper & crop tool has its own.
  const cropping = useWorkspaceStore((s) => !session && s.toolMode === 'paper');
  const screen = useDisplayStore((s) => s.screen);
  const openCalibration = useDisplayStore((s) => s.openCalibration);
  const measured = useChromeInsets(paneRef);
  const insets = presentationMode ? NO_INSETS : measured.insets;
  const clearance = presentationMode ? NO_INSETS : measured.clearance;
  // Real size was asked for before the screen was calibrated: once the
  // calibration is saved, carry on and zoom to it.
  const wantsRealSize = useRef(false);

  const calibrationOpen = useDisplayStore((s) => s.calibrationOpen);
  const gridHidden = useDisplayStore((s) => s.gridHidden);
  const setGridHidden = useDisplayStore((s) => s.setGridHidden);
  // The canvas menu, open at this client point.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  // Where the canvas menu may open from. Not in the Paper tool (its drags frame
  // the crop), not in Presentation mode (no chrome, and a classroom display
  // must not pop up menus), and a long-press not while the Draw tool is drawing.
  const menuAllowed = useCallback(
    (via: 'press' | 'click') => {
      const state = useWorkspaceStore.getState();
      if (state.presentationMode) return false;
      if (!session && state.toolMode === 'paper') return false;
      if (via === 'press' && !session && state.toolMode === 'annotate') return false;
      return true;
    },
    [session],
  );

  // The centre of the part of this pane the chrome leaves visible: where a
  // keyboard-opened menu appears.
  const visibleCentre = useCallback(() => {
    const el = paneRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const i = insetsRef.current;
    return { x: r.left + i.left + (r.width - i.left - i.right) / 2, y: r.top + i.top + (r.height - i.top - i.bottom) / 2 };
  }, []);

  // Long-press (touch or Pencil) opens the menu where the finger is.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const detector = new LongPressDetector({ onLongPress: (point) => setMenuAt(point) });
    const onCanvas = (event: PointerEvent) => !(event.target as Element | null)?.closest('.zoom-pill, .canvas-menu');
    const down = (event: PointerEvent) => {
      if (!onCanvas(event) || !menuAllowed('press')) {
        detector.cancel();
        return;
      }
      detector.pointerDown(event.pointerId, { x: event.clientX, y: event.clientY }, event.pointerType);
    };
    const move = (event: PointerEvent) => detector.pointerMove(event.pointerId, { x: event.clientX, y: event.clientY });
    const up = (event: PointerEvent) => detector.pointerUp(event.pointerId);
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', up, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', up, true);
      detector.dispose();
    };
  }, [menuAllowed]);

  // Right-click, or the context-menu key / Shift+F10 (which browsers deliver
  // as a contextmenu event with no pointer position).
  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('.zoom-pill, .canvas-menu, input')) return;
    event.preventDefault();
    if (!menuAllowed('click')) return;
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenuAt(fromKeyboard ? visibleCentre() : { x: event.clientX, y: event.clientY });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    if (menuAllowed('click')) setMenuAt(visibleCentre());
  }

  const closeMenu = useCallback((returnFocus: boolean) => {
    setMenuAt(null);
    if (returnFocus) paneRef.current?.focus({ preventScroll: true });
  }, []);

  const menuItems: CanvasMenuItem[] = [
    { label: 'Fit to screen', onSelect: () => stageRef.current?.fit() },
    { label: 'Reset rotation', onSelect: () => stageRef.current?.resetRotation() },
    { label: gridHidden ? 'Show grid' : 'Hide grid', onSelect: () => setGridHidden(!gridHidden) },
  ];

  useEffect(() => {
    if (screen && wantsRealSize.current) {
      wantsRealSize.current = false;
      stageRef.current?.realSize();
    }
  }, [screen]);

  // A cancelled calibration must not leave the intent behind, or a later
  // calibration from the Paper panel would zoom this pane unexpectedly. (Declared
  // after the effect above so a save has already been acted on.)
  useEffect(() => {
    if (!calibrationOpen) wantsRealSize.current = false;
  }, [calibrationOpen]);

  function handleRealSize() {
    if (stageRef.current?.realSize()) return;
    wantsRealSize.current = true;
    openCalibration();
  }

  // Clear of any panel over the corner (the clearance already includes the gap),
  // otherwise the ordinary margin.
  const pillPosition = {
    right: Math.max(PILL_MARGIN_PX, clearance.right),
    bottom: Math.max(PILL_MARGIN_PX, clearance.bottom),
  };

  return (
    <div
      ref={paneRef}
      className="pane"
      data-testid="pane"
      data-inset-left={Math.round(insets.left)}
      data-inset-top={Math.round(insets.top)}
      data-inset-right={Math.round(insets.right)}
      data-inset-bottom={Math.round(insets.bottom)}
      // Focusable so the canvas menu is reachable from the keyboard.
      tabIndex={0}
      role="group"
      aria-label="Reference canvas"
      aria-keyshortcuts="Shift+F10 ContextMenu"
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <CanvasStage ref={stageRef} session={session} insets={insets} onViewChange={setInfo} />
      {info && !presentationMode && !cropping ? (
        <ZoomPill
          info={info}
          position={pillPosition}
          onFit={() => stageRef.current?.fit()}
          onRealSize={handleRealSize}
          onResetRotation={() => stageRef.current?.resetRotation()}
        />
      ) : null}
      {menuAt ? <CanvasMenu point={menuAt} items={menuItems} onClose={closeMenu} /> : null}
    </div>
  );
}
