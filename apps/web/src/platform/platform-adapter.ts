// The single platform-branching seam (docs/architecture/10-mobile-android-shell.md).
// Every other module calls only this interface, never browser file-input/
// download APIs or Capacitor plugins directly. WebAdapter is the only
// implementation until Phase 4 adds CapacitorAdapter selected at runtime via
// Capacitor.isNativePlatform().
export interface PickImageOptions {
  // Open the camera rather than the photo library, where the device has one
  // (a Check Photo on the iPad or a phone). Elsewhere it is the file picker.
  camera?: boolean;
}

export interface PlatformAdapter {
  pickImage(options?: PickImageOptions): Promise<Blob>;
  saveFile(blob: Blob, suggestedName: string): Promise<void>;
  share(blob: Blob, title?: string): Promise<void>;
}
