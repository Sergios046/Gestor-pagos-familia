import { formatMoney, roundMoney } from "../utils/money.js";

/**
 * @param {HTMLElement} root
 * @param {import('../services/paymentHistoryService.js').PaymentHistoryRow[]} events
 */
export function renderHistory(root, events) {
  if (!events.length) {
    root.innerHTML =
      '<div class="empty-state"><p>Aún no hay pagos en el historial.</p><p class="history-empty-hint">Al marcar un gasto como pagado o registrar una cuota de deuda, aparecerá aquí.</p></div>';
    return;
  }

  const total = events.reduce((s, e) => s + roundMoney(e.amount), 0);
  const summary = `<div class="history-summary"><p class="history-summary__label">Total en esta lista</p><p class="history-summary__value">${formatMoney(total)}</p><p class="history-summary__meta">${events.length} movimiento${events.length === 1 ? "" : "s"}</p></div>`;

  const groups = groupByMonth(events);
  const blocks = groups
    .map(
      ({ key, label, items }) => `
    <section class="history-group" aria-labelledby="hist-${key}">
      <h3 class="history-group__title" id="hist-${key}">${escapeHtml(label)}</h3>
      <ul class="history-list">
        ${items
          .map(
            (e) => `
        <li class="history-row">
          <span class="history-row__badge history-row__badge--${e.kind}" aria-hidden="true">${e.kind === "debt" ? "Deuda" : "Gasto"}</span>
          <div class="history-row__main">
            <span class="history-row__title">${escapeHtml(e.title)}</span>
            <time class="history-row__time" datetime="${escapeHtml(String(e.paidAt).replace(/"/g, ""))}">${formatDateTime(e.paidAt)}</time>
          </div>
          <span class="history-row__amount">${formatMoney(e.amount)}</span>
        </li>`
          )
          .join("")}
      </ul>
    </section>`
    )
    .join("");

  root.innerHTML = summary + blocks;
}

/**
 * @param {import('../services/paymentHistoryService.js').PaymentHistoryRow[]} events
 */
function groupByMonth(events) {
  /** @type {Map<string, import('../services/paymentHistoryService.js').PaymentHistoryRow[]>} */
  const map = new Map();
  const monthFmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });

  for (const e of events) {
    const d = new Date(e.paidAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = monthFmt.format(d).replace(/^\w/, (c) => c.toUpperCase());
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key).items.push(e);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, v]) => v);
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
