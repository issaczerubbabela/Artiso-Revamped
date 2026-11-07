'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { placeMenu } from '@artiso/ui';

export interface CanvasMenuItem {
  label: string;
  onSelect: () => void;
}

// Room kept between the menu and the screen edge, and between it and the press.
const EDGE_PX = 16;
const OFFSET_PX = 10;

// The canvas context menu (docs/design.md §7): a matte menu at the point the
// canvas was long-pressed or right-clicked, or at the canvas centre when opened
// from the keyboard. Standard menu semantics: focus lands on the first item,
// Arrow keys / Home / End move between items, Enter or Space runs one, and Esc,
// Tab or a tap anywhere else closes it. Appears and closes instantly.
export function CanvasMenu({
  point,
  items,
  onClose,
}: {
  point: { x: number; y: number };
  items: readonly CanvasMenuItem[];
  // `returnFocus`: the menu was closed from the keyboard (or ran an item), so
  // focus goes back to the canvas it came from.
  onClose: (returnFocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPosition(
      placeMenu({
        point,
        size: { width: el.offsetWidth, height: el.offsetHeight },
        bounds: { left: EDGE_PX, top: EDGE_PX, right: window.innerWidth - EDGE_PX, bottom: window.innerHeight - EDGE_PX },
        offset: OFFSET_PX,
      }),
    );
  }, [point]);

  useEffect(() => {
    if (position) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [position]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      onClose(false);
    };
    const onResize = () => onClose(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onResize);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = menuItems.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => menuItems[(i + menuItems.length) % menuItems.length]?.focus();
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(menuItems.length - 1);
        break;
      case 'Escape':
        onClose(true);
        break;
      case 'Tab':
        onClose(false);
        return; // let focus move on
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Canvas"
      data-testid="canvas-menu"
      className="panel canvas-menu"
      style={position ?? { left: 0, top: 0, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className="canvas-menu__item"
          onClick={() => {
            item.onSelect();
            onClose(true);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
