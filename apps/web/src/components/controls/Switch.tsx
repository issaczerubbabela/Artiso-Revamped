'use client';

import { labelStyle } from './styles';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

// A boolean gets a switch (docs/design.md §4). The whole row is the tap target.
export function Switch({ label, checked, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
        width: '100%',
        minHeight: 'var(--touch-target-min)',
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
      }}
    >
      <span style={{ ...labelStyle, color: 'var(--color-ink)' }}>{label}</span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          flexShrink: 0,
          width: 40,
          height: 22,
          borderRadius: 'var(--radius-pill)',
          border: `1px solid ${checked ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
          background: checked ? 'var(--color-accent)' : 'var(--color-surface-raised)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? 'var(--color-accent-contrast)' : 'var(--color-ink-muted)',
          }}
        />
      </span>
    </button>
  );
}
