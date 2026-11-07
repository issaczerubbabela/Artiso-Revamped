import { useEffect } from 'react';

// Keeps the screen awake while the workspace is open. The artist glances at
// the reference between strokes on paper and never touches the device for
// minutes at a time -- without this, phones and tablets dim and lock mid-draw.
//
// The browser drops a wake lock whenever the page is hidden, so it is
// re-requested each time the page becomes visible again. Unsupported browsers
// (or a denied request, e.g. low-power mode) simply keep the default timeout.
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied or unavailable right now; the next visibility change retries.
      }
    };

    const onVisibility = () => void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    void acquire();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
