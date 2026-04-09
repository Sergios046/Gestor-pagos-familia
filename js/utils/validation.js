import { normalizeDueDateToYYYYMMDD } from "./dates.js";
import { roundMoney } from "./money.js";

/**
 * @param {FormData} fd
 * @returns {{ ok: true, name: string, amount: number, dueDate: string, category: string | null, recurringMonthly: boolean, paymentConvenio: string | null, paymentServiceAccount: string | null, paymentNotes: string | null } | { ok: false, message: string }}
 */
export function validateExpenseFormData(fd) {
  const name = String(fd.get("name") ?? "").trim();
  const dueDate = String(fd.get("dueDate") ?? "").trim();
  const amountStr = String(fd.get("amount") ?? "").trim();
  const categoryRaw = String(fd.get("category") ?? "").trim();
  const paymentConvenioRaw = String(fd.get("paymentConvenio") ?? "").trim();
  const paymentServiceAccountRaw = String(fd.get("paymentServiceAccount") ?? "").trim();
  const paymentNotesRaw = String(fd.get("paymentNotes") ?? "").trim();
  const recurringMonthly = fd.get("recurringMonthly") === "on";

  if (!name) {
    return { ok: false, message: "Escribe un nombre para el gasto." };
  }
  if (!dueDate) {
    return { ok: false, message: "Elige la fecha de vencimiento." };
  }
  const dueNormalized = normalizeDueDateToYYYYMMDD(dueDate);
  if (!dueNormalized) {
    return { ok: false, message: "La fecha de vencimiento no es válida (usa AAAA-MM-DD)." };
  }
  if (amountStr === "") {
    return { ok: false, message: "Indica el importe del gasto." };
  }
  const rawAmount = Number(amountStr);
  if (Number.isNaN(rawAmount)) {
    return { ok: false, message: "El importe no es un número válido." };
  }
  if (rawAmount < 0) {
    return { ok: false, message: "El importe no puede ser negativo." };
  }
  const amount = roundMoney(rawAmount);
  return {
    ok: true,
    name,
    amount,
    dueDate: dueNormalized,
    category: categoryRaw ? categoryRaw : null,
    recurringMonthly,
    paymentConvenio: paymentConvenioRaw ? paymentConvenioRaw : null,
    paymentServiceAccount: paymentServiceAccountRaw ? paymentServiceAccountRaw : null,
    paymentNotes: paymentNotesRaw ? paymentNotesRaw : null,
  };
}

/**
 * @param {string} label
 * @param {FormData} fd
 * @param {string} key
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
function parseOptionalDigitsField(label, fd, key) {
  const raw = String(fd.get(key) ?? "")
    .replace(/\s/g, "")
    .trim();
  if (!raw) return { ok: true, value: null };
  if (!/^\d+$/.test(raw)) {
    return { ok: false, message: `${label}: solo números (sin letras ni símbolos).` };
  }
  return { ok: true, value: raw };
}

/**
 * @param {FormData} fd
 * @returns {{ ok: true, name: string, dueDate: string, totalAmount: number, monthlyPayment: number, remainingBalance: number, referenceNumber: string | null, convenio: string | null, infonavitCredit: string | null } | { ok: false, message: string }}
 */
export function validateDebtFormData(fd) {
  const name = String(fd.get("name") ?? "").trim();
  const dueDateRaw = String(fd.get("dueDate") ?? "").trim();
  const totalStr = String(fd.get("totalAmount") ?? "").trim();
  const monthlyStr = String(fd.get("monthlyPayment") ?? "").trim();
  const remainingStr = String(fd.get("remainingBalance") ?? "").trim();

  if (!name) {
    return { ok: false, message: "Escribe un nombre para la deuda." };
  }
  if (!dueDateRaw) {
    return { ok: false, message: "Elige la fecha de la próxima cuota." };
  }
  const dueDate = normalizeDueDateToYYYYMMDD(dueDateRaw);
  if (!dueDate) {
    return { ok: false, message: "La fecha de la cuota no es válida (AAAA-MM-DD)." };
  }
  if (totalStr === "") {
    return { ok: false, message: "Indica el importe total." };
  }
  if (monthlyStr === "") {
    return { ok: false, message: "Indica la cuota mensual." };
  }
  if (remainingStr === "") {
    return { ok: false, message: "Indica el saldo pendiente." };
  }

  const rawTotal = Number(totalStr);
  const rawMonthly = Number(monthlyStr);
  const rawRemaining = Number(remainingStr);

  if (Number.isNaN(rawTotal) || Number.isNaN(rawMonthly) || Number.isNaN(rawRemaining)) {
    return { ok: false, message: "Revisa que todos los importes sean números válidos." };
  }
  if (rawTotal < 0 || rawMonthly < 0 || rawRemaining < 0) {
    return { ok: false, message: "Los importes no pueden ser negativos." };
  }

  const totalAmount = roundMoney(rawTotal);
  const monthlyPayment = roundMoney(rawMonthly);
  const remainingBalance = roundMoney(rawRemaining);

  if (totalAmount <= 0) {
    return { ok: false, message: "El importe total debe ser mayor que cero." };
  }
  if (remainingBalance > totalAmount) {
    return {
      ok: false,
      message: "El saldo pendiente no puede superar el total (evita sobrepagar o datos incoherentes).",
    };
  }

  const ref = parseOptionalDigitsField("Nº de referencia", fd, "referenceNumber");
  if (!ref.ok) return ref;
  const conv = parseOptionalDigitsField("Convenio", fd, "convenio");
  if (!conv.ok) return conv;
  const inf = parseOptionalDigitsField("Crédito Infonavit", fd, "infonavitCredit");
  if (!inf.ok) return inf;

  return {
    ok: true,
    name,
    dueDate,
    totalAmount,
    monthlyPayment,
    remainingBalance,
    referenceNumber: ref.value,
    convenio: conv.value,
    infonavitCredit: inf.value,
  };
}
