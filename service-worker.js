'use strict';

const VERSION = 'webcraft-v1.2.8-pc-mobile-crafting-v5';
const CORE = [
  './',
  './index.html',
  './play.html',
  './css/style.css',
  './css/game.css',
  './css/mobile-test.css?v=pcmobile4',
  './manifest.webmanifest',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/og-image.png',
  './img/shot-coast.png',
  './img/shot-forest.png',
  './img/shot-night.png',
  './js/game/items.js',
  './js/game/items.js?v=craftfix128',
  './js/game/drops.js',
  './js/game/mobs.js',
  './js/game/config.js',
  './js/game/config.js?v=v128',
  './js/game/noise.js',
  './js/game/terrain.js',
  './js/game/textures.js',
  './js/game/world.js',
  './js/game/world.js?v=torch1',
  './js/game/player.js',
  './js/game/interaction.js',
  './js/game/interaction.js?v=torch1',
  './js/game/save.js',
  './js/game/crafting.js',
  './js/game/ui.js',
  './js/game/main.js',
  './js/game/mobile-test-main.js?v=pcmobile4',
  './js/game/mobile-test-ui.js?v=pcmobile5',
  './js/game/mobile-test-crafting.js?v=pcmobile4',
  './js/game/mobile-test-textures.js?v=pcmobile4',
  './js/game/mobile-test-player-model.js?v=pcmobile4',
  './js/game/player-model.js',
  './js/game/fluids.js'
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
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = /jsdelivr\.net/.test(url.hostname);
  const appAsset = sameOrigin && (e.request.mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname));

  e.respondWith(
    appAsset
      ? fetch(e.request).then(res => {
          if (res && res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())).catch(() => {});
          return res;
        }).catch(() => caches.match(e.request))
      : caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if (res && res.ok && (sameOrigin || cdn)) {
            caches.open(VERSION).then(c => c.put(e.request, res.clone())).catch(() => {});
          }
          return res;
        }).catch(() => hit))
  );
});
