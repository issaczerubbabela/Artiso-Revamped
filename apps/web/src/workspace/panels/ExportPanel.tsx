'use client';

import { useState } from 'react';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';
import { exportReference } from '@/session/export-reference';
import { EXPORT_PROFILES } from '@/state/export-profiles';

// Named export profiles (docs/phases/phase-3-filters-presets-export.md) are
// quick-select starting points over the same ExportSettings fields below --
// picking one just sets them, and any field can still be tweaked afterward.
export function ExportPanel() {
  const assetId = useWorkspaceStore((s) => s.assetId);
  const editStack = useWorkspaceStore((s) => s.editStack);
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const exportSettings = useWorkspaceStore((s) => s.exportSettings);
  const setExportSettings = useWorkspaceStore((s) => s.setExportSettings);

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!assetId) return;
    setIsExporting(true);
    setError(null);
    try {
      await exportReference({ assetId, editStack, gridConfig, ...exportSettings });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span
          style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
        >
          Profile
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {EXPORT_PROFILES.map((profile) => (
            <PanelButton
              key={profile.id}
              active={exportSettings.profileId === profile.id}
              onClick={() => setExportSettings({ ...profile.settings, profileId: profile.id })}
            >
              {profile.label}
            </PanelButton>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <PanelButton active={exportSettings.format === 'png'} onClick={() => setExportSettings({ format: 'png', profileId: undefined })}>
          PNG
        </PanelButton>
        <PanelButton active={exportSettings.format === 'jpeg'} onClick={() => setExportSettings({ format: 'jpeg', profileId: undefined })}>
          JPEG
        </PanelButton>
      </div>

      {exportSettings.format === 'jpeg' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <span
            style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
          >
            Quality ({exportSettings.quality})
          </span>
          <input
            type="range"
            min={10}
            max={100}
            value={exportSettings.quality}
            onChange={(event) => setExportSettings({ quality: Number(event.target.value), profileId: undefined })}
            style={{ accentColor: 'var(--color-accent)' }}
          />
        </label>
      )}

      <PanelButton
        active={exportSettings.includeImage !== false}
        onClick={() => setExportSettings({ includeImage: exportSettings.includeImage === false, profileId: undefined })}
      >
        Include image
      </PanelButton>
      <PanelButton
        active={exportSettings.includeGrid}
        onClick={() => setExportSettings({ includeGrid: !exportSettings.includeGrid, profileId: undefined })}
      >
        Include grid
      </PanelButton>
      <PanelButton
        active={exportSettings.includeAdjustments}
        onClick={() => setExportSettings({ includeAdjustments: !exportSettings.includeAdjustments, profileId: undefined })}
      >
        Include adjustments
      </PanelButton>

      <PanelButton variant="primary" onClick={() => void handleExport()} disabled={isExporting || !assetId}>
        {isExporting ? 'Exporting…' : 'Export image'}
      </PanelButton>

      {error ? (
        <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
