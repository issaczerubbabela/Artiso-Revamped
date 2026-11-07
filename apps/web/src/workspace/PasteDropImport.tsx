'use client';

import { useEffect, useState } from 'react';
import { importFiles } from '@/session/import-files';

// Paste (⌘V / Ctrl+V) and drag-and-drop anywhere in the app (issue #10): each
// image opens as a new reference tab, whether the Projects screen or a
// reference is showing. While something is dragged over the window a drop
// target covers it, so the artist knows a drop will land. Mounted once at the
// app root.

// Typing in a field keeps the browser's own paste.
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}

// A drag from outside the page: files, or a link to an image from Safari.
function carriesContent(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('Files') || types.includes('text/uri-list');
}

function filesOf(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []);
  if (files.length > 0) return files;
  // Some browsers list a pasted image only among the items.
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export function PasteDropImport() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // dragenter/dragleave pair up for every element the drag crosses; the drag
    // has left the window when they balance. (Safari gives no relatedTarget.)
    let depth = 0;
    const onPaste = (event: ClipboardEvent) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
      void importFiles(filesOf(event.clipboardData), 'paste');
    };
    const onDragEnter = (event: DragEvent) => {
      if (!carriesContent(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    // Without this the browser opens a dropped image itself, replacing the app.
    const onDragOver = (event: DragEvent) => {
      if (!carriesContent(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: DragEvent) => {
      if (!carriesContent(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (!carriesContent(event)) return;
      event.preventDefault();
      void importFiles(filesOf(event.dataTransfer), 'drop');
    };
    const onDragEnd = () => {
      depth = 0;
      setDragging(false);
    };
    document.addEventListener('paste', onPaste);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', onDragEnd);
    return () => {
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', onDragEnd);
    };
  }, []);

  if (!dragging) return null;
  return (
    <div className="drop-target" data-testid="drop-target" aria-hidden="true">
      <div className="panel drop-target__label">Drop images to open them as new tabs</div>
    </div>
  );
}
