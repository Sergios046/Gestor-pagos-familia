import { formatMoney } from "../utils/money.js";
import { parseLocalDate, daysUntil, isDueMonthOnOrBeforeCurrent, yearMonthLocal } from "../utils/dates.js";

/**
 * Recurrentes quedan `paid: false` en BD al avanzar fecha; en «Pagados» usamos el historial del mes.
 * @param {import('../models/expense.js').Expense} e
 * @param {import('../services/paymentHistoryService.js').PaymentHistoryRow[]} paymentHistory
 */
function hasRecurringPaymentThisMonth(e, paymentHistory) {
  if (!e.recurringMonthly) return false;
  const ym = yearMonthLocal(new Date());
  return paymentHistory.some(
    (ev) => ev.kind === "expense" && ev.refId === e.id && yearMonthLocal(ev.paidAt) === ym
  );
}

/** @param {import('../models/expense.js').Expense} e */
function latestExpensePaymentThisMonth(e, paymentHistory) {
  const ym = yearMonthLocal(new Date());
  let latest = "";
  for (const ev of paymentHistory) {
    if (ev.kind !== "expense" || ev.refId !== e.id) continue;
    if (yearMonthLocal(ev.paidAt) !== ym) continue;
    if (!latest || ev.paidAt > latest) latest = ev.paidAt;
  }
  return latest || null;
}

function paidSortKey(e, paymentHistory) {
  if (e.paid && e.paidAt) return new Date(e.paidAt).getTime();
  const t = latestExpensePaymentThisMonth(e, paymentHistory);
  return t ? new Date(t).getTime() : 0;
}

/** @param {import('../models/expense.js').Expense} e */
function formatExpensePaymentExtras(e) {
  const parts = [];
  if (e.paymentConvenio) parts.push(`Convenio: ${escapeHtml(e.paymentConvenio)}`);
  if (e.paymentServiceAccount) parts.push(`Cuenta servicio: ${escapeHtml(e.paymentServiceAccount)}`);
  const line = parts.length ? `<p class="expense-card__details">${parts.join(" · ")}</p>` : "";
  const notes = e.paymentNotes ? `<p class="expense-card__notes">${escapeHtml(e.paymentNotes)}</p>` : "";
  return line + notes;
}

/**
 * @param {HTMLElement} root
 * @param {import('../models/expense.js').Expense[]} expenses
 * @param {'pending' | 'paid' | 'all'} filter
 * @param {object} handlers
 * @param {import('../services/paymentHistoryService.js').PaymentHistoryRow[]} [paymentHistory]
 */
export function renderExpenseList(root, expenses, filter, handlers, paymentHistory = []) {
  const filtered =
    filter === "all"
      ? expenses
      : filter === "paid"
        ? expenses.filter((e) => e.paid || hasRecurringPaymentThisMonth(e, paymentHistory))
        : expenses.filter((e) => !e.paid);

  const sorted = [...filtered].sort((a, b) => {
    if (filter === "paid") {
      return paidSortKey(b, paymentHistory) - paidSortKey(a, paymentHistory);
    }
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    if (!a.paid && !b.paid) {
      return parseLocalDate(a.dueDate) - parseLocalDate(b.dueDate);
    }
    const pa = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const pb = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return pb - pa;
  });

  if (sorted.length === 0) {
    root.innerHTML =
      '<div class="empty-state"><p>No hay gastos en esta vista.</p><p style="margin-top:1rem;font-size:0.9rem;">Pulsa «Añadir gasto» para crear uno.</p></div>';
    return;
  }

  root.innerHTML = sorted
    .map((e) => {
      const recurringPaid = hasRecurringPaymentThisMonth(e, paymentHistory);
      const showPaidStyle = e.paid || recurringPaid;
      const cat = e.category
        ? `<span class="expense-card__badge">${escapeHtml(e.category)}</span>`
        : "";
      const recur = e.recurringMonthly
        ? `<span class="expense-card__badge expense-card__badge--recurring">Cada mes</span>`
        : "";
      const dueLabel = formatDueLabel(e, recurringPaid);
      const histPaidAt = recurringPaid ? latestExpensePaymentThisMonth(e, paymentHistory) : null;
      const paidMeta =
        e.paid && e.paidAt
          ? `<p class="expense-card__meta">Pagado el ${formatPaidDate(e.paidAt)}</p>`
          : recurringPaid && histPaidAt
            ? `<p class="expense-card__meta">Cuota registrada el ${formatPaidDate(histPaidAt)}</p>`
            : "";

      const canMarkPaid = isDueMonthOnOrBeforeCurrent(e.dueDate);
      const payBlockedTitle = !canMarkPaid
        ? "El vencimiento está en un mes futuro; no puedes marcar pagado hasta entonces (o cambia la fecha en Editar)."
        : "";
      let actions;
      if (e.paid) {
        actions = `
        <button type="button" class="btn btn--ghost btn--small" data-action="unpaid" data-id="${e.id}">Marcar pendiente</button>
        <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${e.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
      `;
      } else if (recurringPaid) {
        actions = `
        <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${e.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
      `;
      } else {
        actions = `
        <button type="button" class="btn btn--success btn--small" data-action="paid" data-id="${e.id}" ${canMarkPaid ? "" : "disabled"} title="${escapeAttr(payBlockedTitle)}">Marcar pagado</button>
        <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${e.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
      `;
      }

      return `
      <article class="expense-card${showPaidStyle ? " expense-card--paid" : ""}" data-id="${e.id}">
        <div class="expense-card__head">
          <div>
            <h3 class="expense-card__title">${escapeHtml(e.name)}</h3>
            ${cat}${recur}
          </div>
          <span class="expense-card__amount">${formatMoney(e.amount)}</span>
        </div>
        ${formatExpensePaymentExtras(e)}
        <p class="expense-card__meta">Vence: ${formatDueDate(e.dueDate)} · ${dueLabel}</p>
        ${paidMeta}
        <div class="expense-card__actions">${actions}</div>
      </article>`;
    })
    .join("");

  root.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action || btn.disabled) return;
      if (action === "paid") handlers.onPaid(id);
      if (action === "unpaid") handlers.onUnpaid(id);
      if (action === "edit") handlers.onEdit(id);
      if (action === "delete") handlers.onDelete(id);
    });
  });
}

function formatDueDate(iso) {
  try {
    return parseLocalDate(iso).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatPaidDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/** @param {import('../models/expense.js').Expense} e */
function formatDueLabel(e, recurringPaidThisMonth = false) {
  if (e.paid) return "Pagado";
  if (recurringPaidThisMonth) return "Pagado este mes (siguiente vencimiento arriba)";
  const d = daysUntil(e.dueDate);
  if (d < 0) return `Retrasado ${Math.abs(d)} d.`;
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  return `Faltan ${d} d.`;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
