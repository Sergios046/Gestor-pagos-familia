import { formatMoney } from "../utils/money.js";
import { parseLocalDate, daysUntil } from "../utils/dates.js";

/**
 * @param {HTMLElement} root
 * @param {import('../models/expense.js').Expense[]} expenses
 * @param {'pending' | 'paid' | 'all'} filter
 * @param {object} handlers
 */
export function renderExpenseList(root, expenses, filter, handlers) {
  const filtered =
    filter === "all"
      ? expenses
      : filter === "paid"
        ? expenses.filter((e) => e.paid)
        : expenses.filter((e) => !e.paid);

  const sorted = [...filtered].sort((a, b) => {
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
      const cat = e.category
        ? `<span class="expense-card__badge">${escapeHtml(e.category)}</span>`
        : "";
      const dueLabel = formatDueLabel(e);
      const paidMeta = e.paid && e.paidAt
        ? `<p class="expense-card__meta">Pagado el ${formatPaidDate(e.paidAt)}</p>`
        : "";

      const actions = e.paid
        ? `
        <button type="button" class="btn btn--ghost btn--small" data-action="unpaid" data-id="${e.id}">Marcar pendiente</button>
        <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${e.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
      `
        : `
        <button type="button" class="btn btn--success btn--small" data-action="paid" data-id="${e.id}">Marcar pagado</button>
        <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${e.id}">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${e.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
      `;

      return `
      <article class="expense-card${e.paid ? " expense-card--paid" : ""}" data-id="${e.id}">
        <div class="expense-card__head">
          <div>
            <h3 class="expense-card__title">${escapeHtml(e.name)}</h3>
            ${cat}
          </div>
          <span class="expense-card__amount">${formatMoney(e.amount)}</span>
        </div>
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
      if (!id || !action) return;
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
function formatDueLabel(e) {
  if (e.paid) return "Pagado";
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
