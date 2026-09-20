'use strict';

const VERSION = 'webcraft-v2-features-1';
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
  './js/game/save.js',
  './js/game/crafting.js',
  './js/game/drops.js',
  './js/game/mobs.js'
];

function isCacheable(req, res) {
  if (!res || !res.ok) return false;
  const u = new URL(req.url);
  return u.origin === self.location.origin || /jsdelivr\.net$/.test(u.hostname);
}

function shouldNetworkFirst(req) {
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return false;
  return u.pathname.endsWith('.html')
    || u.pathname.endsWith('.js')
    || u.pathname.endsWith('.css')
    || u.pathname.endsWith('.webmanifest');
}

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

  const networkFirst = shouldNetworkFirst(e.request);

  e.respondWith((networkFirst
    ? fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (isCacheable(e.request, res)) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    : caches.match(e.request)
        .then(hit => hit || fetch(e.request).then(res => {
          if (isCacheable(e.request, res)) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        }))
  ));
});
