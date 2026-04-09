export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowISO() {
  return new Date().toISOString();
}

/**
 * Normalize to `YYYY-MM-DD` for Postgres `date` and Supabase inserts.
 * @param {string|Date|undefined|null} value
 * @returns {string} Empty string if missing/invalid.
 */
export function normalizeDueDateToYYYYMMDD(value) {
  if (value == null) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return "";
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const da = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return "";
  const check = new Date(y, mo - 1, da);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== da) {
    return "";
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * @param {string} isoDate 'YYYY-MM-DD'
 */
export function parseLocalDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {string} iso
 */
export function isInCurrentMonth(iso) {
  if (!iso) return false;
  const t = new Date(iso);
  const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth();
}

/**
 * Days until due (0 = today). Negative = overdue.
 * @param {string} dueDateISO 'YYYY-MM-DD'
 */
export function daysUntil(dueDateISO) {
  const due = parseLocalDate(dueDateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}
