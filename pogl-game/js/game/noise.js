'use strict';

const Noise = (() => {

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(ix, iz, seed) {
    let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function hash3(ix, iy, iz, seed) {
    let h = (ix * 374761393 + iy * 1103515245 + iz * 668265263 + seed * 974634551) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const fade = t => t * t * (3 - 2 * t);

  function noise2(x, z, seed) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = fade(x - ix), fz = fade(z - iz);
    const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
    const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function noise3(x, y, z, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
    const c000 = hash3(ix, iy, iz, seed),     c100 = hash3(ix + 1, iy, iz, seed);
    const c010 = hash3(ix, iy + 1, iz, seed), c110 = hash3(ix + 1, iy + 1, iz, seed);
    const c001 = hash3(ix, iy, iz + 1, seed), c101 = hash3(ix + 1, iy, iz + 1, seed);
    const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
    const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
    const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
    const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
    return y0 + (y1 - y0) * fz;
  }

  function fbm2(x, z, seed, octaves) {
    let sum = 0, amp = 1, norm = 0, fx = x, fz = z;
    for (let i = 0; i < octaves; i++) {
      sum += noise2(fx, fz, seed + i * 101) * amp;
      norm += amp;
      amp *= 0.5;
      fx *= 2;
      fz *= 2;
    }
    return sum / norm;
  }

  return { mulberry32, hash2, hash3, noise2, noise3, fbm2 };
})();
