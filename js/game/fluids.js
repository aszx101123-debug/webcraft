'use strict';

const Fluids = (() => {
  let elapsed = 0;
  const activeFlows = new Set();
  const MAX_LEVEL = 8;
  const MAX_HORIZONTAL = 4;
  const UPDATE_SEC = .28;

  function key(x, y, z) { return x + ',' + y + ',' + z; }

  function clearFlow(x, y, z) {
    if (World.getBlock(x, y, z) === BLOCK.WATER_FLOW) {
      World.setBlock(x, y, z, BLOCK.AIR, false);
    }
    activeFlows.delete(key(x, y, z));
  }

  function clearOutside(cx, cz, radius) {
    for (const k of [...activeFlows]) {
      const p = k.split(',').map(Number);
      if (Math.abs(p[0] - cx) > radius || Math.abs(p[2] - cz) > radius) {
        clearFlow(p[0], p[1], p[2]);
      }
    }
  }

  function isOpen(x, y, z) {
    const id = World.getBlock(x, y, z);
    return id === BLOCK.AIR;
  }

  function putFlow(x, y, z, level) {
    if (y < 1 || y >= CONFIG.HEIGHT) return false;
    if (World.getBlock(x, y, z) !== BLOCK.AIR) return false;
    World.setBlock(x, y, z, BLOCK.WATER_FLOW, false);
    World.setFluidLevel(x, y, z, level);
    activeFlows.add(key(x, y, z));
    return true;
  }

  function update(px, py, pz, dt) {
    elapsed += dt;
    if (elapsed < UPDATE_SEC) return;
    elapsed %= UPDATE_SEC;

    const cx = Math.floor(px), cz = Math.floor(pz);
    const radius = 18;
    const minY = Math.max(1, Math.floor(py) - 18);
    const maxY = Math.min(CONFIG.HEIGHT - 2, Math.floor(py) + 18);
    clearOutside(cx, cz, radius + 4);

    const desired = new Map();
    const seen = new Map();
    const queue = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    function inLoadedArea(x, y, z) {
      return x >= cx - radius && x <= cx + radius &&
        z >= cz - radius && z <= cz + radius &&
        y >= minY && y <= maxY &&
        !!World.getChunk(x >> 4, z >> 4);
    }

    function offer(x, y, z, level, horizontal) {
      if (!inLoadedArea(x, y, z) || queue.length >= 520) return false;
      const id = World.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER_FLOW) return false;
      const k = key(x, y, z);
      if ((seen.get(k) || 0) >= level) return false;
      seen.set(k, level);
      desired.set(k, { x, y, z, level });
      queue.push({ x, y, z, level, horizontal });
      return true;
    }

    for (const raw of World.getWaterSources()) {
      const [x, y, z] = raw.split(',').map(Number);
      if (!inLoadedArea(x, y, z) || World.getBlock(x, y, z) !== BLOCK.WATER) continue;
      const k = key(x, y, z);
      if (seen.has(k)) continue;
      seen.set(k, MAX_LEVEL + 1);
      queue.push({ x, y, z, level: MAX_LEVEL, horizontal: 0 });
    }

    let processed = 0;
    for (let head = 0; head < queue.length && processed++ < 480; head++) {
      const node = queue[head];
      const ny = node.y - 1;
      if (ny >= minY && inLoadedArea(node.x, ny, node.z)) {
        const below = World.getBlock(node.x, ny, node.z);
        if (below === BLOCK.AIR || below === BLOCK.WATER_FLOW) {
          offer(node.x, ny, node.z, MAX_LEVEL, 0);
          continue;
        }
      }
      if (node.level <= 2 || node.horizontal >= MAX_HORIZONTAL) continue;
      const nextLevel = node.level - 2;
      for (const [dx, dz] of dirs)
        offer(node.x + dx, node.y, node.z + dz, nextLevel, node.horizontal + 1);
    }

    // Apply only differences. Stable water no longer disappears and rebuilds every 0.28s.
    for (const k of [...activeFlows]) {
      const [x, y, z] = k.split(',').map(Number);
      if (inLoadedArea(x, y, z) && !desired.has(k)) clearFlow(x, y, z);
    }
    for (const [k, flow] of desired) {
      const id = World.getBlock(flow.x, flow.y, flow.z);
      if (id === BLOCK.AIR) {
        if (World.setBlock(flow.x, flow.y, flow.z, BLOCK.WATER_FLOW, false))
          World.setFluidLevel(flow.x, flow.y, flow.z, flow.level);
      } else if (id === BLOCK.WATER_FLOW) {
        if (World.getFluidLevel(flow.x, flow.y, flow.z) !== flow.level)
          World.setFluidLevel(flow.x, flow.y, flow.z, flow.level);
      }
      if (World.getBlock(flow.x, flow.y, flow.z) === BLOCK.WATER_FLOW)
        activeFlows.add(k);
    }
  }

  function init() {
    reset();
  }

  function reset() {
    for (const k of [...activeFlows]) {
      const p = k.split(',').map(Number);
      clearFlow(p[0], p[1], p[2]);
    }
    activeFlows.clear();
    elapsed = 0;
  }

  return { init, update, reset };
})();
