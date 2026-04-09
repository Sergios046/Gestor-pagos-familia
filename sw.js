/**
 * Service worker — assets cache. HTML/navegación: red primero para no quedarte en una versión vieja (login, etc.).
 */
const CACHE = "gestor-pagos-v12";

/** Sin index.html aquí: la primera carga del documento va a red y luego se guarda en caché. */
const ASSETS = [
  "./manifest.json",
  "./assets/icon.svg",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./js/app.js",
  "./js/auth/authGate.js",
  "./js/config.js",
  "./js/state/store.js",
  "./js/models/expense.js",
  "./js/models/debt.js",
  "./js/services/supabaseClient.js",
  "./js/services/supabaseMappers.js",
  "./js/services/realtimeSync.js",
  "./js/services/expenseService.js",
  "./js/services/debtService.js",
  "./js/utils/id.js",
  "./js/utils/dates.js",
  "./js/utils/money.js",
  "./js/utils/validation.js",
  "./js/utils/supabaseErrors.js",
  "./js/ui/dashboard.js",
  "./js/ui/debtList.js",
  "./js/ui/expenseList.js",
  "./js/ui/toast.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** @param {FetchEvent} event */
function isNavigationRequest(event) {
  return event.request.mode === "navigate" || event.request.destination === "document";
}

/** CSS/JS: red primero para no quedar con estilos o lógica viejos (caché-first rompía el login). */
function useNetworkFirst(url) {
  const p = url.pathname;
  return p.includes("/css/") || p.includes("/js/") || /\.(css|js)(\?|$)/i.test(p);
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(event)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.status === 200) {
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached =
            (await caches.match(event.request)) ||
            (await caches.match("./index.html")) ||
            (await caches.match(new URL("index.html", self.location).href));
          return cached || Response.error();
        })
    );
    return;
  }

  if (useNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.status === 200) {
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(event.request)) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.status === 200) {
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          const c = await caches.match("./index.html");
          return c || Response.error();
        });
    })
  );
});
