'use strict';

const Interact = (() => {
  let highlight = null, target = null, camera = null;
  let mining = null;

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
      if (isTargetableBlock(id)) return { x, y, z, id, face };
      if (tmx < tmy && tmx < tmz) { if (tmx > maxDist) return null; x += stepX; tmx += tdx; face = [-stepX, 0, 0]; }
      else if (tmy < tmz) { if (tmy > maxDist) return null; y += stepY; tmy += tdy; face = [0, -stepY, 0]; }
      else { if (tmz > maxDist) return null; z += stepZ; tmz += tdz; face = [0, 0, -stepZ]; }
    }
    return null;
  }

  function sameTarget(a, b) {
    return !!a && !!b && a.x===b.x && a.y===b.y && a.z===b.z && a.id===b.id;
  }

  function update() {
    target = raycast(CONFIG.REACH);
    if (target) {
      highlight.position.set(target.x + .5, target.y + .5, target.z + .5);
      highlight.scale.setScalar(1 + Math.sin(performance.now() * .006) * .006);
      highlight.material.color.setHex(mining ? 0xffd66b : 0xffffff);
      highlight.material.opacity = mining ? .95 : .72;
      highlight.visible = true;
    } else highlight.visible = false;
  }

  function finishBreak(t, survival) {
    if (!t || BLOCKS[t.id].unbreakable) return false;
    const dropId = survival ? getBlockDrop(t.id, Math.random) : 0;
    const ok = World.setBlock(t.x, t.y, t.z, BLOCK.AIR);
    if (!ok) return false;
    if (survival) {
      if (dropId) Drops.spawn(dropId, 1, t.x + .5, t.y + .5, t.z + .5);
      Player.addExhaustion(SURVIVAL.MINE_COST);
      if (getToolDef(t.toolId)) {
        const result = Inventory.damageSelectedTool(1);
        if (result.broken) UI.showToast('도구가 부서졌습니다');
      }
    }
    return true;
  }

  function miningSeconds(t, survival) {
    if (!t) return Infinity;
    if (!survival) return 0;
    const hardness = getBlockHardness(t.id);
    if (!Number.isFinite(hardness)) return Infinity;
    const base = Math.max(.22, hardness * .72 + .14);
    const tool = getMiningToolMultiplier(t.id, t.toolId);
    return base / Math.max(1, tool.speed);
  }

  function beginBreak(survival) {
    if (!target || BLOCKS[target.id].unbreakable) return false;
    const slot = Inventory.selectedSlot();
    const toolId = slot && getToolDef(slot.id) ? slot.id : 0;
    if (!survival) return finishBreak({...target, toolId}, false);
    const tool = getToolDef(toolId);
    if (tool && slot.durability <= 0) {
      Inventory.damageSelectedTool(0);
      return false;
    }
    const requiredTier = getRequiredMiningTier(target.id);
    if (requiredTier > 0 && (!tool || tool.type !== 'pickaxe' || tool.tier < requiredTier)) {
      const names = {1:'나무 곡괭이',2:'돌 곡괭이',3:'철 곡괭이'};
      UI.showToast(names[requiredTier] + '이 필요합니다');
      return false;
    }
    mining = {
      key: target.x + ',' + target.y + ',' + target.z + ',' + target.id,
      target: {...target},
      toolId,
      elapsed: 0,
      duration: miningSeconds({...target, toolId}, true)
    };
    UI.showMiningProgress(0, getItemName(target.id), tool ? getItemName(toolId) : '손');
    return true;
  }

  function cancelBreak() {
    if (!mining) return;
    mining = null;
    UI.hideMiningProgress();
  }

  function updateMining(dt, survival) {
    if (!mining || !survival) return {broken:false};
    if (!target || !sameTarget(target, mining.target)) {
      if (target && !BLOCKS[target.id].unbreakable) {
        const slot = Inventory.selectedSlot();
        const toolId = slot && getToolDef(slot.id) ? slot.id : 0;
        mining = {
          key: target.x + ',' + target.y + ',' + target.z + ',' + target.id,
          target: {...target},
          toolId,
          elapsed: 0,
          duration: miningSeconds({...target, toolId}, true)
        };
        UI.showMiningProgress(0, getItemName(target.id), toolId ? getItemName(toolId) : '손');
      } else cancelBreak();
      return {broken:false};
    }
    const selected = Inventory.selectedSlot();
    const selectedToolId = selected && getToolDef(selected.id) ? selected.id : 0;
    const requiredTier = getRequiredMiningTier(mining.target.id);
    const selectedTool = selected && getToolDef(selected.id) ? getToolDef(selected.id) : null;
    if (requiredTier > 0 && (!selectedTool || selectedTool.type !== 'pickaxe' || selectedTool.tier < requiredTier)) {
      cancelBreak();
      UI.showToast((requiredTier===1?'나무 곡괭이':requiredTier===2?'돌 곡괭이':'철 곡괭이') + '이 필요합니다');
      return {broken:false};
    }
    if (selectedToolId !== mining.toolId) {
      mining.toolId = selectedToolId;
      mining.duration = miningSeconds({...mining.target, toolId:selectedToolId}, true);
      mining.elapsed = 0;
    }
    if (mining.duration === Infinity) {
      UI.showMiningProgress(0, getItemName(mining.target.id), mining.toolId ? getItemName(mining.toolId) : '손');
      return {broken:false,progress:0};
    }
    mining.elapsed += dt;
    const progress = Math.min(1, mining.elapsed / mining.duration);
    UI.showMiningProgress(progress, getItemName(mining.target.id), mining.toolId ? getItemName(mining.toolId) : '손');
    if (progress >= 1) {
      const brokenTarget = {...mining.target, toolId:mining.toolId};
      mining = null;
      UI.hideMiningProgress();
      return {broken:finishBreak(brokenTarget, true), target:brokenTarget};
    }
    return {broken:false,progress};
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

  function isMining() { return !!mining; }
  function miningState() { return mining ? {...mining} : null; }

  return {
    init, update, raycast,
    tryBreak: beginBreak, beginBreak, updateMining, cancelBreak,
    isMining, miningState, getTarget:()=>target, tryPlace, pickBlock
  };
})();
