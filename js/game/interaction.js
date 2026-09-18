'use strict';

const Interact = (() => {
  let highlight = null, target = null, camera = null;

  function init(camera_, scene) {
    camera = camera_;
    highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: .85 })
    );
    highlight.visible = false;
    scene.add(highlight);
  }

  function raycast(maxDist) {
    const o = camera.position;
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tmx = d.x !== 0 ? (d.x > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity;
    let tmy = d.y !== 0 ? (d.y > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity;
    let tmz = d.z !== 0 ? (d.z > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
    let face = null;
    for (let i = 0; i < 160; i++) {
      const id = World.getBlock(x, y, z);
      if (isSolidBlock(id)) return { x, y, z, id, face };
      if (tmx < tmy && tmx < tmz) { if (tmx > maxDist) return null; x += stepX; tmx += tdx; face = [-stepX, 0, 0]; }
      else if (tmy < tmz) { if (tmy > maxDist) return null; y += stepY; tmy += tdy; face = [0, -stepY, 0]; }
      else { if (tmz > maxDist) return null; z += stepZ; tmz += tdz; face = [0, 0, -stepZ]; }
    }
    return null;
  }

  function update() {
    target = raycast(CONFIG.REACH);
    if (target) {
      highlight.position.set(target.x + .5, target.y + .5, target.z + .5);
      highlight.visible = true;
    } else highlight.visible = false;
  }

  function tryBreak(survival) {
    if (!target) return false;
    if (BLOCKS[target.id].unbreakable) return false;
    const dropId = survival ? getBlockDrop(target.id, Math.random) : 0;
    const ok = World.setBlock(target.x, target.y, target.z, BLOCK.AIR);
    if (ok && survival) {
      if (dropId) Drops.spawn(dropId, 1, target.x + .5, target.y + .5, target.z + .5);
      Player.addExhaustion(SURVIVAL.MINE_COST);
    }
    return ok;
  }

  function overlapsPlayer(px, py, pz) {
    const p = Player.pos;
    const HW = .3 + 1e-3, PH = 1.8;
    return px + 1 > p.x - HW && px < p.x + HW &&
           py + 1 > p.y && py < p.y + PH &&
           pz + 1 > p.z - HW && pz < p.z + HW;
  }

  function tryPlace(blockId) {
    if (!target || !target.face || !isPlaceable(blockId)) return false;
    const px = target.x + target.face[0];
    const py = target.y + target.face[1];
    const pz = target.z + target.face[2];
    const cur = World.getBlock(px, py, pz);
    if (cur !== BLOCK.AIR && cur !== BLOCK.WATER) return false;
    if (isSolidBlock(blockId) && overlapsPlayer(px, py, pz)) return false;
    return World.setBlock(px, py, pz, blockId);
  }

  function pickBlock() {
    if (!target || !isPlaceable(target.id)) return null;
    return target.id;
  }

  return { init, update, raycast, tryBreak, tryPlace, pickBlock };
})();
