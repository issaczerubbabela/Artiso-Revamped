'use client';

import type { ReactNode } from 'react';
import { PanelButton } from './PanelButton';
import { useReportChromeRect } from '@/components/chrome/chrome-insets';
import { useWorkspaceStore } from '@/state/workspace-store';

// Compact chrome: the active tool's panel as a floating matte sheet above the
// toolbar (docs/design.md §7). It floats over the full-bleed canvas, which
// re-fits itself around the rectangle this reports. Opens and closes as an
// instant swap -- no animation.
export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);
  const reportRect = useReportChromeRect('bottom');

  return (
    <section ref={reportRect} aria-label={title} data-testid="bottom-sheet" className="panel sheet">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <PanelButton onClick={() => setToolMode('idle')} aria-label="Close panel">
          Close
        </PanelButton>
      </div>
      {children}
    </section>
  );
}
