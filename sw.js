const CACHE_NAME = 'gps-camera-v1';

// Very basic service worker that caches nothing but satisfies the installability requirement.
// We are bypassing caching for simplicity and relying on the browser's default caching,
// but Android requires a fetch event listener to show the install prompt.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle the fetch normally
  event.respondWith(fetch(event.request));
});
