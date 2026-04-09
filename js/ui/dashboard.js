import { formatMoney, roundMoney } from "../utils/money.js";
import { daysUntil, isInCurrentMonth, parseLocalDate } from "../utils/dates.js";

/**
 * @param {HTMLElement} root
 * @param {import('../models/expense.js').Expense[]} expenses
 * @param {import('../models/debt.js').Debt[]} debts
 * @param {import('../services/paymentHistoryService.js').PaymentHistoryRow[]} [paymentHistory]
 */
export function renderDashboard(root, expenses, debts, paymentHistory = []) {
  const pending = expenses.filter((e) => !e.paid);
  const totalPending = roundMoney(pending.reduce((s, e) => s + e.amount, 0));

  // Mismo origen que el historial: suma de payment_events del mes (gastos + deudas).
  const totalPaidMonth = roundMoney(
    paymentHistory.filter((ev) => isInCurrentMonth(ev.paidAt)).reduce((s, ev) => s + ev.amount, 0)
  );

  const totalDebtRemaining = roundMoney(debts.reduce((s, d) => s + d.remainingBalance, 0));

  const upcoming = [...pending]
    .sort((a, b) => parseLocalDate(a.dueDate) - parseLocalDate(b.dueDate))
    .slice(0, 5);

  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-card__label">Pendiente</p>
        <p class="stat-card__value">${formatMoney(totalPending)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card__label">Pagado este mes</p>
        <p class="stat-card__value">${formatMoney(totalPaidMonth)}</p>
      </div>
      <div class="stat-card stat-card--wide">
        <p class="stat-card__label">Saldo deudas</p>
        <p class="stat-card__value">${formatMoney(totalDebtRemaining)}</p>
      </div>
      <div class="stat-card stat-card--wide panel">
        <h3 class="panel__title">Próximos pagos</h3>
        ${
          upcoming.length === 0
            ? '<div class="empty-state"><p>No hay pagos pendientes.</p></div>'
            : `<ul class="upcoming-list">
          ${upcoming
            .map((e) => {
              const d = daysUntil(e.dueDate);
              let when;
              if (d < 0) when = `Vencido hace ${Math.abs(d)} d.`;
              else if (d === 0) when = "Vence hoy";
              else if (d === 1) when = "Mañana";
              else when = `En ${d} días`;
              return `<li class="upcoming-item">
                <div>
                  <p class="upcoming-item__name">${escapeHtml(e.name)}</p>
                  <p class="upcoming-item__meta">${when} · ${formatDateShort(e.dueDate)}</p>
                </div>
                <span class="upcoming-item__amount">${formatMoney(e.amount)}</span>
              </li>`;
            })
            .join("")}
        </ul>`
        }
      </div>
    </div>
  `;
}

function formatDateShort(iso) {
  try {
    const d = parseLocalDate(iso);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
