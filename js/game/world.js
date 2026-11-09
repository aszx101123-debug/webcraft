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
  let matSolid = null, matWater = null, matTorch = null, matPlants = null;
  const lightMap = VoxelLighting.create();
  const daylight = { value: 1 };
  let torchLights = [], torchLightTick = 0;
  const blockChangeListeners = new Set();
  let interestPoints=[];

  const key = (cx, cz) => cx + ',' + cz;

  const FACES = [
    { key: 'side',   n: [1, 0, 0],  shade: .6,  c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [-1, 0, 0], shade: .6,  c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'top',    n: [0, 1, 0],  shade: 1,   c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'bottom', n: [0, -1, 0], shade: .5, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [0, 0, 1],  shade: .8,  c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { key: 'side',   n: [0, 0, -1], shade: .8,  c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }
  ];

  // Sample the two side voxels and diagonal outside each face corner.
  // Compute offsets once; the mesh builder does no per-vertex allocations.
  for (const face of FACES) {
    const axes = face.n[0] ? [1, 2] : face.n[1] ? [0, 2] : [0, 1];
    face.ao = face.c.map(corner => {
      const a = face.n.slice(), b = face.n.slice(), diagonal = face.n.slice();
      a[axes[0]] += corner[axes[0]] * 2 - 1;
      b[axes[1]] += corner[axes[1]] * 2 - 1;
      diagonal[axes[0]] = a[axes[0]];
      diagonal[axes[1]] = b[axes[1]];
      return [a, b, diagonal];
    });
  }
  const AO = [.55, .7, .85, 1];
  function occludes(id) {
    const block = BLOCKS[id];
    return !!block && !block.cutout && !block.liquid && !block.nonSolid && !block.shape;
  }

  function cornerLight(get, x, y, z, offsets) {
    const a = offsets[0], b = offsets[1], c = offsets[2];
    const sideA = +occludes(get(x + a[0], y + a[1], z + a[2]));
    const sideB = +occludes(get(x + b[0], y + b[1], z + b[2]));
    if (sideA && sideB) return AO[0];
    const corner = +occludes(get(x + c[0], y + c[1], z + c[2]));
    return AO[3 - sideA - sideB - corner];
  }

  const BIOME_TINTS = {
    plains: [1, 1, 1], forest: [.9, 1, .88], jungle: [.86, 1.08, .78],
    swamp: [.8, .87, .68], taiga: [.8, .96, 1], snowy: [.85, .97, 1],
    desert: [1.12, .96, .68], highland: [.93, 1, .9],
    savanna:[1.15,.95,.58],badlands:[1.14,.76,.52],cherry:[1.04,.96,1.08],
    bamboo:[.78,1.08,.68],mushroom:[1.02,.8,1.09],volcanic:[.7,.68,.67],
    glacier:[.77,.97,1.12],crystal:[.87,.8,1.15]
  };

  function faceVisible(id, nb) {
    if (nb === -1) return false;
    if (nb === BLOCK.AIR) return true;
    const NB = BLOCKS[nb];
    if (NB.liquid) return !BLOCKS[id].liquid;
    if (NB.cutout) return id !== nb;
    if (NB.nonSolid || NB.shape) return true;
    return false;
  }

  function init(scene, seedNum, editsEntries, generatorVersion = 2) {
    chunks.forEach(disposeChunk);
    chunks = new Map();
    edits = new Map();
    dirtySet = new Set();
    pending = [];
    pendingSet = new Set();
    interestPoints = [];
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
    gen = Terrain.makeGen(seed, generatorVersion);
    if (!matSolid) {
      matSolid = VoxelLighting.material({ map: Textures.getTexture(), vertexColors: true, alphaTest: .5 }, daylight);
      matTorch = new THREE.MeshBasicMaterial({ map: Textures.getTexture(), vertexColors: true, alphaTest: .5 });
      matWater = VoxelLighting.material({
        map: Textures.getTexture(), vertexColors: true, transparent: true,
        opacity: .72, depthWrite: false, side: THREE.DoubleSide
      }, daylight);
      matPlants = VoxelLighting.material({ map: Textures.getTexture(), vertexColors: true, alphaTest: .5, side: THREE.DoubleSide }, daylight);
    }
    if (!torchLights.length) {
      for (let i = 0; i < 4; i++) {
        const light = new THREE.PointLight(0xffaa66, 0.85, 9, 2);
        light.visible = false;
        group.add(light);
        torchLights.push(light);
      }
    }
    scene.add(group);
  }

  function disposeChunk(ch) {
    if (ch.mesh) { group.remove(ch.mesh); ch.mesh.geometry.dispose(); ch.mesh = null; }
    if (ch.waterMesh) { group.remove(ch.waterMesh); ch.waterMesh.geometry.dispose(); ch.waterMesh = null; }
    if (ch.torchMesh) { group.remove(ch.torchMesh); ch.torchMesh.geometry.dispose(); ch.torchMesh = null; }
    if (ch.plantMesh) { group.remove(ch.plantMesh); ch.plantMesh.geometry.dispose(); ch.plantMesh = null; }
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
    const previous = ch.data[li];
    if (previous === id || (id !== BLOCK.AIR && !BLOCKS[id])) return false;
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
    invalidateAt(x, y, z);
    blockChangeListeners.forEach(listener => listener(x,y,z,id,previous,record));
    return true;
  }

  function invalidateAt(x,y,z) {
    const cx=x>>4,cz=z>>4;
    // Sky and torch light can spread up to 15 blocks across a chunk boundary.
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)markDirty(cx+dx,cz+dz);
  }

  function onBlockChanged(listener) {
    if (typeof listener !== 'function') return () => {};
    blockChangeListeners.add(listener);
    return () => blockChangeListeners.delete(listener);
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
    const nearPeer=(cx,cz)=>interestPoints.some(p=>Math.abs(cx-p[0])<=3&&Math.abs(cz-p[1])<=3);
    for (const [k, ch] of chunks) {
      if ((Math.abs(ch.cx - pcx) > limit || Math.abs(ch.cz - pcz) > limit)&&!nearPeer(ch.cx,ch.cz)) {
        disposeChunk(ch);
        chunks.delete(k);
        dirtySet.delete(k);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
          markDirty(ch.cx + dx, ch.cz + dz);
      }
    }
    if (pending.length) {
      pending = pending.filter(p => {
        const far = (Math.abs(p.cx - pcx) > limit || Math.abs(p.cz - pcz) > limit)&&!nearPeer(p.cx,p.cz);
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
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      markDirty(p.cx + dx, p.cz + dz);
    return true;
  }

  function buildChunkMesh(ch) {
    disposeChunk(ch);
    const pos = [], nor = [], uv = [], col = [], ind = [], levels = [];
    const wp = [], wn = [], wu = [], wc = [], wi = [], waterLevels = [];
    const tp = [], tn = [], tu = [], tc = [], ti = [];
    const ox = ch.cx * C, oz = ch.cz * C;
    const biomeTints = Array.from({ length: C * C }, (_, i) =>
      BIOME_TINTS[gen.biomeAt ? gen.biomeAt(ox + (i >> 4), oz + (i & 15)) : 'plains'] || BIOME_TINTS.plains);
    const light = [1, 1, 1, 1];
    ch.torches = [];
    ch.crops=[];
    lightMap.build(ox, oz, (wx, wz) => {
      const neighbor = chunks.get(key(wx >> 4, wz >> 4));
      return neighbor ? { data: neighbor.data, offset: Terrain.idx(wx & 15, 0, wz & 15) } : null;
    });

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
      if(B.crop){ch.crops.push([x,y,z,id]);continue;}
      const liquid = !!B.liquid;
      const torch = id === BLOCK.TORCH;
      const emissive = torch || id === BLOCK.GLOWSTONE || B.emission>0;
      if (emissive) ch.torches.push([ox + x + .5, y + .55, oz + z + .5]);
      if (B.shape) {
        // Multi-box mesh for stairs, half blocks, opened doors and chests.
        // These shapes share the original texture atlas and chunk vertex buffer.
        const shapes=getBlockVisualBoxes(id,BlockFurniture.stateAt(ox+x,y,oz+z));
        for(const box of shapes)for(const face of FACES){
          const n=face.n;
          const onBoundary=(n[0]===1&&box[3]===1)||
            (n[0]===-1&&box[0]===0)||(n[1]===1&&box[4]===1)||
            (n[1]===-1&&box[1]===0)||(n[2]===1&&box[5]===1)||
            (n[2]===-1&&box[2]===0);
          if(onBoundary){
            const nb=getNb(x+n[0],y+n[1],z+n[2]);
            // Stacked cactus sections share a cap; keep their inset sides visible.
            if(id===BLOCK.CACTUS && nb===id && n[1]!==0)continue;
            if(nb>=0 && BLOCKS[nb] && !BLOCKS[nb].shape && isSolidBlock(nb))
              continue;
          }
          const tile=Textures.tileFor(id,face.key);
          const vi=pos.length/3;
          for(let j=0;j<4;j++){
            const corner=face.c[j],u=face.uv[j];
            pos.push(ox+x+box[0]+corner[0]*(box[3]-box[0]),
              y+box[1]+corner[1]*(box[4]-box[1]),
              oz+z+box[2]+corner[2]*(box[5]-box[2]));
            nor.push(n[0],n[1],n[2]);
            uv.push(u[0]?tile.u1:tile.u0,u[1]?tile.v1:tile.v0);
            col.push(face.shade,face.shade,face.shade);
            lightMap.faceLight(levels,x,y,z,n,face.ao[j]);
          }
          ind.push(vi,vi+1,vi+2,vi,vi+2,vi+3);
        }
        continue;
      }

      let liquidHeight = 1;
      if (liquid) {
        const level = id === BLOCK.WATER ? 8 : (fluidLevels.get((ox + x) + ',' + y + ',' + (oz + z)) || 1);
        liquidHeight = BLOCKS[getNb(x, y + 1, z)]?.liquid ? 1 : 0.15 + 0.72 * (level / 8);
      }
      for (const f of FACES) {
        const nb = getNb(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (!torch && !faceVisible(id, nb)) continue;
        const t = Textures.tileFor(id, f.key);
        const P = emissive ? tp : (liquid ? wp : pos), N = emissive ? tn : (liquid ? wn : nor);
        const U = emissive ? tu : (liquid ? wu : uv), CC = emissive ? tc : (liquid ? wc : col), I = emissive ? ti : (liquid ? wi : ind);
        const vi = P.length / 3;
        const tint = (id === BLOCK.GRASS && f.key === 'top') || id === BLOCK.LEAVES ||
          id === BLOCK.BIRCH_LEAVES || id === BLOCK.SPRUCE_LEAVES ? biomeTints[x * C + z] : null;
        for (let i = 0; i < 4; i++) {
          const c = f.c[i];
          let vy = y + c[1];
          if (liquid && c[1] === 1) vy = y + liquidHeight;
          let vx = ox + x + c[0], vz = oz + z + c[2];
          if (torch) {
            vx = ox + x + .40 + c[0] * .20;
            vz = oz + z + .40 + c[2] * .20;
            vy = y + .08 + c[1] * .70;
          }
          P.push(vx, vy, vz);
          N.push(f.n[0], f.n[1], f.n[2]);
          const q = f.uv[i];
          U.push(q[0] ? t.u1 : t.u0, q[1] ? t.v1 : t.v0);
          light[i] = emissive ? 1 : f.shade * (liquid || B.cutout ? 1 : cornerLight(getNb, x, y, z, f.ao[i]));
          const shade = light[i];
          CC.push(shade * (tint ? tint[0] : 1), shade * (tint ? tint[1] : 1), shade * (tint ? tint[2] : 1));
          if (!emissive) lightMap.faceLight(liquid ? waterLevels : levels, x, y, z, f.n, f.ao[i]);
        }
        // Choose the diagonal that avoids a visible crease through the AO gradient.
        if (light[0] + light[2] > light[1] + light[3])
          I.push(vi, vi + 1, vi + 3, vi + 1, vi + 2, vi + 3);
        else I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      }
    }

    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('voxelLight', new THREE.Float32BufferAttribute(levels, 2));
      g.setIndex(ind);
      ch.mesh = new THREE.Mesh(g, matSolid);
      group.add(ch.mesh);
    }
    if (tp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
      g.setIndex(ti);
      ch.torchMesh = new THREE.Mesh(g, matTorch);
      group.add(ch.torchMesh);
    }
    if (wp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(wu, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
      g.setAttribute('voxelLight', new THREE.Float32BufferAttribute(waterLevels, 2));
      g.setIndex(wi);
      ch.waterMesh = new THREE.Mesh(g, matWater);
      ch.waterMesh.renderOrder = 1;
      group.add(ch.waterMesh);
    }
    buildPlants(ch, biomeTints);
  }

  function buildPlants(ch, biomeTints) {
    if (typeof Textures.decorTile !== 'function') return;
    const positions = [], normals = [], uvs = [], colors = [], lights = [], indices = [];
    const ox = ch.cx * C, oz = ch.cz * C;
    const changed = edits.get(key(ch.cx, ch.cz));
    const emit=(cx,baseY,cz,height,tile,tint,brightness)=>{
      for(const direction of [-1,1]){
        const base=positions.length/3;
        for(let i=0;i<4;i++){
          const right=i===1||i===2,top=i>=2;
          positions.push(cx+(right ? .43 : -.43),baseY+(top?height:0),cz+(right ? .43 : -.43)*direction);
          normals.push(-direction*.707,0,.707);
          uvs.push(right?tile.u1:tile.u0,top?tile.v1:tile.v0);
          const shade=top?1:.85;
          colors.push(tint[0]*shade,tint[1]*shade,tint[2]*shade);
          lights.push(brightness[0],brightness[1]);
        }
        indices.push(base,base+1,base+2,base,base+2,base+3);
      }
    };
    for(const [x,y,z,id] of ch.crops||[]){
      const stage=typeof Farming==='undefined'?0:Farming.stageAt(ox+x,y,oz+z);
      const tile=BLOCKS[id].tiles.all;
      emit(ox+x+.5,y-.0625,oz+z+.5,.25+stage*.18,Textures.tileUV(tile[0]+stage,tile[1]),[1,1,1],lightMap.sample(x,y,z));
    }
    for (let x = 0; x < C; x++) for (let z = 0; z < C; z++) {
      const wx = ox + x, wz = oz + z;
      const roll = Noise.hash2(wx, wz, seed + 473);
      if (roll > .3) continue;
      const y = gen.heightAt(wx, wz);
      if(typeof Farming!=='undefined'&&Farming.isForaged(wx,y,wz))continue;
      if (y >= H - 2 || ch.data[Terrain.idx(x,y,z)] !== BLOCK.GRASS ||
          ch.data[Terrain.idx(x,y+1,z)] !== BLOCK.AIR ||
          changed?.has(Terrain.idx(x,y,z)) || changed?.has(Terrain.idx(x,y+1,z))) continue;
      const brightness = lightMap.sample(x,y+1,z);
      if (brightness[0] < 10) continue;
      const biome = gen.biomeAt(wx,wz);
      const kind = roll < .025 && biome === 'plains'
        ? (Noise.hash2(wx,wz,seed+474) < .5 ? 'poppy' : 'daisy')
        : (biome === 'taiga' ? 'fern' : 'grass');
      const tile = Textures.decorTile(kind);
      const tint = kind === 'grass' || kind === 'fern' ? biomeTints[x*C+z] : [1,1,1];
      const jitter = Noise.hash2(wx,wz,seed+475);
      const height = kind === 'grass' ? .55 + jitter * .35 : .8;
      const cx = wx + .35 + jitter * .3, cz = wz + .35 + Noise.hash2(wx,wz,seed+476) * .3;
      emit(cx,y+1,cz,height,tile,tint,brightness);
    }
    if (!positions.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setAttribute('voxelLight',new THREE.Float32BufferAttribute(lights,2));
    geometry.setIndex(indices);
    ch.plantMesh = new THREE.Mesh(geometry,matPlants);
    group.add(ch.plantMesh);
  }

  function updateTorchLights(px, pz) {
    if (!torchLights.length || ++torchLightTick % 20 !== 0) return;
    const py = Player.pos.y + 1;
    const choices = [];
    for (const chunk of chunks.values()) {
      for (const pos of chunk.torches || []) {
        const dx = pos[0] - px, dy = pos[1] - py, dz = pos[2] - pz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < 144) choices.push({ pos, distSq });
      }
    }
    choices.sort((a, b) => a.distSq - b.distSq);
    for (let i = 0; i < torchLights.length; i++) {
      const light = torchLights[i];
      const selected = choices[i];
      light.visible = !!selected;
      if (selected) light.position.set(selected.pos[0], selected.pos[1], selected.pos[2]);
    }
  }

  function update(px, pz, r, genBudget = 2, meshBudget = 4) {
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    ensureArea(pcx, pcz, r);
    for(const [cx,cz] of interestPoints)ensureArea(cx,cz,2);
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
    updateTorchLights(px, pz);
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

  function ensureChunkAt(x,z){
    const cx=x>>4,cz=z>>4,k=key(cx,cz);
    if(chunks.has(k))return;
    const data=gen.genChunk(cx,cz),changed=edits.get(k);
    if(changed)for(const [index,id] of changed)data[index]=id;
    chunks.set(k,{cx,cz,data,mesh:null,waterMesh:null});
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)markDirty(cx+dx,cz+dz);
  }
  function applyRemoteBlock(x,y,z,id){
    if(![x,y,z,id].every(Number.isInteger)||Math.abs(x)>1000000||Math.abs(z)>1000000||y<1||y>=H||
      (id!==0&&!BLOCKS[id]))return false;
    ensureChunkAt(x,z);return setBlock(x,y,z,id);
  }
  function mergeRemoteEdits(entries){
    if(!Array.isArray(entries)||entries.length>169)return;
    for(const entry of entries){
      if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||! /^-?\d+,-?\d+$/.test(entry[0])||!Array.isArray(entry[1])||entry[1].length>16384)continue;
      const [cx,cz]=entry[0].split(',').map(Number);if(Math.abs(cx)>62500||Math.abs(cz)>62500)continue;
      const clean=entry[1].filter(pair=>Array.isArray(pair)&&pair.length===2&&Number.isInteger(pair[0])&&pair[0]>=0&&pair[0]<16384&&Number.isInteger(pair[1])&&(pair[1]===0||BLOCKS[pair[1]]));
      edits.set(entry[0],new Map(clean));const chunk=chunks.get(entry[0]);
      if(chunk){chunk.data=gen.genChunk(cx,cz);for(const [i,id] of clean)chunk.data[i]=id;markDirty(cx,cz);}
      for(const [i,id] of clean)if(id===BLOCK.WATER)waterSources.add((cx*16+((i>>10)&15))+','+(i&63)+','+(cz*16+((i>>6)&15)));
    }
  }

  return {
    init, update, getBlock, setBlock, getChunk, getEdits, onBlockChanged, invalidateAt,
    heightAt: (x, z) => gen ? gen.heightAt(x, z) : 0,
    biomeAt: (x, z) => gen ? gen.biomeAt(x, z) : 'plains',
    pendingCount: () => pending.length,
    dirtyCount: () => dirtySet.size,
    chunkCount: () => chunks.size,
    isReady: () => pending.length === 0 && dirtySet.size === 0,
    getSeed: () => seed,
    setDaylight: value => { daylight.value = .12 + .88 * Math.max(0,Math.min(1,value)); },
    getGroup: () => group,
    getFluidLevel, setFluidLevel, getWaterSources,ensureChunkAt,applyRemoteBlock,mergeRemoteEdits,
    setInterestPoints:points=>{interestPoints=Array.isArray(points)?points.slice(0,3).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z)).map(p=>[Math.floor(p.x)>>4,Math.floor(p.z)>>4]):[];}

  };
})();
