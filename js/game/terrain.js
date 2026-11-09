'use strict';

const Terrain = (() => {
  const C = CONFIG.CHUNK, H = CONFIG.HEIGHT, SEA = CONFIG.SEA;

  function idx(x, y, z) {
    return (x << 10) | (z << 6) | y;
  }

  function makeGen(seed, generatorVersion = 2) {
    if (generatorVersion === 1 && typeof LegacyTerrain !== 'undefined') return LegacyTerrain.makeGen(seed);
    const REGION_SIZE = 160;
    const biomeEntries = Object.entries(BIOMES);
    const cellCache = new Map();
    const stretch = (v, k) => Math.max(0, Math.min(1, (v - .5) * k + .5));
    const smooth = v => v * v * (3 - 2 * v);
    const profiles = {
      plains: [-3,.65], forest: [0,1], jungle: [1,1.1], swamp: [-6,.55],
      taiga: [2,1], snowy: [8,1.2], desert: [-2,.65], highland: [10,1.45],
      savanna: [-2,.75], badlands: [7,1.15], cherry: [2,.7], bamboo: [0,.85],
      mushroom: [2,.7], volcanic: [10,1.6], glacier: [9,.8], crystal: [7,1.2]
    };

    // A uniform hash chooses each region independently using the published weights.
    // Jittered region centers produce broad, irregular borders rather than checkerboards.
    function regionCell(gx, gz) {
      const key = gx + ',' + gz;
      let cell = cellCache.get(key);
      if (cell) return cell;
      let roll = Noise.hash2(gx, gz, seed + 4201) * 100;
      let biome = biomeEntries[biomeEntries.length - 1][0];
      for (const [id, def] of biomeEntries) {
        roll -= def.chance;
        if (roll < 0) { biome = id; break; }
      }
      cell = Object.freeze({biome, x:gx, z:gz,
        centerX:(gx + .25 + Noise.hash2(gx,gz,seed+4202)*.5)*REGION_SIZE,
        centerZ:(gz + .25 + Noise.hash2(gx,gz,seed+4203)*.5)*REGION_SIZE});
      if (cellCache.size >= 4096) cellCache.delete(cellCache.keys().next().value);
      cellCache.set(key, cell);
      return cell;
    }

    function regionAt(x, z) {
      const gx = Math.floor(x / REGION_SIZE), gz = Math.floor(z / REGION_SIZE);
      let nearest = null, distance = Infinity;
      for (let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) {
        const cell = regionCell(gx+dx,gz+dz);
        const d = (x-cell.centerX)**2 + (z-cell.centerZ)**2;
        if (d < distance) { distance = d; nearest = cell; }
      }
      return nearest;
    }

    // Height profiles interpolate across grid centers. Unlike an abrupt biome offset,
    // this remains continuous at region and chunk borders, including negative coordinates.
    function heightProfile(x, z) {
      const fx=x/REGION_SIZE-.5, fz=z/REGION_SIZE-.5;
      const gx=Math.floor(fx),gz=Math.floor(fz),tx=smooth(fx-gx),tz=smooth(fz-gz);
      let offset=0,roughness=0,terraces=0;
      for(let dx=0;dx<=1;dx++)for(let dz=0;dz<=1;dz++) {
        const id=regionCell(gx+dx,gz+dz).biome;
        const weight=(dx?tx:1-tx)*(dz?tz:1-tz);
        offset+=profiles[id][0]*weight;roughness+=profiles[id][1]*weight;
        if(id==='badlands')terraces+=weight;
      }
      return {offset,roughness,terraces};
    }

    function heightAt(x, z) {
      const profile=heightProfile(x,z);
      const base = stretch(Noise.fbm2(x * .0075, z * .0075, seed, 4), 1.8);
      const detail = stretch(Noise.fbm2(x * .02 + 500, z * .02 - 500, seed + 7, 3), 1.6);
      let h = 17 + base * 26 + (detail-.5) * 6 * profile.roughness + profile.offset;
      const m = stretch(Noise.fbm2(x * .004 + 123, z * .004 + 321, seed + 13, 3), 1.8);
      if (m > .52) h += (m - .52) * 70 * profile.roughness;
      h += Math.sin(h*.8)*1.3*profile.terraces;
      if (h > 50) h = 50 + (h - 50) * .55;
      return Math.max(4, Math.min(56, Math.round(h)));
    }

    function forestAt(x, z) {
      return Noise.fbm2(x * .01 + 777, z * .01 - 777, seed + 29, 2);
    }

    function biomeAt(x, z) {
      return regionAt(x,z).biome;
    }

    function genChunk(cx, cz) {
      const data = new Uint8Array(C * C * H);
      const heights = new Int16Array(C * C);
      const biomes = new Array(C * C);
      for (let x = 0; x < C; x++) for (let z = 0; z < C; z++) {
        const wx = cx * C + x, wz = cz * C + z;
        const h = heightAt(wx, wz);
        heights[x * C + z] = h;
        const biome = biomeAt(wx, wz);
        biomes[x*C+z]=biome;
        const def=BIOMES[biome];
        const shore=h<=SEA+1 && !['glacier','volcanic','crystal'].includes(biome);
        const shoreRoll=Noise.hash2(wx,wz,seed+801);
        const shoreBlock=(h<=SEA+2&&biome!=='desert')
          ? (shoreRoll<.11?BLOCK.CLAY:shoreRoll<.29?BLOCK.GRAVEL:BLOCK.SAND)
          : (def.surface || BLOCK.SAND);
        for (let y = 0; y < H; y++) {
          let id = BLOCK.AIR;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y <= h) {
            if (y === h) id = shore ? shoreBlock : def.surface;
            else if (y >= h - 3) id = shore ? shoreBlock : def.subsurface;
            else if (biome==='desert' && y >= h-6) id = BLOCK.SANDSTONE;
            else if (biome==='badlands' && y >= h-8) id = y%4===0 ? BLOCK.RED_SAND : BLOCK.TERRACOTTA;
            else if (biome==='volcanic' && y >= h-6) id = BLOCK.BASALT;
            else if (biome==='glacier' && y >= h-5) id = BLOCK.ICE;
            else id = BLOCK.STONE;
            if (h > SEA + 2 && y >= 3 && y <= h - 4) {
              const cheese = Noise.noise3(wx * .026, y * .042, wz * .026, seed + 41);
              const spaghetti = Math.abs(Noise.noise2(wx * .016 + y * .031, wz * .016 - y * .027, seed + 77) - .5);
              const noodle = Math.abs(Noise.noise3(wx * .072, y * .11, wz * .072, seed + 113) - .5);
              const largeRoom = cheese > .78 || (cheese > .72 && spaghetti < .075);
              const tunnel = spaghetti < .055 || noodle < .045;
              if (largeRoom || tunnel) {
                const flooded = y <= SEA - 3 && Noise.noise3(wx * .09, y * .09, wz * .09, seed + 301) > .78;
                id = flooded ? BLOCK.WATER : BLOCK.AIR;
              }
            }
          } else if (y <= SEA) id = biome==='glacier' && y===SEA ? BLOCK.ICE : BLOCK.WATER;
          if (id) data[idx(x, y, z)] = id;
        }
      }
      // v1.2.5 ore pass: sparse, vertically targeted bands adapted to WebCraft's 0-63 height.
      const oreDefs = [
        { id: BLOCK.COAL_ORE, minY: 27, maxY: 56, veins: 3, size: 4 },
        { id: BLOCK.IRON_ORE, minY: 10, maxY: 34, veins: 3, size: 4 },
        { id: BLOCK.IRON_ORE, minY: 45, maxY: 58, veins: 1, size: 3 },
        { id: BLOCK.COPPER_ORE, minY: 18, maxY: 43, veins: 2, size: 3 },
        { id: BLOCK.GOLD_ORE, minY: 7, maxY: 20, veins: 1, size: 3 },
        { id: BLOCK.LAPIS_ORE, minY: 8, maxY: 18, veins: 1, size: 2 },
        { id: BLOCK.REDSTONE_ORE, minY: 3, maxY: 12, veins: 1, size: 3 },
        { id: BLOCK.DIAMOND_ORE, minY: 2, maxY: 8, veins: 1, size: 2 },
        { id: BLOCK.EMERALD_ORE, minY: 40, maxY: 54, veins: 1, size: 1 }
      ];
      const oreRng = Noise.mulberry32(Math.floor(Noise.hash2(cx + 91, cz - 47, seed + 1901) * 4294967296));
      // 드물게 더 길게 이어지는 대형 철/구리 광맥을 추가한다.
      const largeVeinChance = oreRng();
      if (largeVeinChance < .035) {
        const large = largeVeinChance < .0175
          ? { id: BLOCK.IRON_ORE, minY: 10, maxY: 31, length: 8 }
          : { id: BLOCK.COPPER_ORE, minY: 14, maxY: 40, length: 7 };
        let x = 2 + Math.floor(oreRng() * 12);
        let y = large.minY + Math.floor(oreRng() * (large.maxY - large.minY + 1));
        let z = 2 + Math.floor(oreRng() * 12);
        for (let step = 0; step < large.length; step++) {
          const radius = oreRng() < .7 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -radius; dz <= radius; dz++) {
            if (dx * dx + dz * dz > radius * radius + 1) continue;
            const lx = x + dx, ly = y + dy, lz = z + dz;
            if (lx < 0 || lx >= C || lz < 0 || lz >= C || ly < large.minY || ly > large.maxY) continue;
            const i = idx(lx, ly, lz);
            if (data[i] === BLOCK.STONE) data[i] = large.id;
          }
          x = Math.max(1, Math.min(14, x + (oreRng() < .5 ? -1 : 1)));
          y = Math.max(large.minY, Math.min(large.maxY, y + (oreRng() < .55 ? -1 : 1)));
          z = Math.max(1, Math.min(14, z + (oreRng() < .5 ? -1 : 1)));
        }
      }

      for (const ore of oreDefs) {
        for (let vein = 0; vein < ore.veins; vein++) {
          const ox = 1 + Math.floor(oreRng() * 14);
          const oz = 1 + Math.floor(oreRng() * 14);
          const oy = ore.minY + Math.floor(oreRng() * (ore.maxY - ore.minY + 1));
          const steps = Math.max(2, ore.size - 2 + Math.floor(oreRng() * 4));
          let x = ox, y = oy, z = oz;
          for (let s = 0; s < steps; s++) {
            const rr = oreRng() < .72 ? 1 : 2;
            for (let dx = -rr; dx <= rr; dx++) for (let dy = -rr; dy <= rr; dy++) for (let dz = -rr; dz <= rr; dz++) {
              if (dx * dx + dy * dy + dz * dz > rr * rr + 1) continue;
              const lx = x + dx, ly = y + dy, lz = z + dz;
              if (lx < 0 || lx >= C || lz < 0 || lz >= C || ly < ore.minY || ly > ore.maxY) continue;
              const i = idx(lx, ly, lz);
              if (data[i] !== BLOCK.STONE) continue;
              if (ore.id === BLOCK.EMERALD_ORE && heightAt(cx * C + lx, cz * C + lz) < 40) continue;
              const exposed = [
                [lx + 1, ly, lz], [lx - 1, ly, lz], [lx, ly + 1, lz],
                [lx, ly - 1, lz], [lx, ly, lz + 1], [lx, ly, lz - 1]
              ].some(([ax, ay, az]) => ax >= 0 && ax < C && ay >= 0 && ay < H && az >= 0 && az < C &&
                (data[idx(ax, ay, az)] === BLOCK.AIR || data[idx(ax, ay, az)] === BLOCK.WATER));
              if (exposed && ore.id !== BLOCK.COAL_ORE && ore.id !== BLOCK.IRON_ORE) continue;
              data[i] = ore.id;
            }
            x = Math.max(1, Math.min(14, x + (oreRng() < .5 ? -1 : 1)));
            y = Math.max(ore.minY, Math.min(ore.maxY, y + (oreRng() < .5 ? -1 : oreRng() < .75 ? 0 : 1)));
            z = Math.max(1, Math.min(14, z + (oreRng() < .5 ? -1 : 1)));
          }
        }
      }

      const rng = Noise.mulberry32(Math.floor(Noise.hash2(cx, cz, seed) * 4294967296));
      for (let t = 0; t < 9; t++) {
        const tx = 2 + Math.floor(rng() * 12);
        const tz = 2 + Math.floor(rng() * 12);
        const h = heights[tx * C + tz];
        const localBiome = biomes[tx*C+tz],def=BIOMES[localBiome];
        const density = def.treeDensity * (.65 + forestAt(cx*C+tx,cz*C+tz)*.7);
        if (rng() >= density || h <= SEA + 1 || h > 52) continue;
        const ground=data[idx(tx,h,tz)];
        if (ground!==BLOCK.GRASS && !(localBiome==='taiga' && ground===BLOCK.SNOW)) continue;
        const th = localBiome === 'jungle' ? 6 + Math.floor(rng() * 3)
          : localBiome === 'taiga' ? 6 + Math.floor(rng() * 2)
          : localBiome === 'savanna' ? 3 : 4 + Math.floor(rng() * 2);
        if (h + th + 1 >= H || data[idx(tx,h+1,tz)]!==BLOCK.AIR) continue;
        const isSpruce=localBiome==='taiga';
        const isBirch=localBiome==='forest' && rng()<.48;
        const trunkId=isSpruce?BLOCK.SPRUCE_LOG:isBirch?BLOCK.BIRCH_LOG:BLOCK.LOG;
        const leafId=localBiome==='cherry'?BLOCK.CHERRY_LEAVES:
          isSpruce?BLOCK.SPRUCE_LEAVES:isBirch?BLOCK.BIRCH_LEAVES:BLOCK.LEAVES;
        for (let y = 1; y <= th; y++) data[idx(tx, h + y, tz)] = trunkId;
        const leaf = (lx, ly, lz) => {
          if (lx < 0 || lx >= C || lz < 0 || lz >= C || ly < 1 || ly >= H) return;
          const index = idx(lx, ly, lz);
          if (data[index] === BLOCK.AIR) data[index] = leafId;
        };
        if (localBiome === 'taiga') {
          for (let dy = th - 4; dy <= th + 1; dy++) {
            const radius = dy >= th + 1 ? 0 : dy >= th - 1 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++)
              for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                leaf(tx + dx, h + dy, tz + dz);
              }
          }
        } else {
          const crownStart = th - (localBiome === 'jungle' ? 3 : localBiome==='savanna'?1:2);
          for (let dy = crownStart; dy <= th - 1; dy++) {
            for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && rng() < .65) continue;
              leaf(tx + dx, h + dy, tz + dz);
            }
          }
          for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
            leaf(tx + dx, h + th, tz + dz);
          if(localBiome!=='savanna') {
            leaf(tx, h + th + 1, tz);leaf(tx + 1, h + th + 1, tz);
            leaf(tx - 1, h + th + 1, tz);leaf(tx, h + th + 1, tz + 1);leaf(tx, h + th + 1, tz - 1);
          }
        }
      }
      const centerBiome=biomeAt(cx*C+8,cz*C+8);

      // Sparse upright cacti in dry biomes; no random stone towers or ruins.
      if (centerBiome==='desert') {
        for(let p=0;p<3;p++){
          const tx=2+Math.floor(rng()*12),tz=2+Math.floor(rng()*12);
          const h=heights[tx*C+tz];
          if(h<=SEA+2||h>=H-5||biomeAt(cx*C+tx,cz*C+tz)!=='desert')continue;
          if(data[idx(tx,h,tz)]!==BLOCK.SAND)continue;
          if(rng()>.52)continue;
          const height=2+Math.floor(rng()*2);
          for(let y=1;y<=height;y++){
            if(data[idx(tx,h+y,tz)]!==BLOCK.AIR)break;
            data[idx(tx,h+y,tz)]=BLOCK.CACTUS;
          }
        }
      }

      // Biome-specific vegetation, exposed crystals, and harvestable resource nodes.
      // Coordinate hashes make these independent of chunk generation order.
      for(let x=0;x<C;x++)for(let z=0;z<C;z++) {
        const wx=cx*C+x,wz=cz*C+z,h=heights[x*C+z],biome=biomes[x*C+z];
        if(h<SEA || h>=H-6 || data[idx(x,h+1,z)]!==BLOCK.AIR)continue;
        const roll=Noise.hash2(wx,wz,seed+4601);
        // Winter-region surface detail. Keep generated terrain deterministic and
        // place decorations only in free space, without changing existing save edits.
        if(biome==='snowy' && data[idx(x,h,z)]===BLOCK.SNOW) {
          // Drifted snow on exposed ridges and occasional naturally frozen outcrops.
          if(roll<.045 && h>SEA+5 && h<H-4) {
            const layer=1+(Noise.hash2(wx,wz,seed+6812)<.23?1:0);
            for(let dy=1;dy<=layer;dy++){
              if(data[idx(x,h+dy,z)]!==BLOCK.AIR)break;
              data[idx(x,h+dy,z)]=BLOCK.SNOW;
            }
          }else if(roll>.986 && h>SEA+6 && data[idx(x,h+1,z)]===BLOCK.AIR) {
            data[idx(x,h+1,z)]=BLOCK.ICE;
          }
        }else if(biome==='glacier' && data[idx(x,h,z)]===BLOCK.ICE && h>SEA+2) {
          // Small ice pinnacles, far enough apart to preserve passable routes.
          if(roll<.014 && x>2 && x<C-3 && z>2 && z<C-3 && h<H-8) {
            const peak=2+Math.floor(Noise.hash2(wx,wz,seed+6813)*4);
            for(let dy=1;dy<=peak;dy++){
              if(data[idx(x,h+dy,z)]!==BLOCK.AIR)break;
              data[idx(x,h+dy,z)]=BLOCK.ICE;
            }
            if(data[idx(x+1,h+1,z)]===BLOCK.AIR && Noise.hash2(wx,wz,seed+6814)>.55)
              data[idx(x+1,h+1,z)]=BLOCK.ICE;
          }else if(roll>.966 && roll<.974 && h<H-3) {
            if(data[idx(x,h+1,z)]===BLOCK.AIR)data[idx(x,h+1,z)]=BLOCK.SNOW;
          }
        }
        if(biome==='bamboo' && roll<.055) {
          const height=2+Math.floor(Noise.hash2(wx,wz,seed+4602)*4);
          for(let y=1;y<=height;y++)if(data[idx(x,h+y,z)]===BLOCK.AIR)data[idx(x,h+y,z)]=BLOCK.BAMBOO;
        } else if(biome==='crystal' && roll<.012) {
          const height=1+Math.floor(Noise.hash2(wx,wz,seed+4603)*3);
          for(let y=1;y<=height;y++)if(data[idx(x,h+y,z)]===BLOCK.AIR)data[idx(x,h+y,z)]=BLOCK.CRYSTAL_BLOCK;
        }
        if(data[idx(x,h+1,z)]===BLOCK.AIR && data[idx(x,h+2,z)]===BLOCK.AIR && Noise.hash2(wx,wz,seed+4611)<.024)
          data[idx(x,h+1,z)]=BIOMES[biome].resource;
      }
      return data;
    }

    return { seed, generatorVersion:2, heightAt, forestAt, biomeAt, regionAt, genChunk };
  }

  return { makeGen, idx };
})();
