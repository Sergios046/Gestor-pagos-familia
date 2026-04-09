import { STORAGE_KEYS } from "./storageKeys.js";

/**
 * Pluggable persistence — replace with supabaseAdapter implementing the same interface.
 */
export const localStorageAdapter = {
  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {Promise<T>}
   */
  async get(key, fallback) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  },
};

/** Run once: version bump for future migrations */
export async function ensureStorageVersion() {
  const meta = await localStorageAdapter.get(STORAGE_KEYS.META, { version: 1 });
  if (!meta.version) {
    await localStorageAdapter.set(STORAGE_KEYS.META, { version: 1 });
  }
}
