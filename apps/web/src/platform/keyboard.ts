// Whether this is an Apple platform, where ⌘ is the shortcut modifier (Ctrl
// stands in for it everywhere else). Read from the <html data-platform> mark
// the head script sets before first paint (apple-fonts.ts), so the keys and
// the fonts can never disagree about the platform.
export function isApple(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-platform') === 'apple';
}
