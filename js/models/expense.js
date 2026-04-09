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
 * @property {boolean} paid
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
    paid: Boolean(input.paid),
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
  }));
}
