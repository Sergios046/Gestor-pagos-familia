import { formatMoney, roundMoney } from "../utils/money.js";
import { debtProgressPercent, debtAmountPaid } from "../models/debt.js";
import { parseLocalDate, daysUntil, isDueMonthOnOrBeforeCurrent } from "../utils/dates.js";

/**
 * @param {HTMLElement} root
 * @param {import('../models/debt.js').Debt[]} debts
 * @param {object} handlers
 */
export function renderDebtList(root, debts, handlers) {
  const sorted = [...debts].sort((a, b) => parseLocalDate(a.dueDate) - parseLocalDate(b.dueDate) || a.name.localeCompare(b.name, "es-MX"));

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
      const canPay = !done && isDueMonthOnOrBeforeCurrent(d.dueDate);
      const dueWhen = formatDebtDue(d.dueDate);
      const payTitle = !canPay && !done
        ? "La cuota está programada en un mes futuro; vuelve cuando llegue ese mes o edita la fecha."
        : "";
      const refParts = [];
      if (d.referenceNumber) refParts.push(`Ref. ${escapeHtml(d.referenceNumber)}`);
      if (d.convenio) refParts.push(`Convenio ${escapeHtml(d.convenio)}`);
      if (d.infonavitCredit) refParts.push(`Infonavit ${escapeHtml(d.infonavitCredit)}`);
      const refLine =
        refParts.length > 0 ? `<p class="debt-card__refs">${refParts.join(" · ")}</p>` : "";

      return `
      <article class="debt-card${done ? " debt-card--done" : ""}" data-id="${d.id}">
        <div class="debt-card__head">
          <h3 class="debt-card__title">${escapeHtml(d.name)}</h3>
          <span class="debt-card__remaining">${formatMoney(remaining)}</span>
        </div>
        ${refLine}
        <p class="debt-card__meta">Próxima cuota: ${escapeHtml(dueWhen)} · Total: ${formatMoney(total)} · ${payLabel}</p>
        <p class="debt-card__progress-summary">
          Pagado: ${formatMoney(paid)} / ${formatMoney(total)}
          <span class="debt-card__progress-pct">(${pct}%)</span>
        </p>
        <p class="debt-card__progress-remaining">Pendiente: ${formatMoney(remaining)}</p>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Porcentaje pagado">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>
        <div class="debt-card__actions">
          <button type="button" class="btn btn--success btn--small" data-action="pay" data-id="${d.id}" ${done || !canPay ? "disabled" : ""} title="${escapeAttr(payTitle)}">
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

function formatDebtDue(iso) {
  try {
    const d = daysUntil(iso);
    const dateStr = parseLocalDate(iso).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    if (d < 0) return `${dateStr} · retrasada`;
    if (d === 0) return `${dateStr} · hoy`;
    if (d === 1) return `${dateStr} · mañana`;
    return `${dateStr} · en ${d} d.`;
  } catch {
    return iso;
  }
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
