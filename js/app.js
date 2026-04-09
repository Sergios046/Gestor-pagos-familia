import { createStore } from "./state/store.js";
import {
  listExpenses,
  createExpense,
  updateExpense,
  removeExpense,
  markExpensePaid,
  markExpenseUnpaid,
} from "./services/expenseService.js";
import {
  listDebts,
  createDebt,
  updateDebt,
  removeDebt,
  registerDebtPayment,
} from "./services/debtService.js";
import { renderDashboard } from "./ui/dashboard.js";
import { renderExpenseList } from "./ui/expenseList.js";
import { renderDebtList } from "./ui/debtList.js";
import { showToast } from "./ui/toast.js";
import { todayISO } from "./utils/dates.js";
import { formatMoney, roundMoney } from "./utils/money.js";
import { validateExpenseFormData, validateDebtFormData } from "./utils/validation.js";
import { toErrorMessage } from "./utils/supabaseErrors.js";
import { subscribeExpensesAndDebts } from "./services/realtimeSync.js";
import { getSupabase, resetSupabaseClient } from "./services/supabaseClient.js";
import { mountAuthGate, signOutAndReload } from "./auth/authGate.js";

/**
 * @typedef {{ expenses: import('./models/expense.js').Expense[]; debts: import('./models/debt.js').Debt[]; filter: 'pending' | 'paid' | 'all'; view: 'dashboard' | 'expenses' | 'debts' }} AppState
 */

const initialState = {
  expenses: [],
  debts: [],
  filter: /** @type {const} */ ("pending"),
  view: /** @type {const} */ ("dashboard"),
};

const store = createStore(/** @type {AppState} */ (initialState));

const authGate = document.getElementById("auth-gate");
const appShell = document.getElementById("app-shell");

/**
 * Quita el login del DOM (no solo ocultarlo): evita que un CSS viejo o capas raras sigan bloqueando toques.
 */
function hideAuthGate() {
  if (!authGate) return;
  authGate.hidden = true;
  authGate.style.setProperty("display", "none", "important");
  authGate.setAttribute("aria-hidden", "true");
  authGate.remove();
}

function showAuthGate() {
  if (!authGate) return;
  authGate.hidden = false;
  authGate.style.removeProperty("display");
  authGate.removeAttribute("aria-hidden");
}

function showAppShell() {
  if (!appShell) return;
  appShell.hidden = false;
  appShell.style.removeProperty("display");
}

function hideAppShell() {
  if (!appShell) return;
  appShell.hidden = true;
  appShell.style.setProperty("display", "none", "important");
}

const els = {
  views: {
    dashboard: document.getElementById("view-dashboard"),
    expenses: document.getElementById("view-expenses"),
    debts: document.getElementById("view-debts"),
  },
  navBtns: document.querySelectorAll("[data-view]"),
  dashboardRoot: document.querySelector("[data-dashboard-root]"),
  expenseListRoot: document.querySelector("[data-expense-list-root]"),
  debtListRoot: document.querySelector("[data-debt-list-root]"),
  filterBtns: document.querySelectorAll("[data-filter]"),
  expenseModal: document.getElementById("expense-modal"),
  expenseForm: document.getElementById("expense-form"),
  debtModal: document.getElementById("debt-modal"),
  debtForm: document.getElementById("debt-form"),
  toast: document.querySelector("[data-toast]"),
  signOutBtn: document.getElementById("sign-out-btn"),
  openExpenseFormBtns: document.querySelectorAll("[data-action='open-expense-form']"),
  openDebtFormBtns: document.querySelectorAll("[data-action='open-debt-form']"),
};

function toastMsg(text) {
  showToast(els.toast, text);
}

