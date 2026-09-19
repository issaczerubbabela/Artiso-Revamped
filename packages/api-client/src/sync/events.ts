type Listener = (referenceId: string) => void;

const listeners = new Set<Listener>();

// Fired when sync changes a Reference's *local* copy (a collaborator's
// changes were merged in, or a viewer pulled a newer version). The open
// workspace holds its own in-memory copy and re-persists it wholesale on the
// next edit, so it has to adopt these changes or it would overwrite them.
export function subscribeReferenceUpdates(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitReferenceUpdated(referenceId: string): void {
  for (const listener of listeners) listener(referenceId);
}
