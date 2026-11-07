import {
  ModifierHoldDetector,
  matchShortcut,
  primaryModifierKey,
  shortcutAllowedOn,
  type Shortcut,
  type ShortcutTarget,
} from '@artiso/renderer';
import { isApple } from '@/platform/keyboard';
import { useAppViewStore } from '@/state/app-view-store';
import { useDisplayStore } from '@/state/display-store';
import { useHelpStore } from '@/state/help-store';
import { isTouchLocked } from '@/state/input-store';
import { useWorkspaceStore } from '@/state/workspace-store';
import { focusedViewControls } from './view-controls';

// The keyboard shortcuts (issue #11): one window-level handler that looks each
// key up in the registry (@artiso/renderer's SHORTCUTS) and runs the existing
// store action behind it. A key it doesn't act on is left entirely alone, so
// the browser, a focused control or another handler still gets it.

function describe(target: EventTarget | null): ShortcutTarget | null {
  if (!(target instanceof Element)) return null;
  return {
    tagName: target.tagName,
    type: target instanceof HTMLInputElement ? target.type : null,
    role: target.getAttribute('role'),
    isContentEditable: target instanceof HTMLElement && target.isContentEditable,
  };
}

// A reference is open in the workspace.
function referenceOpen(): boolean {
  return useAppViewStore.getState().view === 'workspace' && useWorkspaceStore.getState().workingBitmap !== null;
}

// Fit and squaring up move the view, which Presentation mode and Touch Lock
// both hold still (the zoom pill disables the same buttons), and the Paper
// tool frames the crop with its own view.
function viewMayMove(): boolean {
  const state = useWorkspaceStore.getState();
  return referenceOpen() && !state.presentationMode && state.toolMode !== 'paper' && !isTouchLocked();
}

// Runs a shortcut; true when it acted, so its key is consumed.
function run(shortcut: Shortcut): boolean {
  const workspace = useWorkspaceStore.getState();
  const display = useDisplayStore.getState();
  switch (shortcut.id) {
    case 'showShortcuts':
      useHelpStore.getState().toggleCard();
      return true;
    case 'toggleGrid':
      if (!referenceOpen()) return false;
      display.setGridHidden(!display.gridHidden);
      return true;
    case 'peekGrid':
      if (!referenceOpen()) return false;
      display.setGridPeek(true);
      return true;
    case 'immersive':
      if (!referenceOpen()) return false;
      workspace.setPresentationMode(!workspace.presentationMode);
      return true;
    case 'fit':
    case 'resetRotation': {
      const controls = focusedViewControls();
      if (!controls || !viewMayMove()) return false;
      if (shortcut.id === 'fit') controls.fit();
      else controls.resetRotation();
      return true;
    }
    case 'previousCell':
    case 'nextCell': {
      const controls = focusedViewControls();
      if (!controls || !referenceOpen() || workspace.presentationMode || workspace.toolMode === 'paper') return false;
      return controls.stepCell(shortcut.id === 'nextCell' ? 1 : -1);
    }
    case 'undo':
      // The same undo as the Draw panel's Undo last and the two-finger tap.
      if (!referenceOpen() || workspace.presentationMode || workspace.toolMode !== 'annotate') return false;
      workspace.removeLastAnnotation();
      return true;
    case 'paste':
      // The browser raises a paste event, which PasteDropImport handles.
      return false;
  }
}

export function startKeyboardShortcuts(): () => void {
  const apple = isApple();
  const modifier = primaryModifierKey(apple);
  const hold = new ModifierHoldDetector({ onHold: () => useHelpStore.getState().openCard() });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === modifier) hold.press();
    else hold.interrupt();
    if (event.defaultPrevented || event.isComposing) return;
    const shortcut = matchShortcut(event, apple);
    if (!shortcut || shortcut.native) return;
    if (!shortcutAllowedOn(shortcut, describe(event.target))) return;
    // While the card is open only `?` (which closes it) acts; Esc is the card's.
    if (useHelpStore.getState().cardOpen && shortcut.id !== 'showShortcuts') return;
    if (event.repeat && !shortcut.repeats) {
      // Space keeps the grid hidden; its repeats must not scroll the page.
      if (shortcut.hold && useDisplayStore.getState().gridPeek) event.preventDefault();
      return;
    }
    if (run(shortcut)) event.preventDefault();
  };
  // Space-hold ends however the key is let go -- even with focus elsewhere by
  // then, or the window left with the key still down.
  const endPeek = () => useDisplayStore.getState().setGridPeek(false);
  const onKeyUp = (event: KeyboardEvent) => {
    hold.interrupt();
    if (event.key === ' ') endPeek();
  };
  const onBlur = () => {
    hold.interrupt();
    endPeek();
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    hold.dispose();
    endPeek();
  };
}
