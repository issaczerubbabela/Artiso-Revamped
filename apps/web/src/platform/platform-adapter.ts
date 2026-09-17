// The single platform-branching seam (docs/architecture/10-mobile-android-shell.md).
// Every other module calls only this interface, never browser file-input/
// download APIs or Capacitor plugins directly. WebAdapter is the only
// implementation until Phase 4 adds CapacitorAdapter selected at runtime via
// Capacitor.isNativePlatform().
export interface PlatformAdapter {
  pickImage(): Promise<Blob>;
  saveFile(blob: Blob, suggestedName: string): Promise<void>;
  share(blob: Blob, title?: string): Promise<void>;
}
