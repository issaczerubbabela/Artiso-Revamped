import '../src/tokens/tokens.css';
import './preview.css';
import { LIGHT_COLORS, DARK_COLORS } from '../src/tokens/color';
import { SPACING } from '../src/tokens/spacing';
import { BREAKPOINTS } from '../src/tokens/breakpoints';
import { MIN_TOUCH_TARGET_PX, RECOMMENDED_TOUCH_TARGET_PX } from '../src/tokens/touch-target';

type FrameDef = { name: string; className: string; width: number };

const FRAMES: FrameDef[] = [
  { name: `Compact (<${BREAKPOINTS.regular}px)`, className: 'compact', width: 375 },
  { name: `Regular (${BREAKPOINTS.regular}–${BREAKPOINTS.wide - 1}px)`, className: 'regular', width: 900 },
  { name: `Wide (≥${BREAKPOINTS.wide}px)`, className: 'wide', width: 1280 },
];

function renderSwatches(): string {
  const names = Object.keys(LIGHT_COLORS) as (keyof typeof LIGHT_COLORS)[];
  return names
    .map(
      (name) => `
        <div class="swatch">
          <div class="swatch-chip${name === 'accent' ? ' selected' : ''}" style="background: var(--color-${kebab(name)})"></div>
          <span class="swatch-name">${name}</span>
        </div>`,
    )
    .join('');
}

function kebab(camel: string): string {
  return camel.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function renderSpacingBars(): string {
  return Object.entries(SPACING)
    .map(
      ([name, px]) => `
        <div class="spacing-bar-wrap">
          <div class="spacing-bar" style="height: ${px}px"></div>
          <span class="spacing-bar-label">${name}<br/>${px}px</span>
        </div>`,
    )
    .join('');
}

function renderFrame(frame: FrameDef): string {
  return `
    <section class="frame">
      <div class="frame-viewport ${frame.className}">
        <p class="section-title">${frame.name}</p>

        <p class="section-title">Color (light / dark via toggle above)</p>
        <div class="swatch-row">${renderSwatches()}</div>

        <p class="section-title">Typography</p>
        <div class="type-sample">
          <span class="heading">Reference — Portrait Study</span>
          <span class="body">Grid overlay stays independent of image adjustments.</span>
          <span class="label">Grid density</span>
        </div>

        <p class="section-title">Spacing scale</p>
        <div class="spacing-row">${renderSpacingBars()}</div>

        <p class="section-title">Touch targets (min ${MIN_TOUCH_TARGET_PX}px / recommended ${RECOMMENDED_TOUCH_TARGET_PX}px)</p>
        <div class="touch-target-demo">
          <button class="touch-target-button touch-target-outline" type="button">Import</button>
        </div>

        <p class="section-title">Elevated surface (dock/sheet)</p>
        <div class="dock-demo">
          <span class="label">Grid</span>
          <p class="body" style="margin: var(--space-xs) 0 0">Rows &amp; columns, color, thickness.</p>
        </div>
      </div>
    </section>`;
}

function render(): void {
  const root = document.getElementById('frames');
  if (!root) return;
  root.innerHTML = FRAMES.map(renderFrame).join('');
}

function initThemeToggle(): void {
  const button = document.getElementById('theme-toggle');
  if (!(button instanceof HTMLButtonElement)) return;

  const setTheme = (theme: 'light' | 'dark') => {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
  };

  let current: 'light' | 'dark' = 'light';
  setTheme(current);

  button.addEventListener('click', () => {
    current = current === 'light' ? 'dark' : 'light';
    setTheme(current);
  });
}

// DARK_COLORS is imported to keep it referenced/typechecked alongside
// LIGHT_COLORS even though the swatches read live CSS custom properties.
void DARK_COLORS;

render();
initThemeToggle();
