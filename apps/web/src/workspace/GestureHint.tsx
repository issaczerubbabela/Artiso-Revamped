'use client';

import { X } from '@phosphor-icons/react';
import { IconButton } from '@/components/chrome/IconButton';
import { useHelpStore } from '@/state/help-store';
import { GESTURES_AND_SHORTCUTS } from './ShortcutsCard';

// The one-time gesture hint (issue #11): one line on the empty canvas the first
// time on a device, so the invisible gestures can be found without a tutorial.
// Gone for good once dismissed or once a reference is open (help-store).
export function GestureHint() {
  const seen = useHelpStore((s) => s.gestureHintSeen);
  const openCard = useHelpStore((s) => s.openCard);
  const markSeen = useHelpStore((s) => s.markGestureHintSeen);
  if (seen) return null;
  return (
    <div className="panel pill gesture-hint" role="note" data-testid="gesture-hint">
      <span className="gesture-hint__text">Pinch to zoom, twist to turn, long-press for the menu.</span>
      <button type="button" className="gesture-hint__link" onClick={openCard}>
        {GESTURES_AND_SHORTCUTS}
      </button>
      <IconButton icon={X} label="Dismiss hint" tooltipSide="bottom" onClick={markSeen} />
    </div>
  );
}
