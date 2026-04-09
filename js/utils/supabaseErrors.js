/**
 * Human-readable message from Supabase PostgREST errors, Error, or unknown throws.
 * @param {unknown} err
 * @returns {string}
 */
export function toErrorMessage(err) {
  if (err == null) return "Error desconocido";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || "Error";

  if (typeof err === "object") {
    const o = /** @type {Record<string, unknown>} */ (err);
    const parts = [
      o.message,
      o.details,
      o.hint,
      o.code && `(${o.code})`,
    ].filter((x) => x != null && String(x).trim() !== "");
    if (parts.length > 0) return parts.map(String).join(" — ");
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
