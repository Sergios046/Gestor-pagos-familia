import { normalizeExpenses } from "../models/expense.js";
import { normalizeDueDateToYYYYMMDD, nowISO, addMonthsPreserveDay, yearMonthLocal } from "../utils/dates.js";
import { roundMoney } from "../utils/money.js";
import { toErrorMessage } from "../utils/supabaseErrors.js";
import { getSupabase } from "./supabaseClient.js";
import { mapExpenseFromDb, normalizeExpenseRow } from "./supabaseMappers.js";

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
 * @param {{ name: unknown; amount: unknown; dueDate: unknown; category?: string | null }} input
 * @returns {{ name: string; amount: number; dueDate: string; category: string | null }}
 */
function assertValidExpensePayload(input) {
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new Error("El nombre del gasto es obligatorio.");
  }

  const dueRaw = input.dueDate;
  if (dueRaw == null || String(dueRaw).trim() === "") {
    throw new Error("La fecha de vencimiento es obligatoria.");
  }
  const dueDate = normalizeDueDateToYYYYMMDD(dueRaw);
  if (!dueDate) {
    throw new Error("La fecha de vencimiento no es válida. Debe ser AAAA-MM-DD.");
  }

  const amtIn = input.amount;
  if (amtIn === undefined || amtIn === null || (typeof amtIn === "string" && String(amtIn).trim() === "")) {
    throw new Error("El importe es obligatorio.");
  }
  const amt = Number(amtIn);
  if (Number.isNaN(amt)) {
    throw new Error("El importe no es un número válido.");
  }
  if (amt < 0) {
    throw new Error("El importe no puede ser negativo.");
  }
  const amount = Math.max(0, roundMoney(amt));

  const category =
    input.category == null || input.category === "" ? null : String(input.category).trim();

  const recurringMonthly = Boolean(input.recurringMonthly);

  return { name, amount, dueDate, category, recurringMonthly };
}

/**
 * INSERT — only columns that exist on your table:
 * name, amount, due_date, paid, (+ category if set).
 * Omits paid_at (DB NULL), debt_id, created_at, updated_at, id.
 */
function buildExpenseInsertPayload(
  /** @type {{ name: string; amount: number; dueDate: string; category: string | null; recurringMonthly: boolean }} */ v
) {
  /** @type {Record<string, unknown>} */
  const payload = {
    name: v.name,
    amount: Number(v.amount),
    due_date: v.dueDate,
    paid: false,
    recurring_monthly: v.recurringMonthly,
  };
  if (v.category != null && v.category !== "") {
    payload.category = v.category;
  }
  return payload;
}

/**
 * UPDATE — name, amount, due_date, category (null clears).
 */
function buildExpenseUpdatePayload(
  /** @type {{ name: string; amount: number; dueDate: string; category: string | null; recurringMonthly: boolean }} */ v
) {
  return {
    name: v.name,
    amount: Number(v.amount),
    due_date: v.dueDate,
    category: v.category != null && v.category !== "" ? v.category : null,
    recurring_monthly: v.recurringMonthly,
  };
}

export async function listExpenses() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("due_date", { ascending: true });
  throwIfSupabaseError(error, "No se pudieron cargar los gastos");
  const rows = Array.isArray(data) ? data : [];
  return normalizeExpenses(rows.map((r) => mapExpenseFromDb(r)));
}

/**
 * @param {{ name: string; amount: number; dueDate: string; category?: string | null; recurringMonthly?: boolean }} input
 */
export async function createExpense(input) {
  const v = assertValidExpensePayload(input);
  const payload = buildExpenseInsertPayload(v);
  console.log("Payload:", payload);

  const supabase = getSupabase();
  const { data, error } = await supabase.from("expenses").insert([payload]).select();

  throwIfSupabaseError(error, "No se creó el gasto");
  console.log("Response:", data);

  const row = firstRow(data);
  requireRow(row, "No se creó el gasto");
  const e = normalizeExpenseRow(row);
  if (!e) throw new Error("Respuesta inválida al crear gasto");
  return e;
}

