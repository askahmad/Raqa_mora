const CACHE_NAME = "raqamora-pwa-v2";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: pre-cache application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn("[SW] Cache addAll warning:", err);
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: cleanup old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (mutations handled by client offline queue)
  if (request.method !== "GET") return;

  // For API calls, pass through (managed by client-side optimistic offline engine)
  if (url.pathname.startsWith("/api/")) return;

  // 1. Navigation requests (opening or refreshing pages)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        // If device reports offline, serve cached shell immediately
        if (typeof self.navigator !== "undefined" && !self.navigator.onLine) {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const rootCached = await caches.match("/", { ignoreSearch: true });
          if (rootCached) return rootCached;
        }

        try {
          // Attempt network fetch
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, clone);
          }
          return networkResponse;
        } catch (fetchErr) {
          // Network failed: fallback to cached route or root shell
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const rootCached = await caches.match("/", { ignoreSearch: true });
          if (rootCached) return rootCached;

          return new Response(
            "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h2>RAQAMORA Offline</h2><p>Please connect to internet to cache the application shell once.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
      })()
    );
    return;
  }

  // 2. Static Assets (Next.js scripts, styles, images, fonts)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Graceful fallback for offline image/asset misses
          return new Response("", { status: 408, statusText: "Offline Resource" });
        });
      })
    );
  }
});
