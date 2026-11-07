'use client';

import { X } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useWorkspaceStore } from '@/state/workspace-store';

// The import-error surface while a reference is open (issue #10): a paste or a
// drop can fail over a reference, where the empty state that shows import
// errors isn't on screen. A small matte notice at the top, gone on the next
// successful import or when dismissed. `floating` places it on its own (Compact
// has no top bar to sit under).
export function ImportNotice({ floating = false }: { floating?: boolean }) {
  const error = useWorkspaceStore((s) => s.importError);
  const setImportError = useWorkspaceStore((s) => s.setImportError);
  if (!error) return null;
  return (
    <div
      role="alert"
      data-testid="import-notice"
      className={`panel import-notice${floating ? ' import-notice--floating' : ''}`}
    >
      <span className="import-notice__text">{error}</span>
      <IconButton icon={X} label="Dismiss" tooltipSide="bottom" onClick={() => setImportError(null)} />
    </div>
  );
}
