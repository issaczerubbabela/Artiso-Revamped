'use client';

import { useEffect, useRef, useState } from 'react';
import { NO_INSETS } from '@artiso/renderer';
import { CanvasStage, type CanvasStageHandle, type StageViewInfo } from '@/canvas/CanvasStage';
import { useChromeInsets } from '@/components/chrome/chrome-insets';
import type { PaneSession } from '@/state/workspace-store';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { ZoomPill } from './ZoomPill';

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
    >
      <CanvasStage ref={stageRef} session={session} insets={insets} onViewChange={setInfo} />
      {info && !presentationMode && !cropping ? (
        <ZoomPill info={info} position={pillPosition} onFit={() => stageRef.current?.fit()} onRealSize={handleRealSize} />
      ) : null}
    </div>
  );
}
