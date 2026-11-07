import { isImageFile, resolveImageType } from '@artiso/core-engine';
import { useWorkspaceStore } from '@/state/workspace-store';
import { importReferenceBlob } from './import-reference';

// Paste and drop (issue #10): the one entry point both share. Each image opens
// as a new reference tab through the same import path as the file picker, so
// the tab list, the import errors and the import-error surface all behave the
// same way. HEIC is accepted where the browser can decode it; the decode error
// asks for a JPEG where it can't.

export type ImportSource = 'paste' | 'drop';

// Imports run one after another, even across separate pastes and drops, so the
// tabs open in the order the images came in.
let queue: Promise<void> = Promise.resolve();

// A file with its type filled in from the extension when the browser gave none
// (a HEIC photo dragged from the Files app often has none).
function withResolvedType(file: File): File {
  const type = resolveImageType(file.type, file.name);
  return type === file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}

function nothingToImport(source: ImportSource): string {
  return source === 'paste'
    ? 'There is no image to paste. Copy a photo, then paste it here.'
    : 'Only images can be dropped here.';
}

// Opens every image among `files` as a new reference tab. Anything that is not
// an image, or that fails to import, is reported on the import-error surface.
export function importFiles(files: readonly File[], source: ImportSource): Promise<void> {
  const run = queue.then(() => importNow(files, source));
  queue = run.catch(() => {});
  return run;
}

async function importNow(files: readonly File[], source: ImportSource): Promise<void> {
  const store = useWorkspaceStore.getState();
  store.setImportError(null);
  const resolved = files.map(withResolvedType);
  const images = resolved.filter((file) => isImageFile(file.type));
  const errors: string[] = resolved
    .filter((file) => !isImageFile(file.type))
    .map((file) => (file.name ? `"${file.name}" isn't an image.` : "That isn't an image."));
  if (images.length === 0 && errors.length === 0) errors.push(nothingToImport(source));

  if (images.length > 0) {
    store.setImporting(true);
    try {
      for (const image of images) {
        try {
          await importReferenceBlob(image);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Import failed.';
          errors.push(images.length > 1 && image.name ? `"${image.name}": ${message}` : message);
        }
      }
    } finally {
      useWorkspaceStore.getState().setImporting(false);
    }
  }
  // Set after the imports: opening a reference clears the import error.
  if (errors.length > 0) useWorkspaceStore.getState().setImportError(errors.join(' '));
}

// Paste from the canvas menu: reads the system clipboard (on an iPad, Safari
// asks with its own Paste button first). Images open as new tabs; anything
// else gets the same message as ⌘V would.
export async function pasteFromClipboard(): Promise<void> {
  // ⌘ on Apple platforms (marked on <html> by apple-fonts.ts), Ctrl elsewhere.
  const pasteKey = document.documentElement.dataset.platform === 'apple' ? '⌘V' : 'Ctrl+V';
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard || typeof clipboard.read !== 'function') {
    useWorkspaceStore.getState().setImportError(`This browser can't paste from the menu. Press ${pasteKey} instead.`);
    return;
  }
  let items: ClipboardItems;
  try {
    items = await clipboard.read();
  } catch {
    useWorkspaceStore.getState().setImportError(`Artiso wasn't allowed to read the clipboard. Press ${pasteKey} instead.`);
    return;
  }
  const files: File[] = [];
  for (const [index, item] of items.entries()) {
    const type = item.types.find((t) => isImageFile(t));
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(new File([blob], `pasted-${index + 1}.${type.slice('image/'.length)}`, { type }));
  }
  await importFiles(files, 'paste');
}
