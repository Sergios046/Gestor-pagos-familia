import { formatMoney, roundMoney } from "../utils/money.js";
import { debtProgressPercent, debtAmountPaid } from "../models/debt.js";

/**
 * @param {HTMLElement} root
 * @param {import('../models/debt.js').Debt[]} debts
 * @param {object} handlers
 */
export function renderDebtList(root, debts, handlers) {
  const sorted = [...debts].sort((a, b) => a.name.localeCompare(b.name, "es-MX"));

  if (sorted.length === 0) {
    root.innerHTML =
      '<div class="empty-state"><p>No hay deudas registradas.</p><p style="margin-top:1rem;font-size:0.9rem;">Pulsa «Añadir deuda» para crear una.</p></div>';
    return;
  }

  root.innerHTML = sorted
    .map((d) => {
      const pct = debtProgressPercent(d);
      const paid = debtAmountPaid(d);
      const total = roundMoney(d.totalAmount);
      const remaining = roundMoney(d.remainingBalance);
      const done = remaining <= 0;
      const payLabel = done ? "Liquidada" : `Cuota mensual: ${formatMoney(d.monthlyPayment)}`;

      return `
      <article class="debt-card${done ? " debt-card--done" : ""}" data-id="${d.id}">
        <div class="debt-card__head">
          <h3 class="debt-card__title">${escapeHtml(d.name)}</h3>
          <span class="debt-card__remaining">${formatMoney(remaining)}</span>
        </div>
        <p class="debt-card__meta">Total: ${formatMoney(total)} · ${payLabel}</p>
        <p class="debt-card__progress-summary">
          Pagado: ${formatMoney(paid)} / ${formatMoney(total)}
          <span class="debt-card__progress-pct">(${pct}%)</span>
        </p>
        <p class="debt-card__progress-remaining">Pendiente: ${formatMoney(remaining)}</p>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Porcentaje pagado">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>
        <div class="debt-card__actions">
          <button type="button" class="btn btn--success btn--small" data-action="pay" data-id="${d.id}" ${done ? "disabled" : ""}>
            Registrar pago
          </button>
          <button type="button" class="btn btn--outline btn--small" data-action="edit" data-id="${d.id}">Editar</button>
          <button type="button" class="btn btn--ghost btn--small" data-action="delete" data-id="${d.id}" style="color:var(--color-danger);border-color:transparent">Eliminar</button>
        </div>
      </article>`;
    })
    .join("");

  root.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action || btn.disabled) return;
      if (action === "pay") handlers.onPay(id);
      if (action === "edit") handlers.onEdit(id);
      if (action === "delete") handlers.onDelete(id);
    });
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
