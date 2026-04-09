import { normalizeDebts } from "../models/debt.js";
import { roundMoney } from "../utils/money.js";
import { nowISO, normalizeDueDateToYYYYMMDD, addMonthsPreserveDay, isDueMonthOnOrBeforeCurrent } from "../utils/dates.js";
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
 * @param {string} label
 * @param {unknown} raw
 * @returns {string | null}
 */
function optionalDigitsOnly(label, raw) {
  const t = String(raw ?? "")
    .replace(/\s/g, "")
    .trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) {
    throw new Error(`${label}: solo números (sin letras ni símbolos).`);
  }
  return t;
}

/**
 * @param {{ name: unknown; totalAmount: unknown; monthlyPayment: unknown; remainingBalance?: unknown; dueDate?: unknown; referenceNumber?: unknown; convenio?: unknown; infonavitCredit?: unknown }} input
 */
function assertValidDebtInput(input) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("El nombre de la deuda es obligatorio.");

  const dueRaw = input.dueDate;
  if (dueRaw == null || String(dueRaw).trim() === "") {
    throw new Error("La fecha de la próxima cuota es obligatoria.");
  }
  const dueDate = normalizeDueDateToYYYYMMDD(dueRaw);
  if (!dueDate) {
    throw new Error("La fecha de la cuota no es válida (AAAA-MM-DD).");
  }

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
  const referenceNumber = optionalDigitsOnly("Nº de referencia", input.referenceNumber);
  const convenio = optionalDigitsOnly("Convenio", input.convenio);
  const infonavitCredit = optionalDigitsOnly("Crédito Infonavit", input.infonavitCredit);
  return { name, total, monthly, remaining, dueDate, referenceNumber, convenio, infonavitCredit };
}

/** INSERT/UPDATE body */
function buildDebtWritePayload(
  /** @type {{ name: string; total: number; monthly: number; remaining: number; dueDate: string; referenceNumber: string | null; convenio: string | null; infonavitCredit: string | null }} */ v
) {
  return {
    name: v.name,
    total_amount: Number(v.total),
    monthly_payment: Number(v.monthly),
    remaining_balance: Number(v.remaining),
    due_date: v.dueDate,
    reference_number: v.referenceNumber,
    convenio: v.convenio,
    infonavit_credit: v.infonavitCredit,
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
 * @param {{ name: string; totalAmount: number; monthlyPayment: number; remainingBalance?: number; referenceNumber?: string | null; convenio?: string | null; infonavitCredit?: string | null }} input
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
 * @param {{ name: string; totalAmount: number; monthlyPayment: number; remainingBalance: number; dueDate: string; referenceNumber?: string | null; convenio?: string | null; infonavitCredit?: string | null }} patch
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
  if (!isDueMonthOnOrBeforeCurrent(d.dueDate)) {
    throw new Error(
      "Aún no puedes registrar esta cuota: el mes de vencimiento es futuro. Vuelve cuando llegue ese mes o ajusta la fecha en Editar."
    );
  }
  const monthly = Math.max(0, roundMoney(d.monthlyPayment));
  const rem = roundMoney(d.remainingBalance);
  const pay = Math.min(monthly, rem);
  const nextDue = pay > 0 ? addMonthsPreserveDay(d.dueDate, 1) : d.dueDate;
  const payload = {
    monthly_payment: Number(monthly),
    remaining_balance: Number(roundMoney(rem - pay)),
    due_date: nextDue,
  };
  console.log("Payload (debt payment):", payload);

  const { data: updated, error: updErr } = await supabase.from("debts").update(payload).eq("id", id).select();

  throwIfSupabaseError(updErr, "No se pudo registrar el pago");
  console.log("Response:", updated);

  const nextRow = firstRow(updated);
  requireRow(nextRow, "Deuda no encontrada");
  const next = normalizeDebtRow(nextRow);
  if (!next) throw new Error("Respuesta inválida");

  if (pay > 0) {
    const t = nowISO();
    const { error: evErr } = await supabase.from("payment_events").insert([
      {
        kind: "debt",
        ref_id: id,
        title: next.name,
        amount: Number(pay),
        paid_at: t,
      },
    ]);
    throwIfSupabaseError(evErr, "Pago aplicado pero no se guardó en el historial");
  }

  return { debt: next, applied: pay };
}
