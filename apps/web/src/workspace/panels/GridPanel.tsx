'use client';

import type { ReactNode } from 'react';
import { formatLength, toMm } from '@artiso/core-engine';
import type { GridConfig } from '@artiso/shared-types';
import { NumberField, Segmented, Slider, Swatches, Switch, labelStyle } from '@/components/controls';
import { PanelButton } from '@/workspace/PanelButton';
import { useDisplayStore } from '@/state/display-store';
import { useWorkspaceStore } from '@/state/workspace-store';

const LABEL_SCHEMES = [
  { value: 'numbers', label: 'Numbers' },
  { value: 'letters', label: 'Letters' },
] as const;

// A few starting points; the custom swatch covers everything else.
const GRID_COLORS = ['#ffffff', '#000000', '#ff3b30', '#34e2e2', '#ffd60a'] as const;

const GUIDE_TYPES: { type: GridConfig['type']; label: string }[] = [
  { type: 'ruleOfThirds', label: 'Thirds' },
  { type: 'goldenRatio', label: 'Golden ratio' },
  { type: 'perspective', label: 'Perspective' },
];

const THICKNESS_LEVELS: GridConfig['thickness'][] = ['veryThin', 'thin', 'medium', 'thick', 'extraThick'];
const THICKNESS_NAMES = ['Hairline', 'Thin', 'Medium', 'Thick', 'Heavy'];

