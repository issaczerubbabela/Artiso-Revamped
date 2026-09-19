'use client';

import { useWorkspaceStore } from '@/state/workspace-store';

// Shown when the open project was shared with the user as a viewer. The
// editing tools are disabled and the store refuses edits; the server's row
// level security is what actually enforces it.
export function ViewOnlyBadge() {
  const role = useWorkspaceStore((s) => s.role);
  if (role !== 'viewer') return null;
  return (
    <span
      style={{
        fontFamily: 'var(--font-family-base)',
        fontSize: 'var(--font-label-size)',
        color: 'var(--color-ink-muted)',
        alignSelf: 'center',
        padding: '0 var(--space-xs)',
      }}
    >
      View only
    </span>
  );
}
