// Minimal service worker for PWA install prompt
// Intentionally does not cache - ralph-watch needs live server connection

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op: pass through all requests to network
  // This is a dev tool that requires server connectivity
});
