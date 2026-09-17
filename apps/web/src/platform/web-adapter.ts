import type { PlatformAdapter } from './platform-adapter';

export class WebAdapter implements PlatformAdapter {
  pickImage(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) resolve(file);
        else reject(new Error('No file selected'));
      });
      // Supported in modern Chromium/Firefox; browsers without it simply
      // leave the promise pending until a file is chosen.
      input.addEventListener('cancel', () => reject(new Error('Import cancelled')));
      input.click();
    });
  }

  async saveFile(blob: Blob, suggestedName: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestedName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async share(blob: Blob, title?: string): Promise<void> {
    const file = new File([blob], title ?? 'reference.png', { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
    await this.saveFile(blob, title ?? 'reference.png');
  }
}
