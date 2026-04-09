import { getSupabase, resetSupabaseClient } from "../services/supabaseClient.js";
import { toErrorMessage } from "../utils/supabaseErrors.js";

/**
 * @param {{ onSignedIn: () => void; showToast: (msg: string) => void }} options
 */
export function mountAuthGate({ onSignedIn, showToast }) {
  const form = document.getElementById("auth-form");
  const emailIn = document.getElementById("auth-email");
  const passIn = document.getElementById("auth-password");
  const submitBtn = document.getElementById("auth-submit");
  const toggleBtn = document.getElementById("auth-toggle-mode");
  if (!form || !emailIn || !passIn || !submitBtn || !toggleBtn) return;

  let registerMode = false;

  const syncLabels = () => {
    submitBtn.textContent = registerMode ? "Crear cuenta" : "Entrar";
    toggleBtn.textContent = registerMode ? "¿Ya tienes cuenta? Entrar" : "¿No tienes cuenta? Registrarse";
  };
  syncLabels();

  toggleBtn.addEventListener("click", () => {
    registerMode = !registerMode;
    syncLabels();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = String(emailIn.value || "").trim();
    const password = String(passIn.value || "");
    if (!email || !password) {
      showToast("Introduce correo y contraseña.");
      return;
    }
    if (password.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const supabase = getSupabase();
    try {
      if (registerMode) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          showToast(
            "Cuenta creada. Revisa el correo para confirmar o desactiva «Confirm email» en Supabase (Auth → Providers → Email)."
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      passIn.value = "";
      onSignedIn();
    } catch (err) {
      showToast(toErrorMessage(err));
    }
  });
}

/**
 * @param {{ showToast: (msg: string) => void }} options
 */
export async function signOutAndReload({ showToast }) {
  try {
    const client = getSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    resetSupabaseClient();
    window.location.reload();
  } catch (err) {
    showToast(toErrorMessage(err));
  }
}
