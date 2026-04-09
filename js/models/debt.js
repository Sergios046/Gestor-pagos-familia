import { createId } from "../utils/id.js";
import { nowISO, todayISO } from "../utils/dates.js";
import { roundMoney } from "../utils/money.js";

/**
 * @typedef {Object} Debt
 * @property {string} id
 * @property {string} name
 * @property {number} totalAmount
 * @property {number} monthlyPayment
 * @property {number} remainingBalance
 * @property {string | null} [referenceNumber]
 * @property {string | null} [convenio]
 * @property {string | null} [infonavitCredit]
 * @property {string} dueDate 'YYYY-MM-DD' próxima cuota
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @param {Partial<Debt> & { name: string; totalAmount: number; monthlyPayment: number; remainingBalance?: number; dueDate?: string }} input
 * @returns {Debt}
 */
export function buildDebt(input) {
  const t = nowISO();
  const total = roundMoney(input.totalAmount);
  const remainingRaw =
    input.remainingBalance !== undefined && input.remainingBalance !== null
      ? roundMoney(input.remainingBalance)
      : total;
  const remaining = Math.max(0, Math.min(remainingRaw, total));
  const dueRaw = input.dueDate != null && String(input.dueDate).trim() !== "" ? String(input.dueDate).trim() : todayISO();
  return {
    id: input.id ?? createId(),
    name: String(input.name).trim(),
    totalAmount: total,
    monthlyPayment: Math.max(0, roundMoney(input.monthlyPayment)),
    remainingBalance: remaining,
    dueDate: dueRaw.slice(0, 10),
    referenceNumber: input.referenceNumber ?? null,
    convenio: input.convenio ?? null,
    infonavitCredit: input.infonavitCredit ?? null,
    createdAt: input.createdAt ?? t,
    updatedAt: t,
  };
}

/**
 * Share of original debt cleared: (total - remaining) / total
 * @param {Debt} d
 * @returns {number} 0–100
 */
export function debtProgressPercent(d) {
  const total = roundMoney(d.totalAmount);
  if (!total || total <= 0) return 0;
  const paid = roundMoney(total - roundMoney(d.remainingBalance));
  const pct = (paid / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Capital amortizado (no puede superar el total ni ser negativo).
 * @param {Debt} d
 * @returns {number}
 */
export function debtAmountPaid(d) {
  const total = roundMoney(d.totalAmount);
  const rem = roundMoney(d.remainingBalance);
  const paid = roundMoney(total - rem);
  return Math.max(0, Math.min(total, paid));
}

/**
 * @param {unknown} row
 * @returns {row is Debt}
 */
export function isDebt(row) {
  return (
    row != null &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.totalAmount === "number" &&
    typeof row.monthlyPayment === "number" &&
    typeof row.remainingBalance === "number" &&
    typeof row.dueDate === "string"
  );
}

/**
 * @param {unknown[]} raw
 * @returns {Debt[]}
 */
export function normalizeDebts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isDebt).map((d) => {
    const total = roundMoney(d.totalAmount);
    const monthly = Math.max(0, roundMoney(d.monthlyPayment));
    const rem = Math.max(0, Math.min(roundMoney(d.remainingBalance), total));
    return {
      ...d,
      totalAmount: total,
      monthlyPayment: monthly,
      remainingBalance: rem,
      dueDate: d.dueDate,
      referenceNumber: d.referenceNumber ?? null,
      convenio: d.convenio ?? null,
      infonavitCredit: d.infonavitCredit ?? null,
    };
  });
}
