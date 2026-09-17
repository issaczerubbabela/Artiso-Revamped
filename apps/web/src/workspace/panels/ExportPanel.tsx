'use client';

import { useState } from 'react';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';
import { exportReference } from '@/session/export-reference';

// Named export profiles (Print A4, Classroom, ...) are Phase 3
// (docs/phases/phase-3-filters-presets-export.md) -- Phase 1 exposes the raw
// ExportSettings fields directly (format/quality/includeGrid/includeAdjustments).
export function ExportPanel() {
  const assetId = useWorkspaceStore((s) => s.assetId);
  const editStack = useWorkspaceStore((s) => s.editStack);
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);

  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [includeGrid, setIncludeGrid] = useState(true);
  const [includeAdjustments, setIncludeAdjustments] = useState(true);
  const [quality, setQuality] = useState(92);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!assetId) return;
    setIsExporting(true);
    setError(null);
    try {
      await exportReference({ assetId, editStack, gridConfig, format, quality, includeGrid, includeAdjustments });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <PanelButton active={format === 'png'} onClick={() => setFormat('png')}>
          PNG
        </PanelButton>
        <PanelButton active={format === 'jpeg'} onClick={() => setFormat('jpeg')}>
          JPEG
        </PanelButton>
      </div>

      {format === 'jpeg' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <span
            style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
          >
            Quality ({quality})
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            style={{ accentColor: 'var(--color-accent)' }}
          />
        </label>
      )}

      <PanelButton active={includeGrid} onClick={() => setIncludeGrid((v) => !v)}>
        Include grid
      </PanelButton>
      <PanelButton active={includeAdjustments} onClick={() => setIncludeAdjustments((v) => !v)}>
        Include adjustments
      </PanelButton>

      <PanelButton variant="primary" onClick={() => void handleExport()} disabled={isExporting || !assetId}>
        {isExporting ? 'Exporting…' : 'Export'}
      </PanelButton>

      {error ? (
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
