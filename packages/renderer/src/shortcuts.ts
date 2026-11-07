import { systemTimers, type LongPressTimers } from './long-press';

// Keyboard shortcuts (issue #11): one registry, read both by the key handler and
// by the Gestures & shortcuts card, so the card can never drift from what the
// keys really do. The app binds each id to an existing store action; this
// module only knows keys, platforms and which focused element owns a key.

export type ShortcutId =
  | 'toggleGrid'
  | 'immersive'
  | 'fit'
  | 'resetRotation'
  | 'previousCell'
  | 'nextCell'
  | 'peekGrid'
  | 'undo'
  | 'paste'
  | 'showShortcuts';

export interface Shortcut {
  id: ShortcutId;
  // KeyboardEvent.key, lower case for letters.
  key: string;
  // Needs ⌘ (Apple) / Ctrl (everywhere else).
  primary?: boolean;
  // Acts while held and stops on release (Space: hide the grid).
  hold?: boolean;
  // Acts again on key repeat (← → step on through the cells).
  repeats?: boolean;
  // The browser does it itself (⌘V raises the paste event the app already
  // listens to), so the key handler must let the key through untouched.
  native?: boolean;
  description: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'toggleGrid', key: 'g', description: 'Show or hide the grid' },
  { id: 'peekGrid', key: ' ', hold: true, description: 'Hide the grid until you let go' },
  { id: 'immersive', key: 'f', description: 'Immersive mode on or off' },
  { id: 'fit', key: '0', description: 'Fit to screen' },
  { id: 'resetRotation', key: 'r', description: 'Reset View Rotation to 0°' },
  { id: 'previousCell', key: 'ArrowLeft', repeats: true, description: 'Previous cell (Cell Focus)' },
  { id: 'nextCell', key: 'ArrowRight', repeats: true, description: 'Next cell (Cell Focus)' },
  { id: 'undo', key: 'z', primary: true, description: 'Undo the last mark (Draw)' },
  { id: 'paste', key: 'v', primary: true, native: true, description: 'Paste an image as a new tab' },
  { id: 'showShortcuts', key: '?', description: 'Gestures & shortcuts' },
];

export interface Gesture {
  gesture: string;
  description: string;
}

// The gestures the canvas already understands (Phases 11 and 12). Static: they
// have no keys to look up, but they sit in the same card as the shortcuts.
export const GESTURES: readonly Gesture[] = [
  { gesture: 'Pinch', description: 'Zoom' },
  { gesture: 'Drag', description: 'Move the reference' },
  { gesture: 'Twist with two fingers', description: 'Turn the View Rotation' },
  { gesture: 'Double-tap', description: 'Fit to screen and square up' },
  { gesture: 'Long-press', description: 'Canvas menu' },
  { gesture: 'Two-finger tap', description: 'Undo the last mark (Draw)' },
  { gesture: 'Three-finger tap', description: 'Show or hide the grid' },
  { gesture: 'Tap a cell', description: 'Focus it (while Cell Focus is on)' },
  { gesture: 'Long-press the focused cell', description: 'Mark it as a Done Cell' },
  { gesture: 'Hover the Pencil', description: 'Show the cell under the tip' },
  { gesture: 'Shift+drag or Ctrl+scroll', description: 'Turn or zoom with a mouse' },
];

