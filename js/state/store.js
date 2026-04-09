/**
 * Lightweight pub/sub store. Swap notifications for Supabase channels when ready.
 * @template T
 * @param {T} initial
 */
export function createStore(initial) {
  /** @type {T} */
  let state = structuredClone(initial);
  const listeners = new Set();

  return {
    getState: () => state,

    /**
     * @param {(s: T) => T | void} updater
     */
    setState(updater) {
      const next = updater(state);
      if (next !== undefined) state = next;
      listeners.forEach((fn) => fn(state));
    },

    /** @param {(s: T) => void} fn */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