const SECTION_STYLE = { display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' } as const;

// The drawing grid (Grid-Feature-Spec.md §6-§9) and, below it, the optional
// guide layer. Every change here repaints the grid and nothing else -- the image
// pipeline is untouched (ki-grid-image-independence). Each value gets the
// control its data shape calls for (docs/design.md §4): switches for the
// overlays, sliders with live readouts for the continuous values, a segmented
// control for the label scheme, swatches for colour.
export function GridPanel() {
  const gridSettings = useWorkspaceStore((s) => s.gridSettings);
  const paper = useWorkspaceStore((s) => s.paper);
  const setGridSettings = useWorkspaceStore((s) => s.setGridSettings);
  const unit = useDisplayStore((s) => s.unit);
  const dpi = useDisplayStore((s) => s.dpi);

  const { cellMm, showSquares, showDiagonals, showRadial, radialStepDeg, labels, style } = gridSettings;
  // A slider that can reach the whole useful range: from a fine 2 mm grid up to
  // a third of the long side. Exact values beyond it are typed into the field.
  const cellMax = Math.max(10, Math.round(Math.max(paper.widthMm, paper.heightMm) / 3));
  const formatCell = (mm: number) => `${formatLength(mm, unit, dpi)} ${unit}`;

  return (
    <div style={SECTION_STYLE}>
      <Switch label="Squares" checked={showSquares} onChange={(showSquares) => setGridSettings({ showSquares })} />

      {showSquares ? (
        <>
          <Slider
            label="Cell size"
            value={Math.min(cellMm, cellMax)}
            min={2}
            max={cellMax}
            step={0.5}
            format={formatCell}
            onChange={(cellMm) => setGridSettings({ cellMm })}
          />
          <NumberField
            label={`Exact cell size (${unit})`}
            value={cellMm}
            format={(mm) => formatLength(mm, unit, dpi)}
            suffix={unit}
            onCommit={(v) => setGridSettings({ cellMm: toMm(v, unit, dpi) })}
          />

          <Switch
            label="Labels"
            checked={labels.enabled}
            onChange={(enabled) => setGridSettings({ labels: { enabled } })}
          />
          {labels.enabled ? (
            <>
              <Segmented
                label="Columns"
                value={labels.columns}
                options={LABEL_SCHEMES}
                onChange={(columns) => setGridSettings({ labels: { columns } })}
              />
              <Segmented
                label="Rows"
                value={labels.rows}
                options={LABEL_SCHEMES}
                onChange={(rows) => setGridSettings({ labels: { rows } })}
              />
            </>
          ) : null}
        </>
      ) : null}

      <Switch
        label="Diagonals"
        checked={showDiagonals}
        onChange={(showDiagonals) => setGridSettings({ showDiagonals })}
      />

      <Switch label="Radial" checked={showRadial} onChange={(showRadial) => setGridSettings({ showRadial })} />
      {showRadial ? (
        <Slider
          label="Radial step"
          value={radialStepDeg}
          min={1}
          max={90}
          step={1}
          format={(v) => `${v}°`}
          onChange={(radialStepDeg) => setGridSettings({ radialStepDeg })}
        />
      ) : null}

      <Section title="Style">
        <Swatches
          label="Colour"
          value={style.color}
          colors={GRID_COLORS}
          onChange={(color) => setGridSettings({ style: { color } })}
        />
        <Slider
          label="Line width"
          value={style.widthPx}
          min={0.5}
          max={6}
          step={0.5}
          format={(v) => `${v} px`}
          onChange={(widthPx) => setGridSettings({ style: { widthPx } })}
        />
        <Slider
          label="Opacity"
          value={Math.round(style.opacity * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(percent) => setGridSettings({ style: { opacity: percent / 100 } })}
        />
      </Section>

      <Section title="Guides">
        <GuidePanel />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...SECTION_STYLE, borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
      <span style={{ ...labelStyle, color: 'var(--color-ink)' }}>{title}</span>
      {children}
    </div>
  );
}

// The optional guide (perspective / rule of thirds / golden ratio) drawn beneath
// the grid, with its own style. Not part of the grid's "one shared style".
function GuidePanel() {
  const guide = useWorkspaceStore((s) => s.secondaryGridConfig);
  const setGuide = useWorkspaceStore((s) => s.setSecondaryGridConfig);
  const setGuideType = useWorkspaceStore((s) => s.setSecondaryGridType);
  const removeGuide = useWorkspaceStore((s) => s.removeSecondaryGrid);

  if (!guide) {
    return <PanelButton onClick={() => setGuideType('ruleOfThirds')}>Add a guide</PanelButton>;
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {GUIDE_TYPES.map(({ type, label }) => (
          <PanelButton key={type} active={guide.type === type} onClick={() => setGuideType(type)}>
            {label}
          </PanelButton>
        ))}
      </div>

      {guide.type === 'perspective' && (
        <>
          <Segmented
            label="Vanishing points"
            value={String(guide.vanishingPointCount) as '1' | '2' | '3'}
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
            onChange={(count) => setGuide({ vanishingPointCount: Number(count) as 1 | 2 | 3 })}
          />
          <Slider
            label="Horizon"
            value={Math.round(guide.horizonY * 100)}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(v) => setGuide({ horizonY: v / 100 })}
          />
          <Slider
            label="Line count"
            value={guide.lineCount}
            min={2}
            max={48}
            onChange={(lineCount) => setGuide({ lineCount })}
          />
          {guide.vanishingPointCount === 3 && (
            <Segmented
              label="Third point"
              value={guide.thirdPointPosition}
              options={[
                { value: 'above', label: 'Above' },
                { value: 'below', label: 'Below' },
              ]}
              onChange={(thirdPointPosition) => setGuide({ thirdPointPosition })}
            />
          )}
        </>
      )}

      {guide.type === 'goldenRatio' && (
        <Segmented
          label="Orientation"
          value={guide.orientation}
          options={[
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
            { value: 'both', label: 'Both' },
          ]}
          onChange={(orientation) => setGuide({ orientation })}
        />
      )}

      <Swatches label="Guide colour" value={guide.color} colors={GRID_COLORS} onChange={(color) => setGuide({ color })} />
      <Slider
        label="Guide opacity"
        value={guide.opacity}
        min={0}
        max={100}
        step={5}
        format={(v) => `${v}%`}
        onChange={(opacity) => setGuide({ opacity })}
      />
      <Slider
        label="Guide line width"
        value={THICKNESS_LEVELS.indexOf(guide.thickness)}
        min={0}
        max={THICKNESS_LEVELS.length - 1}
        format={(i) => THICKNESS_NAMES[i] ?? ''}
        onChange={(i) => setGuide({ thickness: THICKNESS_LEVELS[i] ?? 'medium' })}
      />
      <Switch label="Show guide" checked={guide.visible} onChange={(visible) => setGuide({ visible })} />
      <PanelButton onClick={removeGuide}>Remove guide</PanelButton>
    </>
  );
}
