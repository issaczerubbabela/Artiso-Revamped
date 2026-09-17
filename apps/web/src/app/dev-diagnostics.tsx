'use client';

import { CORE_ENGINE_VERSION } from '@drawing-grid/core-engine';
import { RENDERER_VERSION } from '@drawing-grid/renderer';
import { useWorkspaceStore } from '@/state/workspace-store';

// Dev-only diagnostic proving the monorepo wiring (workspace package
// resolution + Zustand) works end-to-end. Not part of the product UI —
// removed once Phase 1 gives this page real content.
export function DevDiagnostics() {
  const activeReferenceId = useWorkspaceStore((state) => state.activeReferenceId);

  return (
    <p
      style={{
        fontFamily: 'var(--font-family-base)',
        fontSize: 'var(--font-label-size)',
        color: 'var(--color-ink-muted)',
      }}
    >
      core-engine {CORE_ENGINE_VERSION} · renderer {RENDERER_VERSION} · activeReference{' '}
      {activeReferenceId ?? 'none'}
    </p>
  );
}
