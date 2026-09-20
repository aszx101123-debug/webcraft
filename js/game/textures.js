'use strict';

const Textures = (() => {
  const TS = 16, GRID = 8, SIZE = TS * GRID;
  let canvas = null, ctx = null, texture = null;
  const iconCache = {};

  function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function css(r, g, b, a = 1) { return `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`; }

  function init() {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    ctx = canvas.getContext('2d');
    const rng = Noise.mulberry32(20260101);
    const P = (col, row, x, y, style) => { if (!style) return; ctx.fillStyle = style; ctx.fillRect(col * TS + x, row * TS + y, 1, 1); };
    const vary = (r, g, b, amt) => { const d = (rng() * 2 - 1) * amt; return css(r + d, g + d, b + d); };
    const fill = (col, row, fn) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) P(col, row, x, y, fn(x, y)); };

    fill(0, 0, () => vary(96, 158, 76, 14));
    fill(1, 0, (x, y) => (y < 3 || (y === 3 && rng() < .5)) ? vary(96, 158, 76, 14) : vary(134, 96, 67, 12));
    fill(2, 0, () => vary(134, 96, 67, 12));
    fill(3, 0, (x, y) => {
      const base = rng() < .18 ? 108 : 127;
      if ((x * 11 + y * 7) % 47 === 0) return vary(154, 154, 154, 8);
      if ((x * 5 + y * 13) % 53 === 0) return vary(86, 88, 92, 7);
      return vary(base, base, base, 8);
    });
    fill(4, 0, (x, y) => {
      const cx = Math.floor(x / 4), cy = Math.floor(y / 4);
      const px = x % 4, py = y % 4;
      const g = 96 + hashCell(cx, cy) * 58;
      if ((x + y * 2) % 17 === 0) return vary(172, 172, 172, 7);
      return (px === 0 || py === 0) ? vary(64, 66, 68, 8) : vary(g, g, g, 10);
    });
    fill(5, 0, (x, y) => {
      if ((x * 9 + y * 5) % 23 === 0) return vary(190, 178, 132, 7);
      if ((x * 3 + y * 11) % 31 === 0) return vary(236, 226, 190, 6);
      return vary(219, 207, 163, 10);
    });
    fill(6, 0, (x, y) => {
      const groove = x % 4 === 0 || (x % 4 === 3 && rng() < .3);
      if (y % 7 === 0 && !groove) return vary(151, 110, 66, 7);
      return groove ? vary(78, 56, 36, 6) : vary(122, 90, 55, 8);
    });
    fill(7, 0, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.2) return vary(78, 56, 34, 6);
      const ring = Math.floor(d * 1.35) % 3;
      return ring === 0 ? vary(148, 108, 66, 8) : ring === 1 ? vary(113, 78, 47, 8) : vary(132, 94, 57, 7);
    });
    fill(0, 1, (x, y) => {
      if ((x + y) % 11 === 0) return null;
      if ((x * 7 + y * 5) % 29 === 0) return vary(112, 156, 78, 12);
      return vary(52, 112, 44, 20);
    });
    fill(1, 1, (x, y) => {
      const seam = y % 4 === 3;
      const joint = (Math.floor(y / 4) % 2 === 0) ? (x === 7) : (x === 3 || x === 12);
      if (seam || joint) return vary(110, 84, 50, 6);
      if ((x * 13 + y * 3) % 37 === 0) return vary(190, 151, 95, 7);
      return vary(168, 132, 84, 10);
    });
    fill(2, 1, (x, y) => {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      const shine = (x - y === 4 || x - y === 5) && x < 13;
      if (edge) return css(202, 228, 235, .95);
      if (shine) return css(238, 248, 252, .9);
      if ((x + y) % 17 === 0) return css(168, 208, 220, .35);
      return null;
    });
    fill(3, 1, (x, y) => {
      const row = Math.floor(y / 4);
      const shift = (row % 2) * 4;
      const mortar = y % 4 === 3 || (x + shift) % 8 === 7;
      if (mortar) return vary(174, 162, 150, 7);
      if ((x * 7 + y * 11) % 43 === 0) return vary(189, 91, 67, 7);
      return vary(158, 74, 58, 10);
    });
    fill(4, 1, (x, y) => {
      if ((x * 5 + y * 9) % 19 === 0) return vary(255, 239, 146, 10);
      if ((x + y) % 13 === 0) return vary(115, 83, 45, 8);
      return rng() < .36 ? vary(248, 220, 120, 12) : vary(146, 108, 58, 10);
    });
    fill(5, 1, (x, y) => {
      const wave = Math.sin((x + y * .7) * .8) > .55;
      return wave ? vary(76, 135, 210, 10) : vary(54, 109, 184, 12);
    });
    fill(6, 1, () => { const v = rng() < .5 ? 52 : 88; return vary(v, v, v, 14); });\n    fill(7, 1, (x, y) => {
      if ((x + y * 3) % 19 === 0) return vary(226, 236, 242, 6);
      return vary(242, 246, 248, 5);
    });

    const meat = (col, row, r, g, b, r2, g2, b2) => fill(col, row, (x, y) => {
      const dx = (x - 7.5) / 5.5, dy = (y - 8.5) / 3.6;
      const d = dx * dx + dy * dy;
      if (d > 1) return null;
      if (d > .8) return vary(r * .62, g * .62, b * .62, 8);
      if (d < .3) return vary(r2, g2, b2, 8);
      return vary(r, g, b, 10);
    });
    meat(0, 2, 232, 147, 143, 248, 200, 196);
    meat(1, 2, 160, 57, 46, 201, 107, 82);
    meat(2, 2, 232, 201, 160, 246, 224, 190);
    meat(3, 2, 176, 69, 58, 205, 105, 90);
    fill(3, 2, (x, y) => {
      if (x >= 11 && y >= 7 && y <= 9 && Math.hypot(x - 11.5, y - 8) < 2.6) return vary(236, 229, 211, 8);
      return null;
    });
    fill(4, 2, (x, y) => {
      const dx = (x - 7.5) / 5.5, dy = (y - 8.5) / 3.6;
      if (dx * dx + dy * dy > 1) return null;
      if (rng() < .16) return null;
      return vary(122, 143, 74, 26);
    });
    fill(5, 2, (x, y) => {
      const dx = (x - 7.5) / 3.9, dy = (y - 9.5) / 3.6;
      if (dx * dx + dy * dy <= 1) return vary(208, 52, 44, 14);
      if ((x === 7 || x === 8) && y === 2) return vary(107, 74, 42, 6);
      if (y === 3 && (x === 9 || x === 10)) return vary(78, 143, 58, 8);
      return null;
    });

    const oreTile = (base, speck, speck2) => (x, y) => {
      const r = rng();
      if ((x * 11 + y * 7) % 9 === 0) return vary(...speck, 9);
      if ((x * 5 + y * 13) % 17 === 0 && r < .8) return vary(...speck2, 7);
      return vary(...base, 10);
    };
    fill(0, 3, oreTile([76, 76, 80], [38, 38, 42], [112, 112, 118]));
    fill(1, 3, oreTile([104, 104, 108], [214, 170, 92], [226, 190, 116]));
    fill(2, 3, oreTile([105, 104, 108], [244, 205, 56], [255, 227, 96]));
    fill(3, 3, oreTile([104, 104, 110], [232, 145, 80], [190, 105, 60]));
    fill(4, 3, oreTile([104, 104, 110], [206, 54, 46], [244, 72, 58]));
    fill(5, 3, oreTile([104, 104, 110], [62, 86, 190], [86, 110, 220]));
    fill(6, 3, oreTile([104, 104, 110], [78, 214, 246], [154, 242, 255]));
    fill(7, 3, oreTile([104, 104, 110], [86, 214, 104], [146, 242, 132]));

    const toolTile = (metal, handle) => (x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      if (dy > dx * .5 + 1 && dy < dx * .5 + 3) return metal;
      if ((x + y) % 5 === 0) return handle;
      return null;
    };
    fill(0, 5, toolTile('#d6c08b', '#7d5535'));
    fill(1, 5, toolTile('#9299a3', '#6d6d72'));
    fill(2, 5, toolTile('#e3a93d', '#6d5531'));
    fill(3, 5, toolTile('#d8dce2', '#69462f'));
    fill(4, 5, toolTile('#80dff4', '#5b4f7b'));
    fill(5, 5, toolTile('#d6c08b', '#7d5535'));
    fill(6, 5, toolTile('#9299a3', '#6d6d72'));
    fill(7, 5, toolTile('#e3a93d', '#6d5531'));
    fill(0, 6, toolTile('#d8dce2', '#69462f'));
    fill(1, 6, toolTile('#80dff4', '#5b4f7b'));
    fill(2, 6, toolTile('#d6c08b', '#7d5535'));
    fill(3, 6, toolTile('#9299a3', '#6d6d72'));
    fill(4, 6, toolTile('#e3a93d', '#6d5531'));
    fill(5, 6, toolTile('#d8dce2', '#69462f'));
    fill(6, 6, (x, y) => ((x < 4 && y < 4) || (y % 5 === 0)) ? vary(151, 104, 62, 8) : vary(176, 123, 76, 8));
    fill(7, 6, (x, y) => ((x + y) % 4 === 0) ? vary(102, 70, 46, 8) : vary(138, 94, 61, 8));
    fill(6, 7, (x, y) => ((x - y) % 5 === 0) ? vary(112, 112, 120, 8) : vary(150, 150, 158, 8));

    function hashCell(cx, cy) { return (cx * 7 + cy * 13) % 5 / 5; }

    texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }

  function tileUV(col, row) {
    const e = 1 / 256;
    return {
      u0: col / GRID + e,
      u1: (col + 1) / GRID - e,
      v0: 1 - (row + 1) / GRID + e,
      v1: 1 - row / GRID - e
    };
  }

  function tileFor(blockId, faceKey) {
    const t = BLOCKS[blockId].tiles;
    const tile = t[faceKey] || t.all;
    return tileUV(tile[0], tile[1]);
  }

  function blockIcon(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas');
    c.width = c.height = 48;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (id >= 100) {
      const tile = ITEMS[id].tiles.all;
      g.drawImage(canvas, tile[0] * TS, tile[1] * TS, TS, TS, 8, 8, 32, 32);
      iconCache[id] = c.toDataURL();
      return iconCache[id];
    }
    const B = BLOCKS[id];
    const topTile = B.tiles.top || B.tiles.all;
    const sideTile = B.tiles.side || B.tiles.all;
    const draw = (tile, m, dark) => {
      g.save();
      g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      g.drawImage(canvas, tile[0] * TS, tile[1] * TS, TS, TS, 0, 0, TS, TS);
      if (dark) { g.fillStyle = `rgba(15,20,28,${dark})`; g.fillRect(0, 0, TS, TS); }
      g.restore();
    };
    draw(topTile, [1.25, .625, -1.25, .625, 24, 2], 0);
    draw(sideTile, [1.25, .625, 0, 1.25, 4, 12], .22);
    draw(sideTile, [1.25, -.625, 0, 1.25, 24, 22], .42);
    iconCache[id] = c.toDataURL();
    return iconCache[id];
  }

  let hudCache = null;

  function hudIcons() {
    if (hudCache) return hudCache;
    const heart = [
      '.XX..XX.',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...'
    ];
    const drumstick = [
      '..XXXX..',
      '.XXXXXX.',
      '.XXXXXX.',
      '..XXXX..',
      '...XXB..',
      '....BB..',
      '...BB...'
    ];
    const bubble = [
      '..XXX..',
      '.XXXXX.',
      'XXOXXXX',
      'XXXXXXX',
      'XXXXXXX',
      '.XXXXX.',
      '..XXX..'
    ];
    const make = (pattern, colors) => {
      const rows = pattern.length, cols = pattern[0].length;
      const c = document.createElement('canvas');
      c.width = cols;
      c.height = rows;
      const g = c.getContext('2d');
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const ch = pattern[y][x];
        const color = colors[ch];
        if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
      }
      return c.toDataURL();
    };
    const heartColors = full => full
      ? { X: '#e8352e' }
      : { X: '#3d434c' };
    const halfColors = { L: '#e8352e', R: '#3d434c' };
    const halfHeart = make(heart.map(r => r.split('').map((c, i) => c === '.' ? '.' : (i < 4 ? 'L' : 'R')).join('')), halfColors);
    const foodColors = full => full
      ? { X: '#b5713a', B: '#e8e2d0' }
      : { X: '#3d434c', B: '#3d434c' };
    hudCache = {
      heart: make(heart, heartColors(true)),
      heartHalf: halfHeart,
      heartEmpty: make(heart, heartColors(false)),
      food: make(drumstick, foodColors(true)),
      foodEmpty: make(drumstick, foodColors(false)),
      bubble: make(bubble, { X: '#55aef0', O: '#cfe8ff' })
    };
    return hudCache;
  }

  return {
    init, tileUV, tileFor, blockIcon, hudIcons,
    getTexture: () => texture,
    getAtlas: () => canvas
  };
})();
