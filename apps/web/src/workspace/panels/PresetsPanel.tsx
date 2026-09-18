'use client';

import { useEffect, useState } from 'react';
import type { Preset } from '@artiso/shared-types';
import { listPresets } from '@artiso/api-client';
import { PanelButton } from '@/workspace/PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';
import { createPresetAction, deletePresetAction, renamePresetAction } from '@/session/preset-actions';

// Save current grid config + filter stack + export settings as a named,
// reusable Preset; apply/rename/delete (docs/phases/phase-3-filters-presets-
// export.md). Synced across devices when signed in (see auth-bootstrap.ts's
// mergeRemotePresets) -- local-only and fully functional when signed out.
export function PresetsPanel() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const gridConfig = useWorkspaceStore((s) => s.gridConfig);
  const editStack = useWorkspaceStore((s) => s.editStack);
  const exportSettings = useWorkspaceStore((s) => s.exportSettings);
  const applyPreset = useWorkspaceStore((s) => s.applyPreset);

  async function refresh() {
    setIsLoading(true);
    try {
      setPresets(await listPresets());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSave() {
    const name = window.prompt('Preset name');
    if (!name) return;
    const filterStack = editStack.filter(
      (op) => op.type === 'brightness' || op.type === 'contrast' || op.type === 'saturation' || op.type === 'filter',
    );
    await createPresetAction({ name, gridConfig, filterStack, exportSettings });
    void refresh();
  }

  async function handleRename(preset: Preset) {
    const name = window.prompt('Rename preset', preset.name);
    if (!name || name === preset.name) return;
    await renamePresetAction(preset.id, name);
    void refresh();
  }

  async function handleDelete(preset: Preset) {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    await deletePresetAction(preset.id);
    void refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <PanelButton variant="primary" onClick={() => void handleSave()}>
        Save current as preset
      </PanelButton>

      {isLoading ? null : presets.length === 0 ? (
        <span
          style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-label-size)', color: 'var(--color-ink-muted)' }}
        >
          No presets saved yet.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {presets.map((preset) => (
            <div
              key={preset.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                flexWrap: 'wrap',
                padding: 'var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-family-base)', fontSize: 'var(--font-body-size)' }}>{preset.name}</span>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <PanelButton
                  onClick={() =>
                    applyPreset({
                      gridConfig: preset.gridConfig,
                      filterStack: preset.filterStack,
                      exportSettings: preset.exportSettings,
                    })
                  }
                >
                  Apply
                </PanelButton>
                <PanelButton onClick={() => void handleRename(preset)}>Rename</PanelButton>
                <PanelButton onClick={() => void handleDelete(preset)}>Delete</PanelButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
