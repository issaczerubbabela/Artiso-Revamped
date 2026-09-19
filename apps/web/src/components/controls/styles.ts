import type { CSSProperties } from 'react';

// Shared visual language for the panel controls (docs/design.md §4): labels in
// the label type role, numeric readouts in the mono role, every interactive
// target at least the 44px touch minimum, and no transitions -- state changes
// are instant swaps.

export const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-family-body)',
  fontSize: 'var(--font-label-size)',
  lineHeight: 'var(--font-label-line-height)',
  fontWeight: 'var(--font-label-weight)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-muted)',
};

export const readoutStyle: CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: 'var(--font-mono-size)',
  lineHeight: 'var(--font-mono-line-height)',
  fontWeight: 'var(--font-mono-weight)',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--color-ink)',
};

export const controlRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

export const inputBaseStyle: CSSProperties = {
  minHeight: 'var(--touch-target-min)',
  padding: '0 var(--space-sm)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-raised)',
  color: 'var(--color-ink)',
  fontFamily: 'var(--font-family-body)',
  fontSize: 'var(--font-body-size)',
  boxSizing: 'border-box',
};
