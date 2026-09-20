'use strict';

const Fluids = (() => {
  let elapsed = 0;
  const activeFlows = new Set();

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
    return id === BLOCK.AIR || id === BLOCK.WATER_FLOW;
  }

  function putFlow(x, y, z, level) {
    if (y < 1 || y >= CONFIG.HEIGHT) return false;
    const id = World.getBlock(x, y, z);
    if (id === BLOCK.WATER) return false;
    if (!isOpen(x, y, z)) return false;
    World.setBlock(x, y, z, BLOCK.WATER_FLOW, false);
    const k = key(x, y, z);
    // Encode level in World's private fluid map through repeated source setter fallback.
    if (typeof World.setFluidLevel === 'function') World.setFluidLevel(x, y, z, level);
    activeFlows.add(k);
    return true;
  }

  function update(px, py, pz, dt) {
    elapsed += dt;
    if (elapsed < .35) return;
    elapsed = 0;

    const cx = Math.floor(px);
    const cz = Math.floor(pz);
    const radius = 16;
    const minY = Math.max(1, Math.floor(py) - 14);
    const maxY = Math.min(CONFIG.HEIGHT - 2, Math.floor(py) + 16);

    clearOutside(cx, cz, radius + 3);
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

    for (let x = cx - radius; x <= cx + radius; x++) {
      for (let z = cz - radius; z <= cz + radius; z++) {
        for (let y = maxY; y >= minY; y--) {
          if (World.getBlock(x, y, z) !== BLOCK.WATER) continue;
          let edge = false;
          for (const [dx, dz] of dirs) {
            const nb = World.getBlock(x + dx, y, z + dz);
            if (nb === BLOCK.AIR || nb === BLOCK.WATER_FLOW) { edge = true; break; }
          }
          if (edge || World.getBlock(x, y - 1, z) === BLOCK.AIR) {
            queue.push({ x, y, z, level: 8 });
            seen.add(key(x, y, z));
          }
        }
      }
    }

    let processed = 0;
    while (queue.length && processed++ < 700) {
      const node = queue.shift();

      if (World.getBlock(node.x, node.y - 1, node.z) === BLOCK.AIR) {
        const ny = node.y - 1;
        const k = key(node.x, ny, node.z);
        if (!seen.has(k) && putFlow(node.x, ny, node.z, 8)) {
          seen.add(k);
          queue.push({ x: node.x, y: ny, z: node.z, level: 8 });
        }
        continue;
      }

      if (node.level <= 1) continue;
      const nextLevel = node.level - 1;
      for (const [dx, dz] of dirs) {
        const nx = node.x + dx, nz = node.z + dz, ny = node.y;
        const k = key(nx, ny, nz);
        if (seen.has(k)) continue;
        if (putFlow(nx, ny, nz, nextLevel)) {
          seen.add(k);
          queue.push({ x: nx, y: ny, z: nz, level: nextLevel });
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