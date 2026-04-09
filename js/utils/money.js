import { config } from "../config.js";

/**
 * Mexican pesos: `Intl.NumberFormat('es-MX', { currency: 'MXN', … })` with 2 decimals
 * and `narrowSymbol` so amounts show with $ where the engine supports it.
 */

/**
 * Round monetary values to 2 decimal places (centavos).
 * @param {number|string} n
 * @returns {number}
 */
export function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

const fmt = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  /** Prefer "$" style for MXN in es-MX where supported */
  currencyDisplay: "narrowSymbol",
});

/**
 * @param {number|string} amount
 * @returns {string}
 */
export function formatMoney(amount) {
  return fmt.format(roundMoney(amount));
}
