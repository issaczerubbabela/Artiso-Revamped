import { create } from 'zustand';
import { ScreenCalibrationSchema, UnitSchema, type ScreenCalibration, type Unit } from '@artiso/shared-types';

// Device-local display preferences (docs/architecture/Grid-Feature-Spec.md §3,
// §10): which unit lengths are entered in, the DPI that turns px into mm, and
// the screen calibration behind Real size. These describe *this device* -- a
// phone and a desktop have different physical pixel densities -- so they live
// in localStorage and are never synced with the Reference.

const STORAGE_KEY = 'artiso.display.v1';
export const DEFAULT_DISPLAY_DPI = 300;

interface Persisted {
  unit: Unit;
  dpi: number;
  screen: ScreenCalibration | null;
}

const DEFAULTS: Persisted = { unit: 'mm', dpi: DEFAULT_DISPLAY_DPI, screen: null };

// Every storage access is guarded: it throws in some private windows and with
// blocked site data, and doesn't exist during server prerendering. The app must
// simply behave as if nothing were stored.
function read(): Persisted {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const json = JSON.parse(raw) as Record<string, unknown>;
    const unit = UnitSchema.safeParse(json.unit);
    const screen = ScreenCalibrationSchema.nullable().safeParse(json.screen ?? null);
    const dpi = typeof json.dpi === 'number' && json.dpi > 0 && Number.isFinite(json.dpi) ? json.dpi : DEFAULTS.dpi;
    return {
      unit: unit.success ? unit.data : DEFAULTS.unit,
      dpi,
      screen: screen.success ? screen.data : null,
    };
  } catch {
    return DEFAULTS;
  }
}

function write(value: Persisted): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Unwritable storage just means the choice isn't remembered.
  }
}

interface DisplayState extends Persisted {
  setUnit: (unit: Unit) => void;
  setDpi: (dpi: number) => void;
  setScreen: (screen: ScreenCalibration | null) => void;
}

export const useDisplayStore = create<DisplayState>((set, get) => {
  const persist = (patch: Partial<Persisted>) => {
    set(patch);
    const { unit, dpi, screen } = get();
    write({ unit, dpi, screen });
  };
  return {
    ...read(),
    setUnit: (unit) => persist({ unit }),
    setDpi: (dpi) => {
      if (dpi > 0 && Number.isFinite(dpi)) persist({ dpi });
    },
    setScreen: (screen) => persist({ screen }),
  };
});
