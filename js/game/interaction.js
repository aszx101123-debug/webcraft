'use strict';

const Interact = (() => {
  let highlight = null, target = null, camera = null;
  let mining = false;
  let miningElapsed = 0;
  let miningDuration = 0;
  let miningKey = '';

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

  function targetKey(t) {
    return t ? `${t.x},${t.y},${t.z},${t.id}` : '';
  }

  function resetMining() {
    mining = false;
    miningElapsed = 0;
    miningDuration = 0;
    miningKey = '';
  }

  function update() {
    const next = raycast(CONFIG.REACH);
    if (targetKey(next) !== miningKey && mining) resetMining();
    target = next;
    if (target) {
      highlight.position.set(target.x + .5, target.y + .5, target.z + .5);
      highlight.visible = true;
    } else {
      highlight.visible = false;
      if (mining) resetMining();
    }
  }

  function breakNow(survival) {
    if (!target) return false;
    if (BLOCKS[target.id].unbreakable) return false;
    const tool = survival ? Inventory.selectedTool() : null;
    const dropId = survival ? getBlockDrop(target.id, Math.random, tool) : 0;
    const ok = World.setBlock(target.x, target.y, target.z, BLOCK.AIR);
    if (ok && survival) {
      if (dropId) Drops.spawn(dropId, 1, target.x + .5, target.y + .5, target.z + .5);
      Player.addExhaustion(SURVIVAL.MINE_COST);
      if (tool) Inventory.damageSelectedTool(1);
      UI.renderHotbar();
    }
    return ok;
  }

  function miningTimeFor(targetBlock) {
    const base = Number.isFinite(BLOCKS[targetBlock.id].miningTime) ? Math.max(.05, BLOCKS[targetBlock.id].miningTime) : 1;
    const def = BLOCKS[targetBlock.id];
    const tool = Inventory.selectedTool();
    if (!tool || !def.tool) return base * (def.minTier ? 2.5 : 1.65);
    if (tool.toolType !== def.tool) return base * (def.minTier ? 2.4 : 1.5);
    if (def.minTier !== undefined && tool.tier < def.minTier) return base * 2.2;
    return base / Math.max(1, tool.speed);
  }

  function startBreak(survival) {
    if (!target || BLOCKS[target.id].unbreakable) return false;
    if (!survival) return breakNow(false);
    mining = true;
    miningElapsed = 0;
    miningDuration = miningTimeFor(target);
    miningKey = targetKey(target);
    return true;
  }

  function updateMining(dt, survival) {
    if (!mining || !survival) return false;
    if (!target || targetKey(target) !== miningKey || BLOCKS[target.id].unbreakable) {
      resetMining();
      return false;
    }
    miningElapsed += Math.max(0, dt);
    if (miningElapsed >= miningDuration) {
      const ok = breakNow(true);
      resetMining();
      return ok;
    }
    return false;
  }

  function miningProgress() {
    return mining && miningDuration > 0 ? Math.max(0, Math.min(1, miningElapsed / miningDuration)) : 0;
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

  function getTarget() { return target; }

  return {
    init, update, raycast, getTarget, startBreak, updateMining, miningProgress,
    cancelBreak: resetMining, tryBreak: breakNow, tryPlace, pickBlock
  };
})();
