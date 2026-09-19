'use client';

import { controlRowStyle, labelStyle } from './styles';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  // Read by assistive tech when the visible label is a short form.
  ariaLabel?: string;
}

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

// A small exclusive set (at most five options) is a segmented control, not a
// select (docs/design.md §4). Each segment reports `aria-pressed`.
export function Segmented<T extends string>({ label, value, options, onChange, disabled }: SegmentedProps<T>) {
  return (
    <div style={controlRowStyle} role="group" aria-label={label}>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-label={option.ariaLabel}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 'var(--touch-target-min)',
                padding: '0 var(--space-sm)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
                background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                color: active ? 'var(--color-accent-contrast)' : 'var(--color-ink)',
                fontFamily: 'var(--font-family-body)',
                fontSize: 'var(--font-body-size)',
                fontWeight: 'var(--font-label-weight)',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