export interface KeyStroke {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

// iPadOS Safari reports itself as a Mac, so a Mac check covers the iPad too
// (the same test as the font switch in apps/web's apple-fonts.ts).
export function isApplePlatform(platform: string, userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Macintosh|iPhone|iPad|iPod/.test(userAgent);
}

// The KeyboardEvent.key of ⌘ on Apple platforms, of Ctrl, which stands in for
// it, everywhere else.
export function primaryModifierKey(apple: boolean): 'Meta' | 'Control' {
  return apple ? 'Meta' : 'Control';
}

// `?` is typed with Shift on most layouts, so Shift is part of it.
const SHIFT_IS_PART_OF_KEY = new Set(['?']);

export function matchShortcut(stroke: KeyStroke, apple: boolean): Shortcut | null {
  const primary = apple ? stroke.metaKey : stroke.ctrlKey;
  const other = apple ? stroke.ctrlKey : stroke.metaKey;
  if (stroke.altKey || other) return null;
  const key = stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
  const shortcut = SHORTCUTS.find((s) => s.key === key);
  if (!shortcut) return null;
  if (Boolean(shortcut.primary) !== primary) return null;
  if (stroke.shiftKey && !SHIFT_IS_PART_OF_KEY.has(shortcut.key)) return null;
  return shortcut;
}

const KEY_LABELS: Record<string, string> = { ' ': 'Space', ArrowLeft: '←', ArrowRight: '→' };

// How the card shows a shortcut on this platform: ⌘Z on Apple, Ctrl+Z elsewhere.
export function formatShortcut(shortcut: Shortcut, apple: boolean): string {
  const name = KEY_LABELS[shortcut.key] ?? shortcut.key.toUpperCase();
  const chord = shortcut.primary ? (apple ? `⌘${name}` : `Ctrl+${name}`) : name;
  if (shortcut.id === 'showShortcuts') return `${chord} or hold ${apple ? '⌘' : 'Ctrl'}`;
  return shortcut.hold ? `Hold ${chord}` : chord;
}

// What the focused element is, as far as the guard cares.
export interface ShortcutTarget {
  tagName: string;
  type?: string | null;
  role?: string | null;
  isContentEditable?: boolean;
}

// <input> types that take no typing.
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image']);

// A field the artist types into: every shortcut stands aside for it.
export function isEditableTarget(target: ShortcutTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUTS.has((target.type ?? 'text').toLowerCase());
  return false;
}

const CONTROL_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY']);
const CONTROL_ROLES = new Set([
  'button',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'slider',
  'switch',
  'tab',
  'option',
  'radio',
  'checkbox',
  'spinbutton',
  'link',
]);

function isControl(target: ShortcutTarget): boolean {
  return CONTROL_TAGS.has(target.tagName.toUpperCase()) || CONTROL_ROLES.has((target.role ?? '').toLowerCase());
}

// Keys a focused control uses itself: Space presses a button (Drawing Check's
// hold-to-swap, Touch Lock's hold), arrows move a slider, a menu, a sheet or
// a Check Photo corner.
const CONTROL_KEYS = new Set([' ', 'ArrowLeft', 'ArrowRight']);

// Whether a shortcut may act with `target` focused.
export function shortcutAllowedOn(shortcut: Shortcut, target: ShortcutTarget | null): boolean {
  if (isEditableTarget(target)) return false;
  if (target && CONTROL_KEYS.has(shortcut.key) && isControl(target)) return false;
  return true;
}

// How long ⌘ (Ctrl elsewhere) must be held on its own to show the card,
// the way iPad apps show their shortcuts.
export const MODIFIER_HOLD_MS = 1000;

export interface ModifierHoldOptions {
  onHold: () => void;
  timers?: LongPressTimers;
  delayMs?: number;
}

// Recognises ⌘ held alone. The app calls press() on each keydown of the
// modifier (repeats included) and interrupt() on any other key, on release
// and when the window loses focus. It fires once per hold.
export class ModifierHoldDetector {
  private readonly timers: LongPressTimers;
  private readonly delayMs: number;
  private timer: number | null = null;
  private held = false;

  constructor(private readonly options: ModifierHoldOptions) {
    this.timers = options.timers ?? systemTimers;
    this.delayMs = options.delayMs ?? MODIFIER_HOLD_MS;
  }

  press(): void {
    if (this.held) return;
    this.held = true;
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.options.onHold();
    }, this.delayMs);
  }

  interrupt(): void {
    this.held = false;
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  dispose(): void {
    this.interrupt();
  }
}
