// The focused pane's view controls, for the keyboard shortcuts (issue #11).
// Fit, Reset rotation and Cell Focus stepping act on one pane's own viewport
// and cells, so the pane that has focus registers them here -- the same seam
// as registerCentreCell in cell-focus.ts.

export interface ViewControls {
  fit: () => void;
  resetRotation: () => void;
  // Steps Cell Focus; false when it is off, so the arrow key is left alone.
  stepCell: (direction: 1 | -1) => boolean;
}

let current: ViewControls | null = null;

export function registerViewControls(controls: ViewControls): () => void {
  current = controls;
  return () => {
    if (current === controls) current = null;
  };
}

export function focusedViewControls(): ViewControls | null {
  return current;
}
