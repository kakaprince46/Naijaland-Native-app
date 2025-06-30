// Service Worker for NaijaLand PWA

/* --- CONFIGURATION --- */
// Increment the version number to trigger an update and flush the old cache.
const CACHE_NAME = 'naijaland-cache-v16';
const OFFLINE_URL = 'offline.html'; // Ensure this file exists in your root folder.

// List of essential files to cache upon installation.
const urlsToCache = [
  '/',
  'index.html',
  'manifest.json',
  OFFLINE_URL,
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/android-chrome-192x192.png',
  '/icons/android-chrome-512x512.png',
  '/icons/mstile-144x144.png'
];

/* --- INSTALL EVENT --- */
// Caches the app shell (essential files).
self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing: ${CACHE_NAME}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[ServiceWorker] Cache addAll() failed:', err);
      })
  );
});

/* --- ACTIVATE EVENT --- */
// Cleans up old caches.
self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] Activating: ${CACHE_NAME}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If a cache is not the current one, delete it.
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tell the active service worker to take control of the page immediately.
      return self.clients.claim();
    })
  );
});

/* --- FETCH EVENT --- */
// Intercepts network requests and serves cached assets when offline.
self.addEventListener('fetch', (event) => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-first for Firestore API calls to ensure data is always fresh.
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Optionally, you could return a custom JSON response indicating offline status.
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for all other requests.
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If the resource is in the cache, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If the resource is not in the cache, fetch it from the network.
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if the response is valid and from our own origin.
            // We don't cache third-party scripts (Tailwind, FontAwesome, Paystack).
            const isResponseValid = networkResponse && networkResponse.status === 200;
            const isFromOurOrigin = event.request.url.startsWith(self.location.origin);

            if (isResponseValid && isFromOurOrigin) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // If the fetch fails (user is offline), return the offline page.
            // This specifically handles navigation requests.
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            // For other failed requests (e.g., images), we can just let them fail.
            return new Response("Network error", {
              status: 408,
              headers: { "Content-Type": "text/plain" },
            });
          });
      })
  );
});