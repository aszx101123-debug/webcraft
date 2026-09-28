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
    elapsed = 0;

    const cx = Math.floor(px);
    const cz = Math.floor(pz);
    const radius = 18;
    const minY = Math.max(1, Math.floor(py) - 18);
    const maxY = Math.min(CONFIG.HEIGHT - 2, Math.floor(py) + 18);

    clearOutside(cx, cz, radius + 4);

    for (const k of [...activeFlows]) {
      const p = k.split(',').map(Number);
      if (p[0] >= cx - radius && p[0] <= cx + radius &&
          p[2] >= cz - radius && p[2] <= cz + radius &&
          p[1] >= minY && p[1] <= maxY) {
        clearFlow(p[0], p[1], p[2]);
      }
    }

    const queue = [];
    const seen = new Set();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    for (const raw of World.getWaterSources()) {
      const p = raw.split(',').map(Number);
      const x = p[0], y = p[1], z = p[2];
      if (x < cx - radius || x > cx + radius || z < cz - radius || z > cz + radius) continue;
      if (y < minY || y > maxY) continue;
      if (World.getBlock(x, y, z) !== BLOCK.WATER) continue;
      queue.push({ x, y, z, level: MAX_LEVEL, horizontal: 0 });
      seen.add(key(x, y, z));
    }

    let processed = 0;
    while (queue.length && processed++ < 420) {
      const node = queue.shift();
      const below = World.getBlock(node.x, node.y - 1, node.z);

      if (below === BLOCK.AIR) {
        const ny = node.y - 1;
        const k = key(node.x, ny, node.z);
        if (!seen.has(k) && putFlow(node.x, ny, node.z, MAX_LEVEL)) {
          seen.add(k);
          queue.push({ x: node.x, y: ny, z: node.z, level: MAX_LEVEL, horizontal: 0 });
        }
        continue;
      }

      if (node.level <= 1 || node.horizontal >= MAX_HORIZONTAL) continue;
      const nextLevel = node.level - 2;
      if (nextLevel <= 0) continue;

      for (const [dx, dz] of dirs) {
        const nx = node.x + dx, nz = node.z + dz, ny = node.y;
        const k = key(nx, ny, nz);
        if (seen.has(k)) continue;
        if (putFlow(nx, ny, nz, nextLevel)) {
          seen.add(k);
          queue.push({ x: nx, y: ny, z: nz, level: nextLevel, horizontal: node.horizontal + 1 });
        }
      }
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
