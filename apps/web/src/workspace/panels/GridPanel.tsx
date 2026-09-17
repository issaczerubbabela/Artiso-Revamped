'use client';

import type { ReactNode } from 'react';
import type { GridConfig } from '@artiso/shared-types';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

const DENSITY_PRESETS = [4, 6, 8, 10, 12];
const THICKNESS_OPTIONS: GridConfig['thickness'][] = ['veryThin', 'thin', 'medium', 'thick', 'extraThick'];
const NUMBERING_OPTIONS: GridConfig['numberingMode'][] = ['off', 'numbers', 'letters', 'alphanumeric'];

// Rows/cols/color/opacity/thickness/numbering/visibility -- the Phase 1
// scope of docs/architecture/04-grid-engine.md (perspective/radial/etc. grid
// types are Phase 6). Every change here recomputes GridGeometry; nothing
// else in the app does (ki-grid-image-independence).
export function GridPanel() {
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const setGridConfig = useWorkspaceStore((s) => s.setGridConfig);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
