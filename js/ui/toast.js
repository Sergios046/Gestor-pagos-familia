let toastTimer = 0;

/** @param {HTMLElement | null} el */
export function showToast(el, message, ms = 2600) {
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, ms);
}
