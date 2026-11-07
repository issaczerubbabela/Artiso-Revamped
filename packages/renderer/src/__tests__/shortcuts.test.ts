import { describe, expect, it } from 'vitest';
import {
  GESTURES,
  MODIFIER_HOLD_MS,
  ModifierHoldDetector,
  SHORTCUTS,
  formatShortcut,
  isApplePlatform,
  isEditableTarget,
  matchShortcut,
  primaryModifierKey,
  shortcutAllowedOn,
  type KeyStroke,
  type ShortcutId,
} from '../shortcuts';
import type { LongPressTimers } from '../long-press';

const stroke = (key: string, mods: Partial<Omit<KeyStroke, 'key'>> = {}): KeyStroke => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

const id = (s: KeyStroke, apple: boolean) => matchShortcut(s, apple)?.id ?? null;

describe('the shortcut registry', () => {
  it('has one entry per action, each with a description', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected: ShortcutId[] = [
      'toggleGrid',
      'immersive',
      'fit',
      'resetRotation',
      'previousCell',
      'nextCell',
      'peekGrid',
      'undo',
      'paste',
      'showShortcuts',
    ];
    expect([...ids].sort()).toEqual([...expected].sort());
    for (const s of SHORTCUTS) expect(s.description.length).toBeGreaterThan(0);
  });

  it('maps the plain keys, in either case', () => {
    for (const apple of [true, false]) {
      expect(id(stroke('g'), apple)).toBe('toggleGrid');
      expect(id(stroke('G', { shiftKey: false }), apple)).toBe('toggleGrid');
      expect(id(stroke('f'), apple)).toBe('immersive');
      expect(id(stroke('0'), apple)).toBe('fit');
      expect(id(stroke('r'), apple)).toBe('resetRotation');
      expect(id(stroke('ArrowLeft'), apple)).toBe('previousCell');
      expect(id(stroke('ArrowRight'), apple)).toBe('nextCell');
      expect(id(stroke(' '), apple)).toBe('peekGrid');
      expect(id(stroke('?', { shiftKey: true }), apple)).toBe('showShortcuts');
    }
  });

  it('leaves keys it does not know, and plain keys with a modifier, alone', () => {
    expect(id(stroke('x'), true)).toBeNull();
    expect(id(stroke('ArrowUp'), true)).toBeNull();
    // ⌘G, Alt+R, Shift+→ and Ctrl+0 belong to the browser or the system.
    expect(id(stroke('g', { metaKey: true }), true)).toBeNull();
    expect(id(stroke('r', { altKey: true }), false)).toBeNull();
    expect(id(stroke('ArrowRight', { shiftKey: true }), false)).toBeNull();
    expect(id(stroke('0', { ctrlKey: true }), false)).toBeNull();
    // A plain Z or V is not undo or paste.
    expect(id(stroke('z'), true)).toBeNull();
    expect(id(stroke('v'), false)).toBeNull();
  });

  it('uses ⌘ on Apple platforms and Ctrl everywhere else', () => {
    expect(id(stroke('z', { metaKey: true }), true)).toBe('undo');
    expect(id(stroke('z', { ctrlKey: true }), true)).toBeNull();
    expect(id(stroke('z', { ctrlKey: true }), false)).toBe('undo');
    expect(id(stroke('z', { metaKey: true }), false)).toBeNull();
    expect(id(stroke('v', { metaKey: true }), true)).toBe('paste');
    expect(id(stroke('V', { ctrlKey: true }), false)).toBe('paste');
    // Shift+⌘Z is redo, which Artiso doesn't have.
    expect(id(stroke('z', { metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(primaryModifierKey(true)).toBe('Meta');
    expect(primaryModifierKey(false)).toBe('Control');
  });

  it('labels each shortcut for the platform it is on', () => {
    const undo = SHORTCUTS.find((s) => s.id === 'undo')!;
    expect(formatShortcut(undo, true)).toBe('⌘Z');
    expect(formatShortcut(undo, false)).toBe('Ctrl+Z');
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === 'toggleGrid')!, true)).toBe('G');
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === 'peekGrid')!, false)).toBe('Hold Space');
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === 'nextCell')!, true)).toBe('→');
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === 'showShortcuts')!, true)).toBe('? or hold ⌘');
    expect(formatShortcut(SHORTCUTS.find((s) => s.id === 'showShortcuts')!, false)).toBe('? or hold Ctrl');
  });

  it('recognises Apple platforms, iPadOS reporting itself as a Mac included', () => {
    expect(isApplePlatform('MacIntel', '')).toBe(true);
    expect(isApplePlatform('iPad', '')).toBe(true);
    expect(isApplePlatform('', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isApplePlatform('Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(isApplePlatform('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
  });

  it('lists the gestures alongside, each with what it does', () => {
    expect(GESTURES.length).toBeGreaterThan(0);
    for (const g of GESTURES) {
      expect(g.gesture.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
    }
  });
});

describe('the editable-field guard', () => {
  const shortcut = (which: ShortcutId) => SHORTCUTS.find((s) => s.id === which)!;

  it('treats text-like fields as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isEditableTarget({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isEditableTarget({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('does not treat buttons, sliders or the canvas as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(isEditableTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isEditableTarget({ tagName: 'DIV', role: 'group' })).toBe(false);
    expect(isEditableTarget({ tagName: 'BODY' })).toBe(false);
  });

  it('ignores every shortcut while typing in a field', () => {
    for (const s of SHORTCUTS) {
      expect(shortcutAllowedOn(s, { tagName: 'INPUT', type: 'number' })).toBe(false);
      expect(shortcutAllowedOn(s, { tagName: 'TEXTAREA' })).toBe(false);
    }
  });

  it('leaves Space and the arrows to a focused control, which uses them itself', () => {
    const controls = [
      { tagName: 'BUTTON' },
      { tagName: 'INPUT', type: 'range' },
      { tagName: 'DIV', role: 'menuitem' },
      { tagName: 'DIV', role: 'slider' },
      { tagName: 'DIV', role: 'switch' },
    ];
    for (const target of controls) {
      expect(shortcutAllowedOn(shortcut('peekGrid'), target)).toBe(false);
      expect(shortcutAllowedOn(shortcut('nextCell'), target)).toBe(false);
      expect(shortcutAllowedOn(shortcut('previousCell'), target)).toBe(false);
      // Letter keys still work after tapping a button.
      expect(shortcutAllowedOn(shortcut('toggleGrid'), target)).toBe(true);
    }
  });

  it('allows everything on the page and the canvas', () => {
    for (const s of SHORTCUTS) {
      expect(shortcutAllowedOn(s, { tagName: 'BODY' })).toBe(true);
      expect(shortcutAllowedOn(s, { tagName: 'DIV', role: 'group' })).toBe(true);
      expect(shortcutAllowedOn(s, null)).toBe(true);
    }
  });
});

class FakeTimers implements LongPressTimers {
  private now = 0;
  private next = 1;
  private readonly pending = new Map<number, { at: number; callback: () => void }>();
  set(callback: () => void, ms: number): number {
    const handle = this.next++;
    this.pending.set(handle, { at: this.now + ms, callback });
    return handle;
  }
  clear(handle: number): void {
    this.pending.delete(handle);
  }
  advance(ms: number): void {
    this.now += ms;
    for (const [handle, timer] of [...this.pending]) {
      if (timer.at <= this.now) {
        this.pending.delete(handle);
        timer.callback();
      }
    }
  }
}

describe('ModifierHoldDetector (hold ⌘ for the card)', () => {
  function setup() {
    const timers = new FakeTimers();
    let holds = 0;
    const detector = new ModifierHoldDetector({ timers, onHold: () => holds++ });
    return { timers, detector, holds: () => holds };
  }

  it('fires once ⌘ has been held alone for about a second', () => {
    const { timers, detector, holds } = setup();
    detector.press();
    timers.advance(MODIFIER_HOLD_MS - 1);
    expect(holds()).toBe(0);
    timers.advance(1);
    expect(holds()).toBe(1);
  });

  it('does not fire when ⌘ is part of a chord or let go early', () => {
    const { timers, detector, holds } = setup();
    detector.press();
    timers.advance(300);
    detector.interrupt(); // ⌘Z
    timers.advance(MODIFIER_HOLD_MS);
    expect(holds()).toBe(0);
    detector.press();
    timers.advance(500);
    detector.interrupt(); // released
    timers.advance(MODIFIER_HOLD_MS);
    expect(holds()).toBe(0);
  });

  it('ignores key repeat while held, and fires once per hold', () => {
    const { timers, detector, holds } = setup();
    detector.press();
    timers.advance(600);
    detector.press(); // auto-repeat must not restart the wait
    timers.advance(400);
    expect(holds()).toBe(1);
    detector.press();
    timers.advance(MODIFIER_HOLD_MS * 2);
    expect(holds()).toBe(1);
    detector.interrupt();
    detector.press();
    timers.advance(MODIFIER_HOLD_MS);
    expect(holds()).toBe(2);
  });

  it('stops on dispose', () => {
    const { timers, detector, holds } = setup();
    detector.press();
    detector.dispose();
    timers.advance(MODIFIER_HOLD_MS);
    expect(holds()).toBe(0);
  });
});