/**
 * @param {string} id
 * @param {{ name: string; amount: number; dueDate: string; category?: string | null; recurringMonthly?: boolean }} patch
 */
export async function updateExpense(id, patch) {
  const v = assertValidExpensePayload(patch);
  const payload = buildExpenseUpdatePayload(v);
  console.log("Payload (update):", payload);

  const supabase = getSupabase();
  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select();

  throwIfSupabaseError(error, "No se pudo actualizar el gasto");
  console.log("Response:", data);

  const row = firstRow(data);
  requireRow(row, "Gasto no encontrado");
  const e = normalizeExpenseRow(row);
  if (!e) throw new Error("Respuesta inválida");
  return e;
}

/** @param {string} id */
export async function removeExpense(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("id").maybeSingle();
  throwIfSupabaseError(error, "No se pudo eliminar");
  if (!data) throw new Error("Gasto no encontrado");
}

/**
 * Registra el pago en `payment_events`. Si el gasto es recurrente mensual, deja pendiente y mueve `due_date` un mes.
 * @param {string} id
 * @returns {Promise<{ expense: import('../models/expense.js').Expense; advancedRecurring: boolean; nextDue?: string }>}
 */
export async function markExpensePaid(id) {
  const supabase = getSupabase();
  const { data: row, error: fetchErr } = await supabase.from("expenses").select("*").eq("id", id).single();
  throwIfSupabaseError(fetchErr, "Gasto no encontrado");
  requireRow(row, "Gasto no encontrado");
  const current = normalizeExpenseRow(row);
  if (!current) throw new Error("Gasto no encontrado");

  if (current.recurringMonthly) {
    const thisMonth = yearMonthLocal(new Date());
    const { data: lastEv, error: lastErr } = await supabase
      .from("payment_events")
      .select("paid_at")
      .eq("kind", "expense")
      .eq("ref_id", current.id)
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfSupabaseError(lastErr, "No se pudo comprobar el historial de pagos");
    if (lastEv?.paid_at && yearMonthLocal(lastEv.paid_at) === thisMonth) {
      throw new Error(
        "Ya registraste el pago de este gasto recurrente en este mes calendario. Vuelve a intentarlo cuando cambie el mes, o ajusta la fecha en Editar si hubo un error."
      );
    }
  }

  const t = nowISO();
  const { error: evErr } = await supabase.from("payment_events").insert([
    {
      kind: "expense",
      ref_id: current.id,
      title: current.name,
      amount: Number(current.amount),
      paid_at: t,
    },
  ]);
  throwIfSupabaseError(evErr, "No se pudo registrar el pago en el historial");

  let payload;
  let advancedRecurring = false;
  let nextDue;
  if (current.recurringMonthly) {
    nextDue = addMonthsPreserveDay(current.dueDate, 1);
    advancedRecurring = true;
    payload = { paid: false, paid_at: null, due_date: nextDue };
  } else {
    payload = { paid: true, paid_at: t };
  }

  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select();
  throwIfSupabaseError(error, "No se pudo actualizar");
  const updated = firstRow(data);
  requireRow(updated, "Gasto no encontrado");
  const e = normalizeExpenseRow(updated);
  if (!e) throw new Error("Respuesta inválida");
  return { expense: e, advancedRecurring, nextDue };
}

/** @param {string} id */
export async function markExpenseUnpaid(id) {
  const supabase = getSupabase();
  const payload = { paid: false, paid_at: null };
  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select();

  throwIfSupabaseError(error, "No se pudo actualizar");
  const row = firstRow(data);
  requireRow(row, "Gasto no encontrado");
  const e = normalizeExpenseRow(row);
  if (!e) throw new Error("Respuesta inválida");
  return e;
}
