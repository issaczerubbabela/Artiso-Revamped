'use client';

import { useEffect, useRef, useState } from 'react';
import { CanvasStage, type CanvasStageHandle, type StageViewInfo } from '@/canvas/CanvasStage';
import type { PaneSession } from '@/state/workspace-store';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { ZoomPill } from './ZoomPill';

// One pane: its canvas plus its own view controls. Each pane in a split view has
// its own viewport, so Fit and Real size act on this pane's canvas and nothing
// else. `session` is the parked pane's snapshot; the focused pane omits it.
export function PaneStage({ session }: { session?: PaneSession }) {
  const stageRef = useRef<CanvasStageHandle>(null);
  const [info, setInfo] = useState<StageViewInfo | null>(null);
  const presentationMode = useWorkspaceStore((s) => s.presentationMode);
  // The controls belong to the drawing view; the Paper & crop tool has its own.
  const cropping = useWorkspaceStore((s) => !session && s.toolMode === 'paper');
  const screen = useDisplayStore((s) => s.screen);
  const openCalibration = useDisplayStore((s) => s.openCalibration);
  // Real size was asked for before the screen was calibrated: once the
  // calibration is saved, carry on and zoom to it.
  const wantsRealSize = useRef(false);

  const calibrationOpen = useDisplayStore((s) => s.calibrationOpen);

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

  return (
    <>
      <CanvasStage ref={stageRef} session={session} onViewChange={setInfo} />
      {info && !presentationMode && !cropping ? (
        <ZoomPill info={info} onFit={() => stageRef.current?.fit()} onRealSize={handleRealSize} />
      ) : null}
    </>
  );
}
