// Service worker minimo: rende il sito installabile. Non mette nulla in cache, la città è sempre quella del server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
