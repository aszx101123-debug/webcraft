'use strict';

const VERSION = 'webcraft-v1.2.9.1-natural-arms-20261105';
const CORE = [
  "./",
  "./index.html",
  "./play.html",
  "./mobile-test.html",
  "./manifest.webmanifest",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/og-image.png",
  "./img/shot-coast.png",
  "./img/shot-forest.png",
  "./img/shot-night.png",
  "./css/game.css",
  "./css/mobile-test.css?v=v129",
  "./css/v129-polish.css?v=v129",
  "./js/game/config.js?v=arms1291",
  "./js/game/noise.js",
  "./js/game/terrain.js?v=v129",
  "./js/game/mobile-test-textures.js?v=v129",
  "./js/game/world.js?v=torch1",
  "./js/game/player.js?v=v129",
  "./js/game/mobile-test-player-model.js?v=arms1291",
  "./js/game/fluids.js?v=v129",
  "./js/game/interaction.js?v=torch1",
  "./js/game/items.js?v=v129",
  "./js/game/drops.js",
  "./js/game/mobs.js?v=v129",
  "./js/game/save.js?v=v129",
  "./js/game/mobile-test-crafting.js?v=v129",
  "./js/game/mobile-test-ui.js?v=v129",
  "./js/game/mobile-test-main.js?v=arms1291"
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
      .then(keys => Promise.all(keys.filter(k => k.startsWith('webcraft-') && k !== VERSION).map(k => caches.delete(k))))
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
