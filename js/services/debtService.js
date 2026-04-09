import { normalizeDebts } from "../models/debt.js";
import { roundMoney } from "../utils/money.js";
import { toErrorMessage } from "../utils/supabaseErrors.js";
import { getSupabase } from "./supabaseClient.js";
import { mapDebtFromDb, normalizeDebtRow } from "./supabaseMappers.js";

function throwIfSupabaseError(error, fallback) {
  if (!error) return;
  console.error(error);
  throw new Error(toErrorMessage(error) || fallback);
}

function requireRow(data, notFoundMsg) {
  if (!data) throw new Error(notFoundMsg);
}

function firstRow(data) {
  if (Array.isArray(data) && data.length > 0) return data[0];
  return data ?? null;
}

/**
 * @param {{ name: unknown; totalAmount: unknown; monthlyPayment: unknown; remainingBalance?: unknown }} input
 */
function assertValidDebtInput(input) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("El nombre de la deuda es obligatorio.");

  const total = roundMoney(Number(input.totalAmount));
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("El importe total debe ser mayor que cero.");
  }
  const monthly = Math.max(0, roundMoney(Number(input.monthlyPayment)));
  if (Number.isNaN(monthly)) {
    throw new Error("La cuota mensual no es válida.");
  }
  const remainingRaw =
    input.remainingBalance !== undefined && input.remainingBalance !== null
      ? roundMoney(Number(input.remainingBalance))
      : total;
  if (Number.isNaN(remainingRaw)) {
    throw new Error("El saldo pendiente no es válido.");
  }
  const remaining = Math.max(0, Math.min(remainingRaw, total));
  return { name, total, monthly, remaining };
}

/** INSERT/UPDATE body: only name, total_amount, monthly_payment, remaining_balance */
function buildDebtWritePayload(/** @type {{ name: string; total: number; monthly: number; remaining: number }} */ v) {
  return {
    name: v.name,
    total_amount: Number(v.total),
    monthly_payment: Number(v.monthly),
    remaining_balance: Number(v.remaining),
  };
}

export async function listDebts() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("debts").select("*").order("name", { ascending: true });
  throwIfSupabaseError(error, "No se pudieron cargar las deudas");
  const rows = Array.isArray(data) ? data : [];
  return normalizeDebts(rows.map((r) => mapDebtFromDb(r)));
}

/**
 * @param {{ name: string; totalAmount: number; monthlyPayment: number; remainingBalance?: number }} input
 */
export async function createDebt(input) {
  const v = assertValidDebtInput(input);
  const payload = buildDebtWritePayload(v);
  console.log("Payload:", payload);

  const supabase = getSupabase();
  const { data, error } = await supabase.from("debts").insert([payload]).select();

  throwIfSupabaseError(error, "No se creó la deuda");
  console.log("Response:", data);

  const row = firstRow(data);
  requireRow(row, "No se creó la deuda");
  const d = normalizeDebtRow(row);
  if (!d) throw new Error("Respuesta inválida al crear deuda");
  return d;
}

/**
 * @param {string} id
 * @param {{ name: string; totalAmount: number; monthlyPayment: number; remainingBalance: number }} patch
 */
export async function updateDebt(id, patch) {
  const v = assertValidDebtInput(patch);
  const payload = buildDebtWritePayload(v);
  console.log("Payload (update):", payload);

  const supabase = getSupabase();
  const { data, error } = await supabase.from("debts").update(payload).eq("id", id).select();

  throwIfSupabaseError(error, "No se pudo actualizar la deuda");
  console.log("Response:", data);

  const row = firstRow(data);
  requireRow(row, "Deuda no encontrada");
  const d = normalizeDebtRow(row);
  if (!d) throw new Error("Respuesta inválida");
  return d;
}

/** @param {string} id */
export async function removeDebt(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("debts").delete().eq("id", id).select("id").maybeSingle();
  throwIfSupabaseError(error, "No se pudo eliminar");
  if (!data) throw new Error("Deuda no encontrada");
}

/**
 * @param {string} id
 */
export async function registerDebtPayment(id) {
  const supabase = getSupabase();
  const { data: row, error: fetchErr } = await supabase.from("debts").select("*").eq("id", id).single();
  throwIfSupabaseError(fetchErr, "Deuda no encontrada");
  requireRow(row, "Deuda no encontrada");
  const d = normalizeDebtRow(row);
  if (!d) throw new Error("Deuda no encontrada");
  if (d.remainingBalance <= 0) {
    return { debt: d, applied: 0 };
  }
  const monthly = Math.max(0, roundMoney(d.monthlyPayment));
  const rem = roundMoney(d.remainingBalance);
  const pay = Math.min(monthly, rem);
  const payload = {
    monthly_payment: Number(monthly),
    remaining_balance: Number(roundMoney(rem - pay)),
  };
  console.log("Payload (debt payment):", payload);

  const { data: updated, error: updErr } = await supabase.from("debts").update(payload).eq("id", id).select();

  throwIfSupabaseError(updErr, "No se pudo registrar el pago");
  console.log("Response:", updated);

  const nextRow = firstRow(updated);
  requireRow(nextRow, "Deuda no encontrada");
  const next = normalizeDebtRow(nextRow);
  if (!next) throw new Error("Respuesta inválida");
  return { debt: next, applied: pay };
}
