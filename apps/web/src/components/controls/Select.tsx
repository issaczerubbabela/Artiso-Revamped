'use client';

import { useId } from 'react';
import { controlRowStyle, inputBaseStyle, labelStyle } from './styles';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

// A long or rarely-changed list gets a dropdown (docs/design.md §4).
export function Select<T extends string>({ label, value, options, onChange, disabled }: SelectProps<T>) {
  const id = useId();
  return (
    <div style={controlRowStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        style={{ ...inputBaseStyle, width: '100%', cursor: disabled ? 'default' : 'pointer' }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
