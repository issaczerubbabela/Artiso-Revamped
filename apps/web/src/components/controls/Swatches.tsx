'use client';

import { useId } from 'react';
import { controlRowStyle, labelStyle } from './styles';

interface SwatchesProps {
  label: string;
  value: string;
  colors: readonly string[];
  onChange: (color: string) => void;
  disabled?: boolean;
}

const SWATCH_SIZE = 'var(--touch-target-min)';

// A free colour choice gets preset swatches plus one custom-colour swatch
// (docs/design.md §4).
export function Swatches({ label, value, colors, onChange, disabled }: SwatchesProps) {
  const customId = useId();
  const isPreset = colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div style={controlRowStyle} role="group" aria-label={label}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        {colors.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(color)}
              style={{
                width: SWATCH_SIZE,
                height: SWATCH_SIZE,
                borderRadius: 'var(--radius-sm)',
                background: color,
                border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                padding: 0,
              }}
            />
          );
        })}
        <label
          htmlFor={customId}
          style={{
            position: 'relative',
            width: SWATCH_SIZE,
            height: SWATCH_SIZE,
            borderRadius: 'var(--radius-sm)',
            border: `2px solid ${!isPreset ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: !isPreset ? value : 'var(--color-surface-raised)',
            color: 'var(--color-ink-muted)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxSizing: 'border-box',
          }}
        >
          {isPreset ? <span aria-hidden>+</span> : null}
          <input
            id={customId}
            type="color"
            value={value}
            disabled={disabled}
            aria-label={`Custom ${label.toLowerCase()}`}
            onChange={(event) => onChange(event.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'inherit' }}
          />
        </label>
      </div>
    </div>
  );
}
