// Installable / offline web app plumbing (see scripts/generate-sw.mjs).

// Registers the generated service worker. Production builds only: `next dev`
// serves no sw.js, and a worker caching dev chunks would mask hot reloads.
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Not fatal: the app still works online without it.
  });
}

// Asks the browser not to evict this origin's storage (IndexedDB holds the
// local projects and any edits not yet synced). Safari otherwise clears
// script-written storage for sites unused for ~7 days unless the app is on the
// home screen; Chromium grants this for installed apps. Best effort.
export function requestPersistentStorage(): void {
  if (typeof navigator === 'undefined') return;
  void navigator.storage?.persist?.().catch(() => false);
}
