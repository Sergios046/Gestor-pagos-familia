/**
 * Human-readable message from Supabase PostgREST errors, Error, or unknown throws.
 * @param {unknown} err
 * @returns {string}
 */
export function toErrorMessage(err) {
  if (err == null) return "Error desconocido";
  if (typeof err === "string") return mapAuthHints(err);
  if (err instanceof Error) return mapAuthHints(err.message || "Error");

  if (typeof err === "object") {
    const o = /** @type {Record<string, unknown>} */ (err);
    const parts = [
      o.message,
      o.details,
      o.hint,
      o.code && `(${o.code})`,
    ].filter((x) => x != null && String(x).trim() !== "");
    if (parts.length > 0) return mapAuthHints(parts.map(String).join(" — "));
  }

  try {
    return mapAuthHints(JSON.stringify(err));
  } catch {
    return mapAuthHints(String(err));
  }
}

/** @param {string} msg */
function mapAuthHints(msg) {
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("email rate limit")) {
    return "Demasiados intentos con el correo. Espera ~1 hora o entra con «Ya tengo cuenta» si ya registraste.";
  }
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "Correo sin confirmar. Abre el enlace del mail o desactiva «Confirm email» en Supabase (Auth → Email).";
  }
  if (m.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  return msg;
}
