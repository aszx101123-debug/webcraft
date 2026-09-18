'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const lib = ['config.js', 'noise.js', 'terrain.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', 'game', f), 'utf8'))
  .join('\n;\n');
vm.runInThisContext(lib, { filename: 'game-lib.js' });

const OUT_DIR = path.join(__dirname, '..', 'img');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    buf.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function makeCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  return {
    w, h, buf,
    px(x, y, r, g, b, a = 1) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (a >= 1) {
        buf[i] = Math.max(0, Math.min(255, r));
        buf[i + 1] = Math.max(0, Math.min(255, g));
        buf[i + 2] = Math.max(0, Math.min(255, b));
        buf[i + 3] = 255;
      } else if (a > 0) {
        const ia = 1 - a;
        buf[i] = Math.max(0, Math.min(255, r * a + buf[i] * ia));
        buf[i + 1] = Math.max(0, Math.min(255, g * a + buf[i + 1] * ia));
        buf[i + 2] = Math.max(0, Math.min(255, b * a + buf[i + 2] * ia));
        buf[i + 3] = Math.max(buf[i + 3], Math.round(a * 255));
      }
    }
  };
}

function hsh(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + (c | 0) * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function diamond(c, cx, topY, hw, hh, col, jitter = 0, alpha = 1) {
  for (let u = -hw; u <= hw; u++) {
    const half = Math.round(hh * (hw - Math.abs(u)) / hw);
    for (let v = -half; v <= half; v++) {
      const nr = jitter ? (hsh(cx + u, topY + v, 7) - .5) * jitter : 0;
      const ng = jitter ? (hsh(cx + u, topY + v, 71) - .5) * jitter : 0;
      const nb = jitter ? (hsh(cx + u, topY + v, 77) - .5) * jitter : 0;
      c.px(cx + u, topY + hh + v, col[0] + nr, col[1] + ng, col[2] + nb, alpha);
    }
  }
}

function faceL(c, cx, topY, hw, hh, depth, col, jitter = 0) {
  for (let u = 0; u <= hw; u++) {
    const y0 = topY + hh + Math.round(u * hh / hw);
    for (let v = 0; v < depth; v++) {
      const nr = jitter ? (hsh(cx - hw + u, y0 + v, 11) - .5) * jitter : 0;
      const ng = jitter ? (hsh(cx - hw + u, y0 + v, 111) - .5) * jitter : 0;
      const nb = jitter ? (hsh(cx - hw + u, y0 + v, 117) - .5) * jitter : 0;
      c.px(cx - hw + u, y0 + v, col[0] + nr, col[1] + ng, col[2] + nb);
    }
  }
}

function faceR(c, cx, topY, hw, hh, depth, col, jitter = 0) {
  for (let u = 0; u <= hw; u++) {
    const y0 = topY + 2 * hh - Math.round(u * hh / hw);
    for (let v = 0; v < depth; v++) {
      const nr = jitter ? (hsh(cx + u, y0 + v, 13) - .5) * jitter : 0;
      const ng = jitter ? (hsh(cx + u, y0 + v, 113) - .5) * jitter : 0;
      const nb = jitter ? (hsh(cx + u, y0 + v, 119) - .5) * jitter : 0;
      c.px(cx + u, y0 + v, col[0] + nr, col[1] + ng, col[2] + nb);
    }
  }
}

function findRegion(gen, biome) {
  const SEA = CONFIG.SEA;
  for (let r = 0; r < 60; r++) {
    for (let a = 0; a < 10; a++) {
      const x = Math.round(Math.cos(a / 10 * Math.PI * 2) * r * 10) + 8;
      const z = Math.round(Math.sin(a / 10 * Math.PI * 2) * r * 10) + 8;
      const h = gen.heightAt(x, z);
      if (biome === 'coast') {
        if (h < SEA || h > SEA + 4) continue;
        let hasWater = false, hasLand = false;
        for (const [dx, dz] of [[14, 0], [10, 10], [0, 14], [-10, 10], [-14, 0], [-10, -10], [0, -14], [10, -10]]) {
          const hh2 = gen.heightAt(x + dx, z + dz);
          if (hh2 < SEA - 1) hasWater = true;
          if (hh2 > SEA + 3) hasLand = true;
        }
        if (hasWater && hasLand) return { x, z };
      } else {
        if (h < 27 || h > 41) continue;
        if (gen.forestAt(x, z) > .58) return { x, z };
      }
    }
  }
  return { x: 8, z: 8 };
}

const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '·': ['00000', '00000', '00110', '00110', '00000', '00000', '00000']
};

function textWidth(str, sc) {
  let w = 0;
  for (const ch of str.toUpperCase()) w += (ch === ' ' ? 4 : 6) * sc;
  return w - sc;
}

