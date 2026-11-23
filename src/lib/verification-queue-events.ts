/**
 * Tiny pub/sub so the sidebar's pending-count badge can refresh the moment a review
 * is actioned, not just on the next route change (see sidebar.tsx's count effect,
 * which otherwise only re-fetches on [role, pathname]).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function emitVerificationQueueChanged(): void {
  listeners.forEach((listener) => listener());
}

/** Returns an unsubscribe function. */
export function onVerificationQueueChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
