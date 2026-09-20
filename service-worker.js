'use strict';

const VERSION = 'webcraft-v1.1-ui-start-fix-20260920';
const CORE = [
  './',
  './index.html',
  './play.html',
  './css/style.css',
  './css/game.css',
  './manifest.webmanifest',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/og-image.png',
  './img/shot-coast.png',
  './img/shot-forest.png',
  './img/shot-night.png',
  './js/game/items.js',
  './js/game/drops.js',
  './js/game/mobs.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const sameOrigin = e.request.url.startsWith(self.location.origin);
          const cdn = /jsdelivr\.net/.test(e.request.url);
          if (sameOrigin || cdn) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
          }
        }
        return res;
      }).catch(() => hit);
    })
  );
});
