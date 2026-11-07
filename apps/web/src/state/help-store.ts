import { create } from 'zustand';

// The Gestures & shortcuts card and the one-time gesture hint (issue #11).
// Whether the hint has been seen is device-local -- a new device is a new
// first time -- so it lives in localStorage and is never synced.

const STORAGE_KEY = 'artiso.hints.v1';

function readHintSeen(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw !== null && (JSON.parse(raw) as { gestureHintSeen?: unknown }).gestureHintSeen === true;
  } catch {
    return false;
  }
}

function writeHintSeen(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify({ gestureHintSeen: true }));
  } catch {
    // Unwritable storage: the hint may show again next time, which is harmless.
  }
}

interface HelpState {
  cardOpen: boolean;
  openCard: () => void;
  closeCard: () => void;
  toggleCard: () => void;

  // Shown once per device, on the empty canvas; never again once dismissed or
  // once a reference has been opened.
  gestureHintSeen: boolean;
  markGestureHintSeen: () => void;
}

export const useHelpStore = create<HelpState>((set, get) => ({
  cardOpen: false,
  openCard: () => set({ cardOpen: true }),
  closeCard: () => set({ cardOpen: false }),
  toggleCard: () => set({ cardOpen: !get().cardOpen }),
  // Read lazily on the client: the static export prerenders without storage,
  // and the hint must not flash for a returning artist.
  gestureHintSeen: true,
  markGestureHintSeen: () => {
    writeHintSeen();
    set({ gestureHintSeen: true });
  },
}));

// Loads the stored value once the app is running in the browser.
export function loadGestureHintSeen(): void {
  useHelpStore.setState({ gestureHintSeen: readHintSeen() });
}