function drawText(c, str, cx, y, sc, col, shadow) {
  const chars = [...str.toUpperCase()];
  const x0 = Math.round(cx - textWidth(str, sc) / 2);
  for (const pass of [0, 1]) {
    let x = x0;
    for (const ch of chars) {
      if (ch === ' ') { x += 4 * sc; continue; }
      const g = GLYPHS[ch];
      if (g) {
        for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
          if (g[r][q] !== '1') continue;
          if (pass === 0 && shadow) block(c, x + q * sc + sc * .55, y + r * sc + sc * .55, sc, shadow, 1);
          if (pass === 1) block(c, x + q * sc, y + r * sc, sc, col, 1);
        }
      }
      x += 6 * sc;
    }
  }
}

function block(c, x, y, sc, col, alpha) {
  const e = Math.max(1, sc * .12);
  for (let dy = 0; dy < sc - e; dy++) for (let dx = 0; dx < sc - e; dx++)
    c.px(x + dx, y + dy, col[0], col[1], col[2], alpha);
}

function renderScene(opts) {
  const { w, h, seed, biome = 'coast', night = false, title = null, subtitle = null, glow = false } = opts;
  const c = makeCanvas(w, h);
  const skyTop = night ? [13, 18, 38] : [104, 174, 228];
  const skyBot = night ? [24, 34, 62] : [188, 226, 246];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const col = [skyTop[0] + (skyBot[0] - skyTop[0]) * t, skyTop[1] + (skyBot[1] - skyTop[1]) * t, skyTop[2] + (skyBot[2] - skyTop[2]) * t];
    for (let x = 0; x < w; x++) c.px(x, y, col[0], col[1], col[2]);
  }

  if (night) {
    for (let i = 0; i < 130; i++) {
      const sx = Math.floor(hsh(i, 9, 1) * w);
      const sy = Math.floor(hsh(i, 9, 2) * h * .55);
      const bright = .35 + hsh(i, 9, 3) * .6;
      c.px(sx, sy, 255, 255, 255, bright);
      if (hsh(i, 9, 4) > .8) { c.px(sx + 1, sy, 255, 255, 255, bright * .7); c.px(sx, sy + 1, 255, 255, 255, bright * .7); }
    }
    const mx = w - 170, my = 110, mr = 34;
    for (let dy = -mr; dy <= mr; dy++) for (let dx = -mr; dx <= mr; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < mr) c.px(mx + dx, my + dy, 232, 236, 242, 1);
      if (d < mr - 9 && Math.sqrt((dx + 12) * (dx + 12) + (dy - 6) * (dy - 6)) < mr - 8)
        c.px(mx + dx, my + dy, skyTop[0] + 12, skyTop[1] + 14, skyTop[2] + 18, 1);
    }
  } else {
    const sx = w - 180, sy = 115, sr = 46;
    for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < sr) {
        const core = d < sr * .55;
        const a = Math.max(0, 1 - Math.pow(d / sr, 3));
        c.px(sx + dx, sy + dy, core ? 255 : 252, core ? 240 : 214, core ? 160 : 70, a);
      }
    }
    const clouds = [[w * .16, 90, 110], [w * .52, 62, 88], [w * .30, 150, 70]];
    for (let ci = 0; ci < clouds.length; ci++) {
      const [cxx, cyy, cw2] = clouds[ci];
      const rows = [[0, cw2], [-9, cw2 * .68], [9, cw2 * .55]];
      for (const [ry, rw] of rows)
        for (let dx = -rw / 2; dx <= rw / 2; dx++)
          for (let dy = 0; dy < 9; dy++)
            c.px(cxx + dx, cyy + ry + dy, 255, 255, 255, .92);
    }
  }

  const gen = Terrain.makeGen(seed);
  const SEA = CONFIG.SEA;
  const center = findRegion(gen, biome);
  const N = 44, M = 44;
  let hw = Math.round(w * .72 / (N + M - 2));
  hw -= hw % 2;
  const hh = hw / 2;
  const BH = Math.max(4, hw - 3);
  const ox = center.x - (N >> 1), oz = center.z - (M >> 1);
  const hs = [];
  let hMin = 999;
  for (let x = 0; x < N; x++) {
    hs.push([]);
    for (let z = 0; z < M; z++) {
      const hv = gen.heightAt(ox + x, oz + z);
      hs[x].push(hv);
      if (hv < hMin) hMin = hv;
    }
  }
  const originY = h - 58 - (N + M - 2) * hh;
  const dk = night ? .48 : 1;
  const col = (r, g, b) => [r * dk, g * dk, b * dk];

  for (let s = 0; s <= N + M - 2; s++) {
    const x0 = Math.max(0, s - M + 1), x1 = Math.min(N - 1, s);
    for (let x = x0; x <= x1; x++) {
      const z = s - x;
      const hgt = hs[x][z];
      const cx = Math.round(w / 2 + (x - z) * hw);
      const topY = originY + s * hh - (hgt - hMin) * BH;
      const isWater = hgt < SEA;
      const beach = hgt <= SEA + 1;
      const snow = hgt >= 52, stone = hgt >= 46;
      let frontMin = hgt - 3;
      if (x + 1 < N) frontMin = Math.min(frontMin, hs[x + 1][z]);
      if (z + 1 < M) frontMin = Math.min(frontMin, hs[x][z + 1]);
      const depth = Math.max(2, Math.min(15, hgt - frontMin + 2)) * BH;

      let topC, leftC, rightC;
      if (snow) { topC = col(232, 236, 239); leftC = col(196, 204, 212); rightC = col(160, 170, 182); }
      else if (stone) { topC = col(139, 139, 139); leftC = col(108, 108, 108); rightC = col(84, 84, 84); }
      else if (beach || isWater) { topC = col(221, 210, 155); leftC = col(186, 172, 124); rightC = col(150, 138, 98); }
      else { topC = col(111, 174, 77); leftC = col(138, 95, 60); rightC = col(106, 72, 45); }

      diamond(c, cx, topY, hw, hh, topC, 38);
      faceL(c, cx, topY, hw, hh, depth, leftC, 32);
      faceR(c, cx, topY, hw, hh, depth, rightC, 32);

      if (isWater) {
        const wy = originY + s * hh - (SEA - hMin) * BH;
        if (SEA > hgt) {
          const wTop = night ? col(38, 66, 120) : [59, 111, 212];
          const wL = night ? col(30, 54, 100) : [47, 88, 168];
          const wR = night ? col(24, 44, 84) : [37, 70, 136];
          diamond(c, cx, wy, hw, hh, wTop, 14, .82);
          faceL(c, cx, wy, hw, hh, Math.max(2, (SEA - hgt) * BH), wL, 10);
          faceR(c, cx, wy, hw, hh, Math.max(2, (SEA - hgt) * BH), wR, 10);
        }
      }

      if (!isWater && !beach && !stone && gen.forestAt(ox + x, oz + z) > .56 && hsh(ox + x, oz + z, 3) < .38) {
        const tH = 4 * BH;
        for (let v = 0; v < tH + hh; v++) {
          c.px(cx - 1, topY - v, 96 * dk, 68 * dk, 40 * dk);
          c.px(cx, topY - v, 80 * dk, 56 * dk, 33 * dk);
        }
        diamond(c, cx, topY - tH - 3 * hh, Math.round(hw * 1.9), Math.round(hh * 1.9), col(44, 100, 38), 24);
        diamond(c, cx, topY - tH - 6 * hh, Math.round(hw * 1.4), Math.round(hh * 1.4), col(56, 120, 46), 24);
        diamond(c, cx, topY - tH - 8 * hh, Math.round(hw * .8), Math.round(hh * .8), col(66, 134, 54), 20);
      }

      if (glow && !isWater && hsh(ox + x, oz + z, 5) < .07) {
        diamond(c, cx, topY - 2 * hh, Math.round(hw * 2.6), Math.round(hh * 2.6), [255, 226, 120], 0, .16);
        diamond(c, cx, topY, Math.round(hw * .62), Math.round(hh * .62), [255, 224, 116], 12);
      }
    }
  }

  if (title) drawText(c, title, w / 2, 40, Math.max(8, Math.round(w / 92)), [247, 250, 252], [12, 22, 18]);
  if (subtitle) drawText(c, subtitle, w / 2, 40 + Math.max(8, Math.round(w / 92)) * 8, Math.max(3, Math.round(w / 300)), [198, 233, 166], [10, 18, 12]);

  return encodePNG(w, h, c.buf);
}

