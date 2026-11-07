'use client';

import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { GESTURES, SHORTCUTS, formatShortcut } from '@artiso/renderer';
import { IconButton } from '@/components/chrome/IconButton';
import { useHelpStore } from '@/state/help-store';
import { isApple } from '@/platform/keyboard';

export const GESTURES_AND_SHORTCUTS = 'Gestures & shortcuts';

// The Gestures & shortcuts card (issue #11): a matte dialog listing every
// gesture and keyboard shortcut. The shortcut rows are generated from the same
// registry the key handler reads, so the card can't drift from the real keys.
// Opens from the canvas menu, the first-run hint, `?` or holding ⌘; closes on
// Esc, the close button or a tap outside. Appears and closes instantly.
export function ShortcutsCard() {
  const open = useHelpStore((s) => s.cardOpen);
  if (!open) return null;
  return <Card />;
}

function Card() {
  const close = useHelpStore((s) => s.closeCard);
  const ref = useRef<HTMLDivElement>(null);
  const apple = isApple();

  useEffect(() => {
    // Back to wherever the artist was when it closes.
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [close]);

  return (
    <div className="dialog-scrim" onClick={close}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-card-title"
        data-testid="shortcuts-card"
        tabIndex={-1}
        className="panel shortcuts-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <h2 id="shortcuts-card-title" className="panel-title">
            {GESTURES_AND_SHORTCUTS}
          </h2>
          <IconButton icon={X} label="Close" tooltipSide="bottom" onClick={close} />
        </div>
        <div className="shortcuts-card__columns">
          <section aria-labelledby="shortcuts-card-gestures">
            <h3 id="shortcuts-card-gestures" className="shortcuts-card__heading">
              Gestures
            </h3>
            <dl className="shortcuts-card__list">
              {GESTURES.map((g) => (
                <div key={g.gesture} className="shortcuts-card__row">
                  <dt>{g.gesture}</dt>
                  <dd>{g.description}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="shortcuts-card-keys">
            <h3 id="shortcuts-card-keys" className="shortcuts-card__heading">
              Keyboard
            </h3>
            <dl className="shortcuts-card__list" data-testid="shortcuts-card-keys">
              {SHORTCUTS.map((s) => (
                <div key={s.id} className="shortcuts-card__row">
                  <dt>
                    <kbd className="shortcuts-card__key">{formatShortcut(s, apple)}</kbd>
                  </dt>
                  <dd>{s.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
