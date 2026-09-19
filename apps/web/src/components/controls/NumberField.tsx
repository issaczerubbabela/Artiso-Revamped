'use client';

import { useId, useState } from 'react';
import { parseDecimal } from '@artiso/core-engine';
import { controlRowStyle, inputBaseStyle, labelStyle, readoutStyle } from './styles';

interface NumberFieldProps {
  label: string;
  value: number;
  // Called only with a valid number, when the user finishes editing (Enter or
  // leaving the field) -- never on every keystroke, so a half-typed "2" on the
  // way to "25" can't be applied as a 2 mm grid.
  onCommit: (value: number) => void;
  // How the committed value reads when the field isn't being edited.
  format?: (value: number) => string;
  // Shown after the value, e.g. the unit.
  suffix?: string;
  // The value must be greater than this (default 0).
  greaterThan?: number;
  // Descriptive text tied to the input for assistive tech, e.g. a DPI hint.
  describedBy?: string;
  disabled?: boolean;
}

// Exact numeric entry (a paper size, a cell size). Text-based rather than
// type="number" so there are no spinner buttons and a comma decimal works.
// Invalid input is flagged and reverts on blur instead of being applied.
export function NumberField({
  label,
  value,
  onCommit,
  format,
  suffix,
  greaterThan = 0,
  describedBy,
  disabled,
}: NumberFieldProps) {
  const id = useId();
  // null = not editing: show the formatted committed value.
  const [draft, setDraft] = useState<string | null>(null);

  const shown = draft ?? (format ? format(value) : String(value));
  const parsed = draft === null ? null : parseDecimal(draft);
  const invalid = draft !== null && (parsed === null || !(parsed > greaterThan));

  function commit() {
    if (draft !== null && parsed !== null && parsed > greaterThan) onCommit(parsed);
    setDraft(null);
  }

  return (
    <div style={controlRowStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={shown}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          style={{
            ...inputBaseStyle,
            ...readoutStyle,
            flex: 1,
            minWidth: 0,
            border: `1px solid ${invalid ? 'var(--color-danger)' : 'var(--color-border)'}`,
          }}
        />
        {suffix ? <span style={{ ...readoutStyle, color: 'var(--color-ink-muted)' }}>{suffix}</span> : null}
      </div>
    </div>
  );
}
