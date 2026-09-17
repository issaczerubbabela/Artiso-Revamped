'use client';

import type { ReactNode } from 'react';
import { PanelButton } from './PanelButton';
import { useWorkspaceStore } from '@/state/workspace-store';

// Compact-breakpoint chrome: a sheet lifted subtly above the canvas via
// --shadow-dock, per CLAUDE.md's "flat by default, elevation only to
// clarify hierarchy." Animated open/close transitions are a follow-up
// polish item, not yet implemented.
export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const setToolMode = useWorkspaceStore((s) => s.setToolMode);

  return (
    <div
      style={{
        background: 'var(--color-surface-raised)',
        borderTopLeftRadius: 'var(--radius-md)',
        borderTopRightRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-dock)',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        maxHeight: '40vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-family-base)',
            fontSize: 'var(--font-heading-size)',
            fontWeight: 'var(--font-heading-weight)',
          }}
        >
          {title}
        </span>
        <PanelButton onClick={() => setToolMode('idle')} aria-label="Close panel">
          Close
        </PanelButton>
      </div>
      {children}
    </div>
  );
}
