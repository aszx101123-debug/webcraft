'use strict';

const VERSION = 'webcraft-v1.10.0-public-servers-20261109';
const CORE = [
  "./",
  "./index.html",
  "./en.html",
  "./css/english-home.css?v=v187",
  "./play.html",
  "./multiplayer.html",
  "./servers.html",
  "./js/server-config.js?v=v1100",
  "./js/server-identity.js",
  "./js/public-servers.js?v=v1100",
  "./js/game/dedicated-multiplayer.js?v=v1100",
  "./css/multiplayer.css?v=v1100",
  "./js/multiplayer-lobby.js?v=v190",
  "./js/game/multiplayer-core.js?v=v190",
  "./js/game/multiplayer.js?v=v1100",
  "./js/game/remote-players.js?v=v1100",
  "./js/game/multiplayer-engine.js?v=v1100",
  "./auth.html",
  "./js/auth-play.js?v=v1100",
  "./js/auth-page.js?v=v1100",
  "./js/supabase-client.js",
  "./js/community-credits-server.js?v=v186",
  "./mobile-test.html",
  "./manifest.webmanifest",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/og-image.png",
  "./img/shot-coast.png",
  "./img/shot-forest.png",
  "./img/shot-night.png",
  "./img/classic/pack.json?v=v170",
  "./img/classic/atlas.png?v=v170",
  "./img/classic/water.png?v=v170",
  "./img/classic/landscape.png?v=v160",
  "./css/game.css",
  "./css/biome-guide.css?v=v180",
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
  "./css/classic.css?v=v185",
  "./css/classic-home.css?v=v140",
  "./css/community-credits.css?v=phase3",
  "./pogl-game/vendor/three.min.js",
  "./js/game/config.js?v=v1100",
  "./js/game/classic-settings.js?v=v140",
  "./js/game/furnace-system.js?v=v190",
  "./js/game/noise.js",
  "./js/game/terrain-legacy.js?v=v180",
  "./js/game/terrain.js?v=v183",
  "./js/game/mobile-test-textures.js?v=v185",
  "./js/game/graphics.js?v=v170",
  "./js/game/voxel-lighting.js?v=v170",
  "./js/game/world.js?v=v1100",
  "./js/game/world-journal.js?v=v180",
  "./js/game/world-milestones.js?v=v180",
  "./js/game/block-furniture.js?v=v190",
  "./js/game/block-physics.js?v=v132",
  "./js/game/player.js?v=v187",
  "./js/skin-studio.js?v=v131",
  "./js/game/mobile-test-player-model.js?v=v185",
  "./js/game/fluids.js?v=v129",
  "./js/game/interaction.js?v=v190",
  "./js/game/items.js?v=v170",
  "./js/game/drops.js?v=v190",
  "./js/game/mobs.js?v=v190",
  "./js/game/farming.js?v=v190",
  "./js/game/item-actions.js?v=v190",
  "./js/game/save.js?v=v1100",
  "./js/game/mobile-test-crafting.js?v=v184",
  "./js/game/mobile-test-ui.js?v=v190",
  "./js/game/mobile-test-main.js?v=v1100",
  "./css/style.css",
  "./css/skin-studio.css?v=v131",
  "./css/v133-home.css?v=v133",
  "./js/v133-home.js?v=v133",
  "./js/skin-studio-page.js?v=v131",
  "./js/i18n.js?v=v190"
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
