import { createId } from "../utils/id.js";
import { nowISO } from "../utils/dates.js";
import { roundMoney } from "../utils/money.js";

/**
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} name
 * @property {number} amount
 * @property {string} dueDate ISO date YYYY-MM-DD
 * @property {string|null} category
 * @property {string|null} [paymentConvenio]
 * @property {string|null} [paymentServiceAccount]
 * @property {string|null} [paymentNotes]
 * @property {boolean} paid
 * @property {boolean} recurringMonthly
 * @property {string|null} paidAt ISO datetime
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} [syncVersion] reserved for backend
 */

/**
 * @param {Partial<Expense> & { name: string; amount: number; dueDate: string }} input
 * @returns {Expense}
 */
export function buildExpense(input) {
  const t = nowISO();
  return {
    id: input.id ?? createId(),
    name: String(input.name).trim(),
    amount: Math.max(0, roundMoney(input.amount)),
    dueDate: input.dueDate,
    category: input.category ? String(input.category).trim() : null,
    paymentConvenio:
      input.paymentConvenio != null && String(input.paymentConvenio).trim() !== ""
        ? String(input.paymentConvenio).trim()
        : null,
    paymentServiceAccount:
      input.paymentServiceAccount != null && String(input.paymentServiceAccount).trim() !== ""
        ? String(input.paymentServiceAccount).trim()
        : null,
    paymentNotes:
      input.paymentNotes != null && String(input.paymentNotes).trim() !== ""
        ? String(input.paymentNotes).trim()
        : null,
    paid: Boolean(input.paid),
    recurringMonthly: Boolean(input.recurringMonthly),
    paidAt: input.paidAt ?? null,
    createdAt: input.createdAt ?? t,
    updatedAt: t,
  };
}

/**
 * @param {unknown} row
 * @returns {row is Expense}
 */
export function isExpense(row) {
  return (
    row != null &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    typeof row.name === "string" &&
    typeof row.amount === "number" &&
    typeof row.dueDate === "string"
  );
}

/**
 * Normalize list from storage
 * @param {unknown[]} raw
 * @returns {Expense[]}
 */
export function normalizeExpenses(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isExpense).map((e) => ({
    ...e,
    amount: Math.max(0, roundMoney(e.amount)),
    recurringMonthly: Boolean(e.recurringMonthly),
    paymentConvenio: e.paymentConvenio ?? null,
    paymentServiceAccount: e.paymentServiceAccount ?? null,
    paymentNotes: e.paymentNotes ?? null,
  }));
}
