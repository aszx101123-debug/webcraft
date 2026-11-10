// Retain this loader URL for older entry pages; playing needs no auth SDK or session.
const notice = document.createElement("div");
notice.setAttribute("role", "status");
notice.style.cssText = "position:fixed;inset:0;z-index:999999;background:#101a20;color:white;display:grid;place-items:center;font:20px sans-serif";
notice.textContent = "게임을 준비하고 있습니다…";
document.body.appendChild(notice);
try {
  const sources = [
    "pogl-game/vendor/three.min.js",
    "js/game/config.js?v=v193",
    "js/game/classic-settings.js?v=v193",
    "js/game/noise.js",
    "js/game/terrain-legacy.js?v=v180",
    "js/game/terrain.js?v=v191",
    "js/game/mobile-test-textures.js?v=v185",
    "js/game/graphics.js?v=v170",
    "js/game/voxel-lighting.js?v=v170",
    "js/game/world.js?v=v191",
    "js/game/world-journal.js?v=v180",
    "js/game/world-milestones.js?v=v180",
    "js/game/block-furniture.js?v=v190",
    "js/game/block-physics.js?v=v132",
    "js/game/player.js?v=v193",
    "js/skin-studio.js?v=v131",
    "js/game/mobile-test-player-model.js?v=v193",
    "js/game/fluids.js?v=v129",
    "js/game/interaction.js?v=v190",
    "js/game/items.js?v=v170",
    "js/game/furnace-system.js?v=v190",
    "js/game/drops.js?v=v190",
    "js/game/mobs.js?v=v191",
    "js/game/farming.js?v=v190",
    "js/game/item-actions.js?v=v190",
    "js/game/save.js?v=v190",
    "js/game/mobile-test-crafting.js?v=v184",
    "js/game/mobile-test-ui.js?v=v192",
    "js/game/pause-menu.js?v=v192",
    "js/game/multiplayer-core.js?v=v190",
    "js/game/multiplayer.js?v=v190",
    "js/game/remote-players.js?v=v190",
    "js/game/multiplayer-engine.js?v=v190",
    "js/game/mobile-test-main.js?v=v193"
  ];
  for (const src of sources) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("게임 파일 로딩 실패: " + src));
      document.body.appendChild(script);
    });
  }
  await window.webcraftBoot;
  notice.remove();
} catch (error) {
  notice.textContent = "게임 파일을 불러오지 못했습니다. " + error.message;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '다시 불러오기';
  retry.addEventListener('click', () => location.reload());
  notice.appendChild(retry);
}
