import { describe, expect, it } from 'vitest';
import { BREAKPOINTS } from '../tokens/breakpoints';
import { MIN_TOUCH_TARGET_PX, RECOMMENDED_TOUCH_TARGET_PX } from '../tokens/touch-target';
import { LIGHT_COLORS, DARK_COLORS } from '../tokens/color';
import { TYPE_SCALE } from '../tokens/typography';
import { MATTE_PANEL } from '../tokens/elevation';

describe('breakpoint tokens', () => {
  it('are strictly ordered compact < regular < wide', () => {
    expect(BREAKPOINTS.compact).toBeLessThan(BREAKPOINTS.regular);
    expect(BREAKPOINTS.regular).toBeLessThan(BREAKPOINTS.wide);
  });
});

describe('touch target tokens', () => {
  it('meet the 44px accessibility floor', () => {
    expect(MIN_TOUCH_TARGET_PX).toBeGreaterThanOrEqual(44);
    expect(RECOMMENDED_TOUCH_TARGET_PX).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  });
});

describe('color tokens', () => {
  it('define the same set of keys for light and dark themes', () => {
    expect(Object.keys(LIGHT_COLORS).sort()).toEqual(Object.keys(DARK_COLORS).sort());
  });

  it('use valid 6-digit hex values', () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const value of [...Object.values(LIGHT_COLORS), ...Object.values(DARK_COLORS)]) {
      expect(value).toMatch(hex);
    }
  });
});

// WCAG relative luminance / contrast, so the accessibility claims in
// docs/design.md §2 and §5 are enforced rather than just written down.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// The matte panel composited over a photo of the given grey (0..255).
function panelOver(photo: number, alpha: number): string {
  const mix = (c: number) => Math.round(c * alpha + photo * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${mix(19)}${mix(20)}${mix(22)}`;
}

describe('accessibility contrast', () => {
  it('keeps muted text >= 4.5:1 on the matte panel over even a white photo', () => {
    expect(MATTE_PANEL.dark.background).toContain('.95');
    expect(contrast(DARK_COLORS.inkMuted, panelOver(255, 0.95))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_COLORS.ink, panelOver(255, 0.95))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps operable control boundaries >= 3:1 in both themes', () => {
    expect(contrast(DARK_COLORS.borderStrong, panelOver(255, 0.95))).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT_COLORS.borderStrong, LIGHT_COLORS.surfaceRaised)).toBeGreaterThanOrEqual(3);
  });

  it('keeps the decorative hairline border out of the operable-boundary role', () => {
    expect(contrast(DARK_COLORS.border, DARK_COLORS.surfaceRaised)).toBeLessThan(3);
  });

  it('has no backdrop blur on the matte panel', () => {
    expect(Object.keys(MATTE_PANEL.dark)).not.toContain('blur');
  });
});

describe('type scale tokens', () => {
  it('defines exactly the label/body/heading scale', () => {
    expect(Object.keys(TYPE_SCALE).sort()).toEqual(['body', 'heading', 'label']);
  });

  it('increases font size from label to body to heading', () => {
    expect(TYPE_SCALE.label.fontSize).toBeLessThan(TYPE_SCALE.body.fontSize);
    expect(TYPE_SCALE.body.fontSize).toBeLessThan(TYPE_SCALE.heading.fontSize);
  });
});
