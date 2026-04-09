import { toErrorMessage } from "../utils/supabaseErrors.js";
import { getSupabase } from "./supabaseClient.js";

function throwIfSupabaseError(error, fallback) {
  if (!error) return;
  console.error(error);
  throw new Error(toErrorMessage(error) || fallback);
}

/**
 * @typedef {{ id: string; kind: 'expense' | 'debt'; refId: string; title: string; amount: number; paidAt: string }} PaymentHistoryRow
 */

/**
 * @returns {Promise<PaymentHistoryRow[]>}
 */
export async function listPaymentHistory() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payment_events")
    .select("id, kind, ref_id, title, amount, paid_at")
    .order("paid_at", { ascending: false })
    .limit(400);

  throwIfSupabaseError(error, "No se pudo cargar el historial");
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind === "debt" ? "debt" : "expense",
    refId: String(row.ref_id),
    title: String(row.title ?? ""),
    amount: Number(row.amount),
    paidAt: String(row.paid_at ?? ""),
  }));
}
