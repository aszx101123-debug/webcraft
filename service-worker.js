'use strict';

const VERSION = 'webcraft-v1.4.0-community-20261107-c';
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
  "./css/v130-character.css?v=v131",
  "./css/v132-blocks.css?v=v132",
  "./css/v133-build.css?v=v133",
  "./css/v134-combat.css?v=v134",
  "./css/v135-adventure.css?v=v135",
  "./css/v136-progress.css?v=v136",
  "./css/v137-inventory.css?v=v137",
  "./css/v137-touch.css?v=v137",
  "./css/classic-furnace.css?v=v140",
  "./css/classic.css?v=v140",
  "./css/classic-home.css?v=v140",
  "./css/community-credits.css?v=phase3",
  "./pogl-game/vendor/three.min.js",
  "./js/game/config.js?v=v140",
  "./js/game/classic-settings.js?v=v140",
  "./js/game/furnace-system.js?v=v140",
  "./js/game/noise.js",
  "./js/game/terrain.js?v=v132",
  "./js/game/mobile-test-textures.js?v=v133",
  "./js/game/world.js?v=v135",
  "./js/game/world-journal.js?v=v136",
  "./js/game/world-milestones.js?v=v136",
  "./js/game/block-furniture.js?v=v133",
  "./js/game/block-physics.js?v=v132",
  "./js/game/player.js?v=v140",
  "./js/skin-studio.js?v=v131",
  "./js/game/mobile-test-player-model.js?v=v131",
  "./js/game/fluids.js?v=v129",
  "./js/game/interaction.js?v=v140",
  "./js/game/items.js?v=v140",
  "./js/game/drops.js",
  "./js/game/mobs.js?v=v140",
  "./js/game/save.js?v=v129",
  "./js/game/mobile-test-crafting.js?v=v137",
  "./js/game/mobile-test-ui.js?v=v140",
  "./js/game/mobile-test-main.js?v=v140",
  "./css/style.css",
  "./css/skin-studio.css?v=v131",
  "./css/v133-home.css?v=v133",
  "./js/v133-home.js?v=v133",
  "./js/skin-studio-page.js?v=v131",
  "./js/community-credits.js?v=phase2",
  "./js/community-credits-sandbox.js?v=phase2",
  "./js/community-credits-server.js?v=phase3",
  "./js/wc-backend-config.js",
  "./js/i18n.js?v=20261107-community3"
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
