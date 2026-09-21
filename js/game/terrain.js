'use strict';

const Terrain = (() => {
  const C = CONFIG.CHUNK, H = CONFIG.HEIGHT, SEA = CONFIG.SEA;

  function idx(x, y, z) {
    return (x << 10) | (z << 6) | y;
  }

  function makeGen(seed) {

    const stretch = (v, k) => Math.max(0, Math.min(1, (v - .5) * k + .5));

    function heightAt(x, z) {
      const base = stretch(Noise.fbm2(x * .0075, z * .0075, seed, 4), 1.8);
      const detail = stretch(Noise.fbm2(x * .02 + 500, z * .02 - 500, seed + 7, 3), 1.6);
      let h = 14 + base * 26 + detail * 6;
      const m = stretch(Noise.fbm2(x * .004 + 123, z * .004 + 321, seed + 13, 3), 1.8);
      if (m > .52) h += (m - .52) * 70;
      if (h > 50) h = 50 + (h - 50) * .55;
      return Math.max(4, Math.min(56, Math.round(h)));
    }

    function forestAt(x, z) {
      return Noise.fbm2(x * .01 + 777, z * .01 - 777, seed + 29, 2);
    }

    function biomeAt(x, z) {
      const h = heightAt(x, z);
      const temp = Noise.fbm2(x * .0018 + 900, z * .0018 - 900, seed + 101, 3);
      const moisture = Noise.fbm2(x * .0022 - 1200, z * .0022 + 300, seed + 202, 3);
      if(h>=45&&temp<.58)return'snowy';if(h<SEA+2&&temp>.72&&moisture<.5)return'desert';if(temp>.68&&moisture>.68)return'jungle';if(moisture>.78&&h<SEA+5)return'swamp';if(temp<.38&&moisture>.48)return'taiga';if(moisture>.64)return'forest';
      if (h >= 42) return 'highland';
      return 'plains';
    }

    function genChunk(cx, cz) {
      const data = new Uint8Array(C * C * H);
      const heights = new Int16Array(C * C);
      for (let x = 0; x < C; x++) for (let z = 0; z < C; z++) {
        const wx = cx * C + x, wz = cz * C + z;
        const h = heightAt(wx, wz);
        heights[x * C + z] = h;
        const biome = biomeAt(wx, wz);
        const sandy=h<=SEA+1||biome==='desert'||biome==='swamp';const snowy=biome==='snowy'||biome==='taiga';
        for (let y = 0; y < H; y++) {
          let id = BLOCK.AIR;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y <= h) {
            if (y === h) id = sandy ? BLOCK.SAND : (snowy ? BLOCK.SNOW : BLOCK.GRASS);
            else if (y >= h - 3) id = sandy ? BLOCK.SAND : BLOCK.DIRT;
            else id = BLOCK.STONE;
            if (h > SEA + 2 && y >= 3 && y <= h - 2) {
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
          } else if (y <= SEA) id = BLOCK.WATER;
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
        const large = largeVeinChance < .11
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

      const f = stretch(forestAt(cx * C + 8, cz * C + 8), 1.9);
      const centerBiome=biomeAt(cx*C+8,cz*C+8);let treeChance=f;if(centerBiome==='jungle')treeChance=Math.min(1,treeChance*1.9+.25);if(centerBiome==='taiga')treeChance=Math.min(1,treeChance*1.35+.1);if(centerBiome==='swamp')treeChance=Math.min(1,treeChance*1.15);if(centerBiome==='desert'||centerBiome==='snowy')treeChance*=.35;
      const count = Math.min(4, Math.floor(Math.max(0, treeChance - .5) * 12));
      const rng = Noise.mulberry32(Math.floor(Noise.hash2(cx, cz, seed) * 4294967296));
      for (let t = 0; t < count; t++) {
        const tx = 2 + Math.floor(rng() * 12);
        const tz = 2 + Math.floor(rng() * 12);
        const h = heights[tx * C + tz];
        if (h <= SEA + 1 || h > 52) continue;
        if (data[idx(tx, h, tz)] !== BLOCK.GRASS) continue;
        const th = 4 + Math.floor(rng() * 2);
        for (let y = 1; y <= th; y++) data[idx(tx, h + y, tz)] = BLOCK.LOG;
        for (let dy = th - 2; dy <= th - 1; dy++)
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && rng() < .5) continue;
            const i = idx(tx + dx, h + dy, tz + dz);
            if (data[i] === BLOCK.AIR) data[i] = BLOCK.LEAVES;
          }
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
          if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && rng() < .4) continue;
          const i = idx(tx + dx, h + th, tz + dz);
          if (data[i] === BLOCK.AIR) data[i] = BLOCK.LEAVES;
        }
        data[idx(tx, h + th + 1, tz)] = BLOCK.LEAVES;
        if (data[idx(tx + 1, h + th + 1, tz)] === BLOCK.AIR) data[idx(tx + 1, h + th + 1, tz)] = BLOCK.LEAVES;
        if (data[idx(tx - 1, h + th + 1, tz)] === BLOCK.AIR) data[idx(tx - 1, h + th + 1, tz)] = BLOCK.LEAVES;
        if (data[idx(tx, h + th + 1, tz + 1)] === BLOCK.AIR) data[idx(tx, h + th + 1, tz + 1)] = BLOCK.LEAVES;
        if (data[idx(tx, h + th + 1, tz - 1)] === BLOCK.AIR) data[idx(tx, h + th + 1, tz - 1)] = BLOCK.LEAVES;
      }

      // Tiny deterministic ruin: a rare landmark for exploration, kept inside one chunk.
      const structRng = Noise.mulberry32(Math.floor(Noise.hash2(cx + 700, cz - 900, seed + 5050) * 4294967296));
      if (structRng() < .035) {
        const sx = 4 + Math.floor(structRng() * 8);
        const sz = 4 + Math.floor(structRng() * 8);
        const sh = heights[sx * C + sz];
        const base = data[idx(sx, sh, sz)];
        if (base === BLOCK.GRASS || base === BLOCK.SNOW) {
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
            const yy = sh + 1;
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
              for (let dy = 0; dy < 2; dy++) {
                const li = idx(sx + dx, sh + 1 + dy, sz + dz);
                if (sx + dx >= 0 && sx + dx < C && sz + dz >= 0 && sz + dz < C && data[li] === BLOCK.AIR) data[li] = BLOCK.COBBLE;
              }
            }
          }
          const center = idx(sx, sh + 1, sz);
          if (data[center] === BLOCK.AIR) data[center] = BLOCK.CRAFTING_TABLE;
          const light = idx(sx + 1, sh + 1, sz);
          if (sx + 1 < C && data[light] === BLOCK.AIR) data[light] = BLOCK.GLOWSTONE;
        }
      }
      return data;
    }

    return { seed, heightAt, forestAt, biomeAt, genChunk };
  }

  return { makeGen, idx };
})();
