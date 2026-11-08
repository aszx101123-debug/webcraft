import { supabase } from "./supabase-client.js";
const notice = document.createElement("div");
notice.setAttribute("role", "status");
notice.style.cssText = "position:fixed;inset:0;z-index:999999;background:#101a20;color:white;display:grid;place-items:center;font:20px sans-serif";
notice.textContent = "로그인 확인 중...";
document.body.appendChild(notice);
try {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    location.replace("auth.html?next=play.html");
  } else {
    const sources = [
      "pogl-game/vendor/three.min.js",
      "js/game/config.js?v=v160",
      "js/game/classic-settings.js?v=v140",
      "js/game/noise.js",
      "js/game/terrain.js?v=v132",
      "js/game/mobile-test-textures.js?v=v160",
      "js/game/graphics.js?v=v160",
      "js/game/voxel-lighting.js?v=v160",
      "js/game/world.js?v=v160",
      "js/game/world-journal.js?v=v136",
      "js/game/world-milestones.js?v=v136",
      "js/game/block-furniture.js?v=v133",
      "js/game/block-physics.js?v=v132",
      "js/game/player.js?v=v140",
      "js/skin-studio.js?v=v131",
      "js/game/mobile-test-player-model.js?v=v150",
      "js/game/fluids.js?v=v129",
      "js/game/interaction.js?v=v140",
      "js/game/items.js?v=v140",
      "js/game/furnace-system.js?v=v140",
      "js/game/drops.js",
      "js/game/mobs.js?v=v150",
      "js/game/save.js?v=v129",
      "js/game/mobile-test-crafting.js?v=v137",
      "js/game/mobile-test-ui.js?v=v140",
      "js/game/mobile-test-main.js?v=v160"
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
  }
} catch (error) {
  notice.textContent = "인증 또는 게임 실행 오류: " + error.message;
}
