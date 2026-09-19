import { describe, expect, it } from 'vitest';
import { CROP_DIM_DEFAULT, CROP_OUTLINE_DEFAULT, CROP_OUTLINE_WIDTH_PX, drawCropFrame } from '../crop-frame';

function recordingContext() {
  const fills: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }> = [];
  const strokes: Array<{ x: number; y: number; w: number; h: number; strokeStyle: string; lineWidth: number }> = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 0,
    save: () => {},
    restore: () => {},
    fillRect: (x: number, y: number, w: number, h: number) => fills.push({ x, y, w, h, fillStyle: ctx.fillStyle }),
    strokeRect: (x: number, y: number, w: number, h: number) =>
      strokes.push({ x, y, w, h, strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes };
}

const FRAME = { x: 100, y: 50, w: 300, h: 420 };

describe('drawCropFrame', () => {
  it('dims everything outside the frame with four rectangles that tile the surround exactly', () => {
    const { ctx, fills } = recordingContext();
    drawCropFrame(ctx, 800, 600, FRAME);
    expect(fills).toHaveLength(4);
    // Top, bottom, left and right bands.
    expect(fills).toContainEqual(expect.objectContaining({ x: 0, y: 0, w: 800, h: 50 }));
    expect(fills).toContainEqual(expect.objectContaining({ x: 0, y: 470, w: 800, h: 130 }));
    expect(fills).toContainEqual(expect.objectContaining({ x: 0, y: 50, w: 100, h: 420 }));
    expect(fills).toContainEqual(expect.objectContaining({ x: 400, y: 50, w: 400, h: 420 }));
    // Together with the frame they cover the whole canvas, with no overlap.
    const area = fills.reduce((sum, f) => sum + f.w * f.h, 0) + FRAME.w * FRAME.h;
    expect(area).toBe(800 * 600);
  });

  it('never dims the kept area', () => {
    const { ctx, fills } = recordingContext();
    drawCropFrame(ctx, 800, 600, FRAME);
    for (const f of fills) {
      const overlapsFrame = f.x < FRAME.x + FRAME.w && f.x + f.w > FRAME.x && f.y < FRAME.y + FRAME.h && f.y + f.h > FRAME.y;
      expect(overlapsFrame).toBe(false);
    }
  });

  it('uses the default dim and outline, and honours overrides', () => {
    const plain = recordingContext();
    drawCropFrame(plain.ctx, 800, 600, FRAME);
    expect(plain.fills[0]!.fillStyle).toBe(`rgba(0, 0, 0, ${CROP_DIM_DEFAULT})`);
    expect(plain.strokes[0]).toMatchObject({ strokeStyle: CROP_OUTLINE_DEFAULT, lineWidth: CROP_OUTLINE_WIDTH_PX });

    const custom = recordingContext();
    drawCropFrame(custom.ctx, 800, 600, FRAME, { dim: 0.8, outline: '#ff0000' });
    expect(custom.fills[0]!.fillStyle).toBe('rgba(0, 0, 0, 0.8)');
    expect(custom.strokes[0]!.strokeStyle).toBe('#ff0000');
  });

  it('outlines just inside the frame so the outline is part of the kept area', () => {
    const { ctx, strokes } = recordingContext();
    drawCropFrame(ctx, 800, 600, FRAME);
    expect(strokes).toEqual([
      // Inset by half the 2px line on every side: 300 - 2 by 420 - 2.
      expect.objectContaining({ x: 101, y: 51, w: 298, h: 418 }),
    ]);
  });

  it('draws only the outline when the frame fills the canvas (nothing to dim)', () => {
    const { ctx, fills } = recordingContext();
    drawCropFrame(ctx, 400, 300, { x: 0, y: 0, w: 400, h: 300 });
    for (const f of fills) expect(f.w * f.h).toBe(0);
  });
});
