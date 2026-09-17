import type { PlatformAdapter } from './platform-adapter';
import { WebAdapter } from './web-adapter';

let adapter: PlatformAdapter | undefined;

// The single composition point for adapter selection. Phase 4 adds a
// Capacitor.isNativePlatform() check here to return CapacitorAdapter instead
// -- no other module should ever branch on platform directly.
export function getPlatformAdapter(): PlatformAdapter {
  adapter ??= new WebAdapter();
  return adapter;
}
