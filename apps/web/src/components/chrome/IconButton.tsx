'use client';

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FocusEvent, type PointerEvent } from 'react';
import type { Icon } from '@phosphor-icons/react';

// Hover shows the tooltip after a short delay so it does not flicker as the
// pointer crosses a rail of buttons; keyboard focus shows it immediately.
// Neither animates -- the tooltip simply appears (docs/design.md §7).
const HOVER_DELAY_MS = 300;
const TOOLTIP_OFFSET_PX = 10;

type TooltipSide = 'right' | 'bottom' | 'top';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: Icon;
  // The accessible name -- always present -- and the tooltip text.
  label: string;
  // A short label shown under the icon (Compact, where there is no hover). When
  // set the tooltip is unnecessary and is not rendered.
  visibleLabel?: string;
  // The active tool: exposes aria-pressed, switches the icon to its filled weight
  // and gives the button the amber glow, so the state is never colour-only.
  // Leave undefined for buttons that are not toggles.
  active?: boolean;
  // 'tool' (default) glows amber -- reserved for the active tool. 'toggle' is for
  // any other on/off button and glows with the general cyan accent instead.
  tone?: 'tool' | 'toggle';
  tooltipSide?: TooltipSide;
}

// The one icon-only control (docs/design.md §7): a 44px target, an aria-label,
// and a tooltip. The icon is decorative beside its name, so it is aria-hidden.
export function IconButton({
  icon: IconGlyph,
  label,
  visibleLabel,
  active,
  tone = 'tool',
  tooltipSide = 'right',
  className,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...rest
}: IconButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const wantsTooltip = !visibleLabel;

  const clearTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const hide = () => {
    clearTimer();
    setTip(null);
  };
  const show = () => {
    const el = ref.current;
    if (!el || !wantsTooltip) return;
    const r = el.getBoundingClientRect();
    if (tooltipSide === 'right') setTip({ x: r.right + TOOLTIP_OFFSET_PX, y: r.top + r.height / 2 });
    else if (tooltipSide === 'bottom') setTip({ x: r.left + r.width / 2, y: r.bottom + TOOLTIP_OFFSET_PX });
    else setTip({ x: r.left + r.width / 2, y: r.top - TOOLTIP_OFFSET_PX });
  };

  useEffect(() => clearTimer, []);

  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={['icon-btn', visibleLabel ? 'icon-btn--labeled' : '', tone === 'toggle' ? 'icon-btn--toggle' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-pressed={active}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        hide();
        onPointerDown?.(event);
      }}
      onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
        // Touch has no hover; a tap must not leave a tooltip behind.
        if (event.pointerType !== 'touch' && wantsTooltip && !event.currentTarget.disabled) {
          clearTimer();
          timer.current = setTimeout(show, HOVER_DELAY_MS);
        }
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
        hide();
        onPointerLeave?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLButtonElement>) => {
        // Only keyboard focus: a mouse click also focuses the button, but the
        // pointer path above already handles that.
        if (event.currentTarget.matches(':focus-visible')) show();
        onFocus?.(event);
      }}
      onBlur={(event: FocusEvent<HTMLButtonElement>) => {
        hide();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        // Dismissible without moving the pointer or focus (WCAG 1.4.13).
        if (event.key === 'Escape') hide();
        onKeyDown?.(event);
      }}
    >
      <IconGlyph size={22} weight={active ? 'fill' : 'regular'} aria-hidden />
      {visibleLabel ? <span className="icon-btn__label">{visibleLabel}</span> : null}
      {tip ? (
        <span aria-hidden className="tooltip" data-side={tooltipSide} style={{ left: tip.x, top: tip.y }}>
          {label}
        </span>
      ) : null}
    </button>
  );
}
