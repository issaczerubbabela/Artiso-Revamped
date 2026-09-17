import { describe, expect, it } from 'vitest';
import { BREAKPOINTS } from '../tokens/breakpoints';
import { MIN_TOUCH_TARGET_PX, RECOMMENDED_TOUCH_TARGET_PX } from '../tokens/touch-target';
import { LIGHT_COLORS, DARK_COLORS } from '../tokens/color';
import { TYPE_SCALE } from '../tokens/typography';

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

describe('type scale tokens', () => {
  it('defines exactly the label/body/heading scale', () => {
    expect(Object.keys(TYPE_SCALE).sort()).toEqual(['body', 'heading', 'label']);
  });

  it('increases font size from label to body to heading', () => {
    expect(TYPE_SCALE.label.fontSize).toBeLessThan(TYPE_SCALE.body.fontSize);
    expect(TYPE_SCALE.body.fontSize).toBeLessThan(TYPE_SCALE.heading.fontSize);
  });
});
