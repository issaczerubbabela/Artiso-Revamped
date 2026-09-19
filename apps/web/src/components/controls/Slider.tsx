'use client';

import { useId } from 'react';
import { controlRowStyle, labelStyle, readoutStyle } from './styles';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  // How the live readout next to the label reads, e.g. `(v) => `${v}%``.
  format?: (value: number) => string;
  disabled?: boolean;
}

// A continuous value gets a slider with a live monospace readout, never a
// button group (docs/design.md §4).
export function Slider({ label, value, min, max, step = 1, onChange, format, disabled }: SliderProps) {
  const id = useId();
  const readout = format ? format(value) : String(value);
  return (
    <div style={controlRowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label htmlFor={id} style={labelStyle}>
          {label}
        </label>
        <output htmlFor={id} style={readoutStyle}>
          {readout}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={readout}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target-min)',
          accentColor: 'var(--color-accent)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}
