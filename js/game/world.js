'use strict';

const World = (() => {
  const C = CONFIG.CHUNK, H = CONFIG.HEIGHT;
  const group = new THREE.Group();
  let gen = null, seed = 0;
  let chunks = new Map();
  let edits = new Map();
  let dirtySet = new Set();
  let pending = [];
  let pendingSet = new Set();
  let fluidLevels = new Map();
  let waterSources = new Set();
  let matSolid = null, matWater = null;

  const key = (cx, cz) => cx + ',' + cz;

  const FACES = [
    { key: 'side',   n: [1, 0, 0],  shade: .72, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [-1, 0, 0], shade: .72, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'top',    n: [0, 1, 0],  shade: 1,   c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'bottom', n: [0, -1, 0], shade: .55, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [0, 0, 1],  shade: .85, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [0, 0, -1], shade: .85, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }
  ];

  function faceVisible(id, nb) {
    if (nb === -1) return false;
    if (nb === BLOCK.AIR) return true;
    const NB = BLOCKS[nb];
    if (NB.liquid) return !BLOCKS[id].liquid;
    if (NB.cutout) return id !== nb;
    return false;
  }

  function init(scene, seedNum, editsEntries) {
    chunks.forEach(disposeChunk);
    chunks = new Map();
    edits = new Map();
    dirtySet = new Set();
    pending = [];
    pendingSet = new Set();
    fluidLevels = new Map();
    waterSources = new Set();
    if (editsEntries) {
      for (const [k, list] of editsEntries) {
        const map = new Map(list);
        edits.set(k, map);
        const parts = k.split(',').map(Number);
        const ecx = parts[0], ecz = parts[1];
        for (const [li, id] of map) {
          if (id === BLOCK.WATER) {
            const lx = (li >> 10) & 15, lz = (li >> 6) & 15, y = li & 63;
            waterSources.add(ecx * C + lx + ',' + y + ',' + (ecz * C + lz));
          }
        }
      }
    }
    seed = seedNum;
    gen = Terrain.makeGen(seed);
    if (!matSolid) {
      matSolid = new THREE.MeshLambertMaterial({ map: Textures.getTexture(), vertexColors: true, alphaTest: .5 });
      matWater = new THREE.MeshLambertMaterial({
        map: Textures.getTexture(), vertexColors: true, transparent: true,
        opacity: .72, depthWrite: false, side: THREE.DoubleSide
      });
    }
    scene.add(group);
  }

  function disposeChunk(ch) {
    if (ch.mesh) { group.remove(ch.mesh); ch.mesh.geometry.dispose(); ch.mesh = null; }
    if (ch.waterMesh) { group.remove(ch.waterMesh); ch.waterMesh.geometry.dispose(); ch.waterMesh = null; }
  }

  function getChunk(cx, cz) { return chunks.get(key(cx, cz)); }

  function getBlock(x, y, z) {
    if (y < 0 || y >= H) return BLOCK.AIR;
    const ch = chunks.get(key(x >> 4, z >> 4));
    if (!ch) return BLOCK.AIR;
    return ch.data[Terrain.idx(x & 15, y, z & 15)];
  }

  function markDirty(cx, cz) {
    const k = key(cx, cz);
    if (chunks.has(k)) dirtySet.add(k);
  }

  function setBlock(x, y, z, id, record = true) {
    if (y < 0 || y >= H) return false;
    const cx = x >> 4, cz = z >> 4;
    const ch = chunks.get(key(cx, cz));
    if (!ch) return false;
    const lx = x & 15, lz = z & 15;
    const li = Terrain.idx(lx, y, lz);
    if (ch.data[li] === id) return false;
    const kCell = x + ',' + y + ',' + z;
    if (id === BLOCK.WATER) { fluidLevels.set(kCell, 8); if (record) waterSources.add(kCell); }
    else if (id === BLOCK.WATER_FLOW) {
      if (!fluidLevels.has(kCell)) fluidLevels.set(kCell, 1);
    } else { fluidLevels.delete(kCell); waterSources.delete(kCell); }
    ch.data[li] = id;
    if (record) {
      const k = key(cx, cz);
      if (!edits.has(k)) edits.set(k, new Map());
      edits.get(k).set(li, id);
    }
    markDirty(cx, cz);
    if (lx === 0) markDirty(cx - 1, cz);
    if (lx === 15) markDirty(cx + 1, cz);
    if (lz === 0) markDirty(cx, cz - 1);
    if (lz === 15) markDirty(cx, cz + 1);
    return true;
  }

  function ensureArea(pcx, pcz, r) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const cx = pcx + dx, cz = pcz + dz, k = key(cx, cz);
      if (chunks.has(k) || pendingSet.has(k)) continue;
      pending.push({ cx, cz, d: Math.abs(dx) + Math.abs(dz) });
      pendingSet.add(k);
    }
    pending.sort((a, b) => a.d - b.d);
  }

  function unloadFar(pcx, pcz, r) {
    const limit = r + 1;
    for (const [k, ch] of chunks) {
      if (Math.abs(ch.cx - pcx) > limit || Math.abs(ch.cz - pcz) > limit) {
        disposeChunk(ch);
        chunks.delete(k);
        dirtySet.delete(k);
      }
    }
    if (pending.length) {
      pending = pending.filter(p => {
        const far = Math.abs(p.cx - pcx) > limit || Math.abs(p.cz - pcz) > limit;
        if (far) pendingSet.delete(key(p.cx, p.cz));
        return !far;
      });
    }
  }

  function generateOne() {
    if (!pending.length) return false;
    const p = pending.shift();
    pendingSet.delete(key(p.cx, p.cz));
    const k = key(p.cx, p.cz);
    if (chunks.has(k)) return true;
    const data = gen.genChunk(p.cx, p.cz);
    const e = edits.get(k);
    if (e) for (const [li, id] of e) data[li] = id;
    chunks.set(k, { cx: p.cx, cz: p.cz, data, mesh: null, waterMesh: null });
    markDirty(p.cx, p.cz);
    markDirty(p.cx - 1, p.cz);
    markDirty(p.cx + 1, p.cz);
    markDirty(p.cx, p.cz - 1);
    markDirty(p.cx, p.cz + 1);
    return true;
  }

  function buildChunkMesh(ch) {
    disposeChunk(ch);
    const pos = [], nor = [], uv = [], col = [], ind = [];
    const wp = [], wn = [], wu = [], wc = [], wi = [];
    const ox = ch.cx * C, oz = ch.cz * C;

    function getNb(lx, y, lz) {
      if (y < 0 || y >= H) return BLOCK.AIR;
      if (lx >= 0 && lx < C && lz >= 0 && lz < C) return ch.data[Terrain.idx(lx, y, lz)];
      const wx = ox + lx, wz = oz + lz;
      const n = chunks.get(key(wx >> 4, wz >> 4));
      if (!n) return -1;
      return n.data[Terrain.idx(wx & 15, y, wz & 15)];
    }

    for (let x = 0; x < C; x++) for (let z = 0; z < C; z++) for (let y = 0; y < H; y++) {
      const id = ch.data[Terrain.idx(x, y, z)];
      if (!id) continue;
      const B = BLOCKS[id];
      const liquid = !!B.liquid;
      for (const f of FACES) {
        const nb = getNb(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (!faceVisible(id, nb)) continue;
        const t = Textures.tileFor(id, f.key);
        const P = liquid ? wp : pos, N = liquid ? wn : nor;
        const U = liquid ? wu : uv, CC = liquid ? wc : col, I = liquid ? wi : ind;
        const vi = P.length / 3;
        for (let i = 0; i < 4; i++) {
          const c = f.c[i];
          let vy = y + c[1];
          if (liquid) {
            const level = id === BLOCK.WATER ? 8 : (fluidLevels.get((ox + x) + ',' + y + ',' + (oz + z)) || 1);
            const topY = y + 0.15 + 0.72 * (level / 8);
            if (c[1] === 1) vy = topY;
          }
          P.push(ox + x + c[0], vy, oz + z + c[2]);
          N.push(f.n[0], f.n[1], f.n[2]);
          const q = f.uv[i];
          U.push(q[0] ? t.u1 : t.u0, q[1] ? t.v1 : t.v0);
          CC.push(f.shade, f.shade, f.shade);
        }
        I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      }
    }

    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(ind);
      ch.mesh = new THREE.Mesh(g, matSolid);
      group.add(ch.mesh);
    }
    if (wp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
      g.setIndex(wi);
      ch.waterMesh = new THREE.Mesh(g, matWater);
      ch.waterMesh.renderOrder = 1;
      group.add(ch.waterMesh);
    }
  }

  function update(px, pz, r, genBudget = 2, meshBudget = 4) {
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    ensureArea(pcx, pcz, r);
    unloadFar(pcx, pcz, r);
    for (let i = 0; i < genBudget && pending.length; i++) generateOne();
    if (dirtySet.size) {
      const order = [];
      for (const k of dirtySet) {
        const ch = chunks.get(k);
        if (ch) order.push(ch);
      }
      order.sort((a, b) =>
        (Math.abs(a.cx - pcx) + Math.abs(a.cz - pcz)) - (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)));
      const n = Math.min(meshBudget, order.length);
      for (let i = 0; i < n; i++) {
        buildChunkMesh(order[i]);
        dirtySet.delete(key(order[i].cx, order[i].cz));
      }
    }
  }

  function setFluidLevel(x, y, z, level) {
    fluidLevels.set(x + ',' + y + ',' + z, Math.max(1, Math.min(8, level | 0)));
    markDirty(x >> 4, z >> 4);
  }

  function getWaterSources() { return [...waterSources]; }

  function getFluidLevel(x, y, z) {
    if (World.getBlock(x, y, z) === BLOCK.WATER) return 8;
    return fluidLevels.get(x + ',' + y + ',' + z) || 0;
  }

  function getEdits() {
    const out = [];
    for (const [k, m] of edits) out.push([k, [...m.entries()]]);
    return out;
  }

  return {
    init, update, getBlock, setBlock, getChunk, getEdits,
    heightAt: (x, z) => gen ? gen.heightAt(x, z) : 0,
    pendingCount: () => pending.length,
    dirtyCount: () => dirtySet.size,
    chunkCount: () => chunks.size,
    isReady: () => pending.length === 0 && dirtySet.size === 0,
    getSeed: () => seed,
    getGroup: () => group,
    getFluidLevel, setFluidLevel, getWaterSources

  };
})();
