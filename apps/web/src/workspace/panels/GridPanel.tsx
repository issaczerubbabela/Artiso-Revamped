'use client';

import type { ReactNode } from 'react';
import type { GridConfig } from '@artiso/shared-types';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

const DENSITY_PRESETS = [4, 6, 8, 10, 12];
const THICKNESS_OPTIONS: GridConfig['thickness'][] = ['veryThin', 'thin', 'medium', 'thick', 'extraThick'];
const NUMBERING_OPTIONS: NonNullable<Extract<GridConfig, { type: 'rectangular' }>['numberingMode']>[] = [
  'off',
  'numbers',
  'letters',
  'alphanumeric',
];
const TYPE_OPTIONS: { type: GridConfig['type']; label: string }[] = [
  { type: 'rectangular', label: 'Rectangular' },
  { type: 'ruleOfThirds', label: 'Thirds' },
  { type: 'goldenRatio', label: 'Golden ratio' },
  { type: 'perspective', label: 'Perspective' },
  { type: 'radial', label: 'Radial' },
];

// Guide type + type-specific geometry controls, plus the style controls
// shared by every type (color/opacity/thickness/visibility). Every change
// here recomputes GridGeometry; nothing else in the app does
// (ki-grid-image-independence). Per docs/phases/phase-7-guides-workspace-
// export.md, five guide types are in scope: rectangular, perspective,
// radial, rule-of-thirds, golden-ratio.
export function GridPanel() {
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const setGridConfig = useWorkspaceStore((s) => s.setGridConfig);
  const setGridType = useWorkspaceStore((s) => s.setGridType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Row label="Guide type">
        <ButtonGroup>
          {TYPE_OPTIONS.map(({ type, label }) => (
            <PanelButton key={type} active={gridConfig.type === type} onClick={() => setGridType(type)}>
              {label}
            </PanelButton>
          ))}
        </ButtonGroup>
      </Row>

      {gridConfig.type === 'rectangular' && (
        <>
          <Row label="Density">
            <ButtonGroup>
              {DENSITY_PRESETS.map((n) => (
                <PanelButton
                  key={n}
                  active={gridConfig.rows === n && gridConfig.cols === n}
                  onClick={() => setGridConfig({ rows: n, cols: n })}
                >
                  {n}×{n}
                </PanelButton>
              ))}
            </ButtonGroup>
          </Row>

          <Row label="Numbering">
            <ButtonGroup>
              {NUMBERING_OPTIONS.map((numberingMode) => (
                <PanelButton
                  key={numberingMode}
                  active={gridConfig.numberingMode === numberingMode}
                  onClick={() => setGridConfig({ numberingMode })}
                >
                  {numberingMode}
                </PanelButton>
              ))}
            </ButtonGroup>
          </Row>
        </>
      )}

      {gridConfig.type === 'perspective' && (
        <>
          <Row label="Vanishing points">
            <ButtonGroup>
              {([1, 2, 3] as const).map((count) => (
                <PanelButton
                  key={count}
                  active={gridConfig.vanishingPointCount === count}
                  onClick={() => setGridConfig({ vanishingPointCount: count })}
                >
                  {count}
                </PanelButton>
              ))}
            </ButtonGroup>
          </Row>

          <Row label={`Horizon (${Math.round(gridConfig.horizonY * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(gridConfig.horizonY * 100)}
              onChange={(event) => setGridConfig({ horizonY: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Line count (${gridConfig.lineCount})`}>
            <input
              type="range"
              min={2}
              max={48}
              value={gridConfig.lineCount}
              onChange={(event) => setGridConfig({ lineCount: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          {gridConfig.vanishingPointCount === 3 && (
            <Row label="Third point">
              <ButtonGroup>
                {(['above', 'below'] as const).map((position) => (
                  <PanelButton
                    key={position}
                    active={gridConfig.thirdPointPosition === position}
                    onClick={() => setGridConfig({ thirdPointPosition: position })}
                  >
                    {position}
                  </PanelButton>
                ))}
              </ButtonGroup>
            </Row>
          )}
        </>
      )}

      {gridConfig.type === 'radial' && (
        <>
          <Row label={`Rings (${gridConfig.rings})`}>
            <input
              type="range"
              min={1}
              max={24}
              value={gridConfig.rings}
              onChange={(event) => setGridConfig({ rings: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Spokes (${gridConfig.spokes})`}>
            <input
              type="range"
              min={1}
              max={48}
              value={gridConfig.spokes}
              onChange={(event) => setGridConfig({ spokes: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Center X (${Math.round(gridConfig.centerX * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(gridConfig.centerX * 100)}
              onChange={(event) => setGridConfig({ centerX: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Center Y (${Math.round(gridConfig.centerY * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(gridConfig.centerY * 100)}
              onChange={(event) => setGridConfig({ centerY: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>
        </>
      )}

      {gridConfig.type === 'goldenRatio' && (
        <Row label="Orientation">
          <ButtonGroup>
            {(['horizontal', 'vertical', 'both'] as const).map((orientation) => (
              <PanelButton
                key={orientation}
                active={gridConfig.orientation === orientation}
                onClick={() => setGridConfig({ orientation })}
              >
                {orientation}
              </PanelButton>
            ))}
          </ButtonGroup>
        </Row>
      )}

      <Row label="Color">
        <input
          type="color"
          value={gridConfig.color}
          onChange={(event) => setGridConfig({ color: event.target.value })}
          style={{
            minHeight: 'var(--touch-target-min)',
            minWidth: 'var(--touch-target-min)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'none',
          }}
        />
      </Row>

      <Row label={`Opacity (${gridConfig.opacity})`}>
        <input
          type="range"
          min={0}
          max={100}
          value={gridConfig.opacity}
          onChange={(event) => setGridConfig({ opacity: Number(event.target.value) })}
          style={{ accentColor: 'var(--color-accent)' }}
        />
      </Row>

      <Row label="Thickness">
        <ButtonGroup>
          {THICKNESS_OPTIONS.map((thickness) => (
            <PanelButton
              key={thickness}
              active={gridConfig.thickness === thickness}
              onClick={() => setGridConfig({ thickness })}
            >
              {thickness}
            </PanelButton>
          ))}
        </ButtonGroup>
      </Row>

      <PanelButton active={gridConfig.visible} onClick={() => setGridConfig({ visible: !gridConfig.visible })}>
        {gridConfig.visible ? 'Hide grid' : 'Show grid'}
      </PanelButton>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <span
        style={{
          fontFamily: 'var(--font-family-base)',
          fontSize: 'var(--font-label-size)',
          color: 'var(--color-ink-muted)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ButtonGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>{children}</div>;
}
