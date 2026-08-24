const CACHE_NAME = "infininoc-static-v1.0.0";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icon.svg",
    "/icon.png",
    "/favicon.ico",
    "/apple-touch-icon.png",
];

// Install: Cache core static shell
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Evict legacy caches
self.addEventListener("activate", function (event) {
    event.waitUntil(
        (async function () {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                if (cacheName !== CACHE_NAME) {
                    await caches.delete(cacheName);
                }
            }
            await self.clients.claim();
        })()
    );
});

// Fetch: Static network-first / cache-fallback safety
self.addEventListener("fetch", function (event) {
    const url = new URL(event.request.url);

    // NEVER cache dynamic API, WebSocket, socket.io or sensitive endpoints
    if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/socket.io/") ||
        event.request.method !== "GET"
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If valid response, update cache for static assets
                if (response && response.status === 200 && response.type === "basic") {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache when offline
                return caches.match(event.request);
            })
    );
});

// Receive push notifications
self.addEventListener("push", function (event) {
    if (self.Notification?.permission !== "granted") {
        return;
    }

    if (event.data) {
        let message = event.data.json();
        try {
            self.registration.showNotification(message.title || "InfiniNOC Alert", {
                body: message.body || "Network monitoring telemetry alert",
                icon: "/icon.png",
                badge: "/favicon.ico",
            });
        } catch (error) {
            console.error("Failed to show notification:", error);
        }
    }
});
