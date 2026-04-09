/**
 * Service worker — shell cache. API/Realtime va siempre a red (Supabase).
 */
const CACHE = "gestor-pagos-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon.svg",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./js/app.js",
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          if (res.status === 200) {
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
