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

    function genChunk(cx, cz) {
      const data = new Uint8Array(C * C * H);
      const heights = new Int16Array(C * C);
      for (let x = 0; x < C; x++) for (let z = 0; z < C; z++) {
        const wx = cx * C + x, wz = cz * C + z;
        const h = heightAt(wx, wz);
        heights[x * C + z] = h;
        const sandy = h <= SEA + 1;
        for (let y = 0; y < H; y++) {
          let id = BLOCK.AIR;
          if (y === 0) id = BLOCK.BEDROCK;
          else if (y <= h) {
            if (y === h) id = sandy ? BLOCK.SAND : BLOCK.GRASS;
            else if (y >= h - 3) id = sandy ? BLOCK.SAND : BLOCK.DIRT;
            else id = BLOCK.STONE;
            if (h > SEA + 2 && y >= 3 && y <= h &&
                Noise.noise3(wx * .085, y * .085, wz * .085, seed + 41) > .74) id = BLOCK.AIR;
          } else if (y <= SEA) id = BLOCK.WATER;
          if (id) data[idx(x, y, z)] = id;
        }
      }
      const f = stretch(forestAt(cx * C + 8, cz * C + 8), 1.9);
      const count = Math.min(4, Math.floor(Math.max(0, f - .5) * 12));
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
      return data;
    }

    return { seed, heightAt, forestAt, genChunk };
  }

  return { makeGen, idx };
})();
