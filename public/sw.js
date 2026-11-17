const CACHE_NAME = "raqamora-pwa-v4";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: pre-cache application shell and skip waiting immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch (err) {
        console.warn("[SW] Cache addAll warning:", err);
      }
    })
  );
});

// Activate: cleanup ALL old caches and claim clients immediately
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

// Fetch handler: Network-First with Offline Cache Fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (mutations handled by client offline queue)
  if (request.method !== "GET") return;

  // For API calls, pass through (managed by client-side optimistic offline engine)
  if (url.pathname.startsWith("/api/")) return;

  // Network-First for HTML, Scripts, Styles and Static Assets
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      } catch (networkErr) {
        // Network failed (device is offline): serve from cache
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;

        // Fallback for navigation requests
        if (request.mode === "navigate") {
          const rootCached = await caches.match("/", { ignoreSearch: true });
          if (rootCached) return rootCached;
        }

        return new Response(
          "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h2>RAQAMORA Offline</h2><p>Please connect to internet to cache the application shell once.</p></body></html>",
          { headers: { "Content-Type": "text/html" } }
        );
      }
    })()
  );
});