function renderIcon(size) {
  const c = makeCanvas(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) c.px(x, y, 19, 27, 38);
  const hw = Math.round(size * .3), hh = Math.round(hw / 2);
  const cx = Math.round(size / 2), topY = Math.round(size * .3);
  diamond(c, cx, topY, hw, hh, [111, 174, 77], 14);
  faceL(c, cx, topY, hw, hh, Math.round(size * .26), [138, 95, 60], 12);
  faceR(c, cx, topY, hw, hh, Math.round(size * .26), [100, 68, 42], 12);
  const r = Math.round(size * .16);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ax = Math.min(x, size - 1 - x), ay = Math.min(y, size - 1 - y);
    if (ax < r && ay < r && (r - ax) * (r - ax) + (r - ay) * (r - ay) > r * r) {
      const i = (y * size + x) * 4;
      c.buf[i + 3] = 0;
    }
  }
  return encodePNG(size, size, c.buf);
}

const outputs = [
  ['og-image.png', renderScene({ w: 1200, h: 630, seed: 42, biome: 'coast', title: 'WEBCRAFT', subtitle: 'PLAY FREE · NO INSTALL' })],
  ['shot-coast.png', renderScene({ w: 900, h: 560, seed: 999, biome: 'coast' })],
  ['shot-forest.png', renderScene({ w: 900, h: 560, seed: 20260101, biome: 'forest' })],
  ['shot-night.png', renderScene({ w: 900, h: 560, seed: 1, biome: 'forest', night: true, glow: true })],
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)]
];

for (const [name, buf] of outputs) {
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log(name, (buf.length / 1024).toFixed(1) + 'KB');
}
