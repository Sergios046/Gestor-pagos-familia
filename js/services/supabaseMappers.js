import { normalizeDebts } from "../models/debt.js";
import { normalizeExpenses } from "../models/expense.js";

/**
 * @param {Record<string, unknown>} row
 * @returns {import('../models/expense.js').Expense}
 */
export function mapExpenseFromDb(row) {
  const dr = row.due_date;
  let due = "";
  if (dr instanceof Date && !Number.isNaN(dr.getTime())) {
    const y = dr.getFullYear();
    const m = String(dr.getMonth() + 1).padStart(2, "0");
    const d = String(dr.getDate()).padStart(2, "0");
    due = `${y}-${m}-${d}`;
  } else if (dr != null && dr !== "") {
    due = String(dr).slice(0, 10);
  }
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    amount: Number(row.amount),
    dueDate: due,
    category: row.category == null || row.category === "" ? null : String(row.category),
    paid: Boolean(row.paid),
    recurringMonthly: Boolean(row.recurring_monthly),
    paidAt: row.paid_at == null ? null : String(row.paid_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {import('../models/debt.js').Debt}
 */
export function mapDebtFromDb(row) {
  const ref = row.reference_number;
  const conv = row.convenio;
  const inf = row.infonavit_credit;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    totalAmount: Number(row.total_amount),
    monthlyPayment: Number(row.monthly_payment),
    remainingBalance: Number(row.remaining_balance),
    referenceNumber: ref == null || ref === "" ? null : String(ref),
    convenio: conv == null || conv === "" ? null : String(conv),
    infonavitCredit: inf == null || inf === "" ? null : String(inf),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * @param {Record<string, unknown>|null} row
 */
export function normalizeExpenseRow(row) {
  if (!row) return null;
  const [e] = normalizeExpenses([mapExpenseFromDb(row)]);
  return e ?? null;
}

/**
 * @param {Record<string, unknown>|null} row
 */
export function normalizeDebtRow(row) {
  if (!row) return null;
  const [d] = normalizeDebts([mapDebtFromDb(row)]);
  return d ?? null;
}
