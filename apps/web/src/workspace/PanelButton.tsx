'use client';

import type { ButtonHTMLAttributes } from 'react';

interface PanelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'default' | 'primary';
}

// Shared control shape for every panel: min 44px touch target, labeled (never
// icon-only by default), single accent color for active/selected state --
// per CLAUDE.md's Design language section.
export function PanelButton({ active, variant = 'default', style, ...props }: PanelButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <button
      {...props}
      style={{
        minHeight: 'var(--touch-target-min)',
        padding: '0 var(--space-md)',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active || isPrimary ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: isPrimary ? 'var(--color-accent)' : active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        color: isPrimary || active ? 'var(--color-accent-contrast)' : 'var(--color-ink)',
        fontFamily: 'var(--font-family-base)',
        fontSize: 'var(--font-body-size)',
        fontWeight: 'var(--font-label-weight)',
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        transition: 'background var(--motion-duration) var(--motion-easing)',
        ...style,
      }}
    />
  );
}
