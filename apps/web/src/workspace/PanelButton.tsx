'use client';

import type { ButtonHTMLAttributes } from 'react';

interface PanelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'default' | 'primary' | 'ghost';
}

// Shared text-button shape for every panel: a 44px touch target, a boundary that
// clears 3:1 (borderStrong), real hover / pressed / focus states, and the cyan
// accent for selected. Styles live in chrome.css (.btn) because inline styles
// cannot express :hover or :focus-visible; `style` still overrides per call site.
export function PanelButton({ active, variant = 'default', className, type = 'button', ...props }: PanelButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn--primary' : '',
    variant === 'ghost' ? 'btn--ghost' : '',
    active ? 'btn--active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} {...props} className={classes} />;
}
