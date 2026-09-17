// Motion is functional, never decorative (CLAUDE.md). One duration/easing
// pair covers panel open/close, mode switches, and breakpoint transitions.
// Canvas pan/zoom itself is direct-manipulation and never runs through this
// token (see ki-immediate-feedback).
export const MOTION = {
  durationMs: 180,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
