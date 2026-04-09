import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _client = null;

/**
 * Singleton browser client — reuse everywhere via `getSupabase()` or `supabase`.
 */
export function getSupabase() {
  const url = config.supabase?.url?.trim();
  const key = config.supabase?.publishableKey?.trim() || config.supabase?.anonKey?.trim();
  if (!url || !key) {
    throw new Error("Configura config.supabase.url y config.supabase.publishableKey");
  }
  if (!_client) {
    _client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
  }
  return _client;
}

/** Call after sign-out so the next login builds a fresh client / listener state. */
export function resetSupabaseClient() {
  _client = null;
}

/**
 * Same instance as `getSupabase()` — convenient for `supabase.from(...)`.
 * Initialized on first property access.
 */
export const supabase = new Proxy(
  /** @type {import('@supabase/supabase-js').SupabaseClient} */ (/** @type {unknown} */ ({})),
  {
    get(_t, prop, receiver) {
      const client = getSupabase();
      const v = Reflect.get(client, prop, client);
      return typeof v === "function" ? v.bind(client) : v;
    },
  }
);
