import { config } from "../config.js";
import { getSupabase } from "./supabaseClient.js";

/**
 * Debounced reload for multi-device sync (batches burst events).
 * @param {() => void | Promise<void>} onReload
 * @returns {() => void} unsubscribe
 */
export function subscribeExpensesAndDebts(onReload) {
  if (!config.realtime?.enabled) {
    return () => {};
  }

  let timer = 0;
  const run = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      Promise.resolve(onReload()).catch(() => {});
    }, 100);
  };

  const supabase = getSupabase();
  const channel = supabase
    .channel("family-expenses-debts")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "expenses" },
      run
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, run)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("[Realtime] Error de canal; revisa que las tablas estén en la publicación supabase_realtime.");
      }
    });

  return () => {
    clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