function syncView() {
  const { view } = store.getState();
  Object.entries(els.views).forEach(([key, section]) => {
    if (!section) return;
    const active = key === view;
    section.hidden = !active;
    section.classList.toggle("view--active", active);
  });
  els.navBtns.forEach((btn) => {
    const v = btn.getAttribute("data-view");
    const active = v === view;
    btn.classList.toggle("app-nav__btn--active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

function syncUI() {
  const state = store.getState();
  syncView();
  if (els.dashboardRoot) {
    renderDashboard(els.dashboardRoot, state.expenses, state.debts);
  }
  if (els.expenseListRoot) {
    renderExpenseList(els.expenseListRoot, state.expenses, state.filter, {
      onPaid: (id) => handlePaid(id),
      onUnpaid: (id) => handleUnpaid(id),
      onEdit: (id) => openExpenseModalForEdit(id),
      onDelete: (id) => handleDelete(id),
    });
  }
  if (els.debtListRoot) {
    renderDebtList(els.debtListRoot, state.debts, {
      onPay: (id) => handleDebtPayment(id),
      onEdit: (id) => openDebtModalForEdit(id),
      onDelete: (id) => handleDebtDelete(id),
    });
  }
  els.filterBtns.forEach((btn) => {
    const f = btn.getAttribute("data-filter");
    const active = f === state.filter;
    btn.classList.toggle("segmented__btn--active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

async function reloadData() {
  try {
    const [expenses, debts] = await Promise.all([listExpenses(), listDebts()]);
    store.setState((s) => {
      s.expenses = expenses;
      s.debts = debts;
    });
    syncUI();
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function handlePaid(id) {
  try {
    await markExpensePaid(id);
    await reloadData();
    showToast(els.toast, "Marcado como pagado");
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function handleUnpaid(id) {
  try {
    await markExpenseUnpaid(id);
    await reloadData();
    showToast(els.toast, "Marcado como pendiente");
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function handleDelete(id) {
  if (!confirm("¿Eliminar este gasto?")) return;
  try {
    await removeExpense(id);
    await reloadData();
    showToast(els.toast, "Gasto eliminado");
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function handleDebtPayment(id) {
  const d = store.getState().debts.find((x) => x.id === id);
  if (!d || roundMoney(d.remainingBalance) <= 0) return;
  if (roundMoney(d.monthlyPayment) <= 0) {
    showToast(els.toast, `Ajusta la cuota mensual (ahora es ${formatMoney(d.monthlyPayment)})`);
    return;
  }
  try {
    const { applied } = await registerDebtPayment(id);
    await reloadData();
    if (applied <= 0) {
      showToast(els.toast, `Cuota mensual: ${formatMoney(0)}`);
    } else {
      showToast(els.toast, `Pago registrado: ${formatMoney(applied)}`);
    }
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function handleDebtDelete(id) {
  if (!confirm("¿Eliminar esta deuda?")) return;
  try {
    await removeDebt(id);
    await reloadData();
    showToast(els.toast, "Deuda eliminada");
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

function openExpenseModalNew() {
  if (!els.expenseModal || !els.expenseForm) return;
  const title = document.getElementById("expense-modal-title");
  if (title) title.textContent = "Nuevo gasto";
  els.expenseForm.reset();
  const idInput = document.getElementById("expense-id");
  if (idInput) idInput.value = "";
  const due = document.getElementById("expense-due");
  if (due) due.value = todayISO();
  els.expenseModal.hidden = false;
  document.getElementById("expense-name")?.focus();
}

/** @param {string} id */
function openExpenseModalForEdit(id) {
  const exp = store.getState().expenses.find((e) => e.id === id);
  if (!exp || !els.expenseModal || !els.expenseForm) return;
  const title = document.getElementById("expense-modal-title");
  if (title) title.textContent = "Editar gasto";
  const idInput = document.getElementById("expense-id");
  if (idInput) idInput.value = exp.id;
  const n = document.getElementById("expense-name");
  if (n) n.value = exp.name;
  const a = document.getElementById("expense-amount");
  if (a) a.value = roundMoney(exp.amount).toFixed(2);
  const d = document.getElementById("expense-due");
  if (d) d.value = exp.dueDate;
  const c = document.getElementById("expense-category");
  if (c) c.value = exp.category ?? "";
  els.expenseModal.hidden = false;
  document.getElementById("expense-name")?.focus();
}

function syncDebtRemainingMax() {
  const totalEl = document.getElementById("debt-total");
  const remEl = document.getElementById("debt-remaining");
  if (!totalEl || !remEl) return;
  const v = Number(totalEl.value);
  if (Number.isFinite(v) && v > 0) {
    remEl.setAttribute("max", String(v));
  } else {
    remEl.removeAttribute("max");
  }
}

function openDebtModalNew() {
  if (!els.debtModal || !els.debtForm) return;
  const title = document.getElementById("debt-modal-title");
  if (title) title.textContent = "Nueva deuda";
  els.debtForm.reset();
  const idInput = document.getElementById("debt-id");
  if (idInput) idInput.value = "";
  syncDebtRemainingMax();
  els.debtModal.hidden = false;
  document.getElementById("debt-name")?.focus();
}

/** @param {string} id */
function openDebtModalForEdit(id) {
  const d = store.getState().debts.find((x) => x.id === id);
  if (!d || !els.debtModal || !els.debtForm) return;
  const title = document.getElementById("debt-modal-title");
  if (title) title.textContent = "Editar deuda";
  document.getElementById("debt-id").value = d.id;
  document.getElementById("debt-name").value = d.name;
  document.getElementById("debt-total").value = roundMoney(d.totalAmount).toFixed(2);
  document.getElementById("debt-monthly").value = roundMoney(d.monthlyPayment).toFixed(2);
  document.getElementById("debt-remaining").value = roundMoney(d.remainingBalance).toFixed(2);
  syncDebtRemainingMax();
  els.debtModal.hidden = false;
  document.getElementById("debt-name")?.focus();
}

async function onExpenseFormSubmit(ev) {
  ev.preventDefault();
  if (!els.expenseForm) return;
  if (!els.expenseForm.checkValidity()) {
    els.expenseForm.reportValidity();
    return;
  }
  const fd = new FormData(els.expenseForm);
  const id = String(fd.get("id") || "").trim();
  const parsed = validateExpenseFormData(fd);
  if (!parsed.ok) {
    showToast(els.toast, parsed.message);
    return;
  }
  const { name, amount, dueDate, category } = parsed;

  try {
    if (id) {
      await updateExpense(id, {
        name,
        amount,
        dueDate,
        category,
      });
      showToast(els.toast, "Gasto actualizado");
    } else {
      await createExpense({
        name,
        amount,
        dueDate,
        category,
      });
      showToast(els.toast, "Gasto añadido");
    }
    if (els.expenseModal) els.expenseModal.hidden = true;
    await reloadData();
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

async function onDebtFormSubmit(ev) {
  ev.preventDefault();
  if (!els.debtForm) return;
  if (!els.debtForm.checkValidity()) {
    els.debtForm.reportValidity();
    return;
  }
  const fd = new FormData(els.debtForm);
  const id = String(fd.get("id") || "").trim();
  const parsed = validateDebtFormData(fd);
  if (!parsed.ok) {
    showToast(els.toast, parsed.message);
    return;
  }
  const { name, totalAmount, monthlyPayment, remainingBalance } = parsed;

  try {
    if (id) {
      await updateDebt(id, {
        name,
        totalAmount,
        monthlyPayment,
        remainingBalance,
      });
      showToast(els.toast, "Deuda actualizada");
    } else {
      await createDebt({
        name,
        totalAmount,
        monthlyPayment,
        remainingBalance,
      });
      showToast(els.toast, "Deuda añadida");
    }
    if (els.debtModal) els.debtModal.hidden = true;
    await reloadData();
  } catch (err) {
    console.error(err);
    showToast(els.toast, toErrorMessage(err));
  }
}

function registerNav() {
  els.navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.getAttribute("data-view");
      if (v !== "dashboard" && v !== "expenses" && v !== "debts") return;
      store.setState((s) => {
        s.view = v;
      });
      syncUI();
    });
  });
}

function registerFilters() {
  els.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.getAttribute("data-filter");
      if (f !== "pending" && f !== "paid" && f !== "all") return;
      store.setState((s) => {
        s.filter = f;
      });
      syncUI();
    });
  });
}

function registerDismissModals() {
  document.querySelectorAll("[data-dismiss-modal]").forEach((n) => {
    n.addEventListener("click", () => {
      const modal = n.closest(".modal");
      if (modal) modal.hidden = true;
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal").forEach((m) => {
      if (!m.hidden) m.hidden = true;
    });
  });
}

function registerDebtFormConstraints() {
  const totalEl = document.getElementById("debt-total");
  if (totalEl) {
    totalEl.addEventListener("input", syncDebtRemainingMax);
    totalEl.addEventListener("change", syncDebtRemainingMax);
  }
}

function registerForms() {
  els.openExpenseFormBtns.forEach((b) => b.addEventListener("click", () => openExpenseModalNew()));
  els.openDebtFormBtns.forEach((b) => b.addEventListener("click", () => openDebtModalNew()));
  els.expenseForm?.addEventListener("submit", onExpenseFormSubmit);
  els.debtForm?.addEventListener("submit", onDebtFormSubmit);
  registerDebtFormConstraints();
}

/** Supabase Realtime → multi-device sync */
let unsubscribeRealtime = () => {};

function attachRealtimeSync() {
  unsubscribeRealtime = subscribeExpensesAndDebts(() => reloadData());
}

let appStarted = false;
/** @type {Promise<void> | null} */
let ensureAppPromise = null;

async function showAppAndStart() {
  hideAuthGate();
  showAppShell();
  await ensureAppStarted();
}

async function ensureAppStarted() {
  if (appStarted) {
    await reloadData();
    return;
  }
  if (!ensureAppPromise) {
    ensureAppPromise = (async () => {
      appStarted = true;
      registerNav();
      registerFilters();
      registerDismissModals();
      registerForms();
      els.signOutBtn?.addEventListener("click", () => {
        void signOutAndReload({ showToast: toastMsg });
      });
      attachRealtimeSync();
      await reloadData();
      registerServiceWorker();
      window.addEventListener("beforeunload", () => unsubscribeRealtime());
    })();
  }
  await ensureAppPromise;
}

async function boot() {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  mountAuthGate({
    onSignedIn: () => {
      void showAppAndStart();
    },
    showToast: toastMsg,
  });

  if (session) {
    await showAppAndStart();
  } else {
    showAuthGate();
    hideAppShell();
  }

  supabase.auth.onAuthStateChange((event, sessionNext) => {
    if (!sessionNext) {
      if (appStarted) {
        resetSupabaseClient();
        window.location.reload();
      }
      return;
    }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      hideAuthGate();
      showAppShell();
      if (appStarted) {
        void reloadData();
      } else {
        void ensureAppStarted().catch((err) => {
          console.error(err);
          showToast(els.toast, toErrorMessage(err));
        });
      }
    }
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* dev server or file:// */
    });
  });
}

void boot();
