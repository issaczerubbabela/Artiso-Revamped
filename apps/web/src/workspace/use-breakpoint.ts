'use client';

import { useEffect, useState } from 'react';
import { MEDIA_QUERIES } from '@artiso/ui';

export type Breakpoint = 'compact' | 'regular' | 'wide';

function computeBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'compact';
  if (window.matchMedia(MEDIA_QUERIES.wide).matches) return 'wide';
  if (window.matchMedia(MEDIA_QUERIES.regular).matches) return 'regular';
  return 'compact';
}

// docs/architecture/06-workspace-interaction.md's three chrome tiers.
// Regular currently reuses Compact's bottom-sheet chrome (its own
// collapsible-drawer-overlay variant isn't built yet) -- only Wide gets a
// distinct layout (persistent rail + side dock) in this pass.
export function useBreakpoint(): Breakpoint {
  // Always starts at 'compact' regardless of actual viewport width -- the
  // server has no window to check, so the client's first render must match
  // that same guess or React throws a hydration mismatch. The real
  // breakpoint is applied a moment later from the effect below (a brief
  // Compact-layout flash on a Wide viewport's first paint, traded for a
  // correct hydration).
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('compact');

  useEffect(() => {
    const wideQuery = window.matchMedia(MEDIA_QUERIES.wide);
    const regularQuery = window.matchMedia(MEDIA_QUERIES.regular);
    const update = () => setBreakpoint(computeBreakpoint());
    update();
    wideQuery.addEventListener('change', update);
    regularQuery.addEventListener('change', update);
    return () => {
      wideQuery.removeEventListener('change', update);
      regularQuery.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
