import { MAX_CROP_ZOOM, clampImageToFrame, coverScale, type FrameRect } from '@artiso/core-engine';
import type { ViewportConstraint } from './viewport';

// The crop tool reuses the Viewport for pan/zoom of the image *under* a fixed,
// paper-shaped frame (Grid-Feature-Spec.md §5). Content units are pixels of the
// oriented original. The image must always fully cover the frame, so the
// minimum zoom is "just covers" and panning is clamped so no frame edge leaves
// the image. The frame never moves or resizes -- the image does.
export function createCropConstraint(imageWidth: number, imageHeight: number, frame: FrameRect): ViewportConstraint {
  const min = coverScale(imageWidth, imageHeight, frame);
  const max = min * MAX_CROP_ZOOM;
  return {
    clampScale: (scale) => Math.min(Math.max(scale, min), max),
    clampPan: (state) => {
      const view = clampImageToFrame(
        { scale: state.scale, tx: state.translateX, ty: state.translateY },
        imageWidth,
        imageHeight,
        frame,
      );
      return { scale: view.scale, translateX: view.tx, translateY: view.ty };
    },
  };
}
