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
// radial, rule-of-thirds, golden-ratio -- plus an optional second, layered
// guide (major+minor) rendered as its own overlay pass
// (.agents/workflows/add-new-grid-type-recipe.md's step 6).
export function GridPanel() {
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const setGridConfig = useWorkspaceStore((s) => s.setGridConfig);
  const setGridType = useWorkspaceStore((s) => s.setGridType);

  const secondaryGridConfig = useWorkspaceStore((s) => s.secondaryGridConfig);
  const setSecondaryGridConfig = useWorkspaceStore((s) => s.setSecondaryGridConfig);
  const setSecondaryGridType = useWorkspaceStore((s) => s.setSecondaryGridType);
  const removeSecondaryGrid = useWorkspaceStore((s) => s.removeSecondaryGrid);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <GuideEditor config={gridConfig} onPatch={setGridConfig} onTypeChange={setGridType} visibilityLabel="grid" />

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
        {secondaryGridConfig ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Row label="Layered guide">
              <PanelButton onClick={removeSecondaryGrid}>Remove layer</PanelButton>
            </Row>
            <GuideEditor
              config={secondaryGridConfig}
              onPatch={setSecondaryGridConfig}
              onTypeChange={setSecondaryGridType}
              visibilityLabel="layer"
            />
          </div>
        ) : (
          <PanelButton onClick={() => setSecondaryGridType('ruleOfThirds')}>Add layered guide</PanelButton>
        )}
      </div>
    </div>
  );
}

// One guide's full control set (type selector, type-specific fields, shared
// style, visibility) -- reused for both the primary grid and the optional
// secondary layer, since a layered guide is just a second instance of the
// same editor, not a different shape (see the recipe's "composition, not a
// new type" rule).
function GuideEditor({
  config,
  onPatch,
  onTypeChange,
  visibilityLabel,
}: {
  config: GridConfig;
  onPatch: (patch: Partial<GridConfig>) => void;
  onTypeChange: (type: GridConfig['type']) => void;
  visibilityLabel: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Row label="Guide type">
        <ButtonGroup>
          {TYPE_OPTIONS.map(({ type, label }) => (
            <PanelButton key={type} active={config.type === type} onClick={() => onTypeChange(type)}>
              {label}
            </PanelButton>
          ))}
        </ButtonGroup>
      </Row>

      {config.type === 'rectangular' && (
        <>
          <Row label="Density">
            <ButtonGroup>
              {DENSITY_PRESETS.map((n) => (
                <PanelButton
                  key={n}
                  active={config.rows === n && config.cols === n}
                  onClick={() => onPatch({ rows: n, cols: n })}
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
                  active={config.numberingMode === numberingMode}
                  onClick={() => onPatch({ numberingMode })}
                >
                  {numberingMode}
                </PanelButton>
              ))}
            </ButtonGroup>
          </Row>
        </>
      )}

      {config.type === 'perspective' && (
        <>
          <Row label="Vanishing points">
            <ButtonGroup>
              {([1, 2, 3] as const).map((count) => (
                <PanelButton
                  key={count}
                  active={config.vanishingPointCount === count}
                  onClick={() => onPatch({ vanishingPointCount: count })}
                >
                  {count}
                </PanelButton>
              ))}
            </ButtonGroup>
          </Row>

          <Row label={`Horizon (${Math.round(config.horizonY * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(config.horizonY * 100)}
              onChange={(event) => onPatch({ horizonY: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Line count (${config.lineCount})`}>
            <input
              type="range"
              min={2}
              max={48}
              value={config.lineCount}
              onChange={(event) => onPatch({ lineCount: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          {config.vanishingPointCount === 3 && (
            <Row label="Third point">
              <ButtonGroup>
                {(['above', 'below'] as const).map((position) => (
                  <PanelButton
                    key={position}
                    active={config.thirdPointPosition === position}
                    onClick={() => onPatch({ thirdPointPosition: position })}
                  >
                    {position}
                  </PanelButton>
                ))}
              </ButtonGroup>
            </Row>
          )}
        </>
      )}

      {config.type === 'radial' && (
        <>
          <Row label={`Rings (${config.rings})`}>
            <input
              type="range"
              min={1}
              max={24}
              value={config.rings}
              onChange={(event) => onPatch({ rings: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Spokes (${config.spokes})`}>
            <input
              type="range"
              min={1}
              max={48}
              value={config.spokes}
              onChange={(event) => onPatch({ spokes: Number(event.target.value) })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Center X (${Math.round(config.centerX * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(config.centerX * 100)}
              onChange={(event) => onPatch({ centerX: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>

          <Row label={`Center Y (${Math.round(config.centerY * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(config.centerY * 100)}
              onChange={(event) => onPatch({ centerY: Number(event.target.value) / 100 })}
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </Row>
        </>
      )}

      {config.type === 'goldenRatio' && (
        <Row label="Orientation">
          <ButtonGroup>
            {(['horizontal', 'vertical', 'both'] as const).map((orientation) => (
              <PanelButton
                key={orientation}
                active={config.orientation === orientation}
                onClick={() => onPatch({ orientation })}
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
          value={config.color}
          onChange={(event) => onPatch({ color: event.target.value })}
          style={{
            minHeight: 'var(--touch-target-min)',
            minWidth: 'var(--touch-target-min)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: 'none',
          }}
        />
      </Row>

      <Row label={`Opacity (${config.opacity})`}>
        <input
          type="range"
          min={0}
          max={100}
          value={config.opacity}
          onChange={(event) => onPatch({ opacity: Number(event.target.value) })}
          style={{ accentColor: 'var(--color-accent)' }}
        />
      </Row>

      <Row label="Thickness">
        <ButtonGroup>
          {THICKNESS_OPTIONS.map((thickness) => (
            <PanelButton key={thickness} active={config.thickness === thickness} onClick={() => onPatch({ thickness })}>
              {thickness}
            </PanelButton>
          ))}
        </ButtonGroup>
      </Row>

      <PanelButton active={config.visible} onClick={() => onPatch({ visible: !config.visible })}>
        {config.visible ? `Hide ${visibilityLabel}` : `Show ${visibilityLabel}`}
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
