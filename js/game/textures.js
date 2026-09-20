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
    fill(3, 0, () => { const v = rng() < .18 ? 108 : 127; return vary(v, v, v, 8); });
    fill(4, 0, (x, y) => {
      const cx = Math.floor(x / 4), cy = Math.floor(y / 4);
      const px = x % 4, py = y % 4;
      const g = 100 + hashCell(cx, cy) * 50;
      return (px === 0 || py === 0) ? vary(70, 70, 70, 8) : vary(g, g, g, 10);
    });
    fill(5, 0, () => vary(219, 207, 163, 10));
    fill(6, 0, (x) => (x % 4 === 0 || (x % 4 === 3 && rng() < .3)) ? vary(86, 62, 38, 6) : vary(122, 90, 55, 8));
    fill(7, 0, (x, y) => {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d > 7.2) return vary(78, 56, 34, 6);
      return Math.floor(d) % 2 === 0 ? vary(138, 102, 63, 8) : vary(104, 74, 44, 8);
    });
    fill(0, 1, () => (rng() < .14) ? null : vary(52, 112, 44, 20));
    fill(1, 1, (x, y) => {
      const seam = y % 4 === 3;
      const joint = (Math.floor(y / 4) % 2 === 0) ? (x === 7) : (x === 3 || x === 12);
      return (seam || joint) ? vary(110, 84, 50, 6) : vary(168, 132, 84, 10);
    });
    fill(2, 1, (x, y) => {
      const edge = x === 0 || x === 15 || y === 0 || y === 15;
      const shine = (x - y === 4 || x - y === 5) && x < 13;
      if (edge) return css(202, 228, 235, .95);
      if (shine) return css(238, 248, 252, .9);
      return null;
    });
    fill(3, 1, (x, y) => {
      const row = Math.floor(y / 4);
      const shift = (row % 2) * 4;
      const mortar = y % 4 === 3 || (x + shift) % 8 === 7;
      return mortar ? vary(176, 164, 152, 6) : vary(158, 74, 58, 10);
    });
    fill(4, 1, () => (rng() < .32) ? vary(248, 220, 120, 12) : vary(146, 108, 58, 10));
    fill(5, 1, () => vary(60, 116, 196, 12));
    fill(6, 1, () => { const v = rng() < .5 ? 52 : 88; return vary(v, v, v, 14); });

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

    const oreTile = (base, speck, chance=.24) => fill(base[0], base[1], (x, y) => {
      if (rng() < chance) return vary(speck[0], speck[1], speck[2], 14);
      return vary(127, 127, 127, 9);
    });
    oreTile([0,3],[35,35,35],.24);
    oreTile([1,3],[210,205,190],.22);
    oreTile([2,3],[236,190,46],.20);
    oreTile([3,3],[80,220,215],.17);
    fill(4,3,(x,y)=>{
      if (y>12) return vary(105,70,40,7);
      if ((x===7||x===8) && y>=4 && y<=12) return vary(112,73,40,7);
      if (x>=6 && x<=9 && y<=5) return rng()<.7 ? vary(255,170,45,14) : vary(120,70,30,8);
      return null;
    });
    fill(5,3,(x,y)=>{
      const red = vary(178,58,58,10), hi = vary(233,92,92,9), pale = vary(238,224,210,8);
      if(y<5) return pale;
      if(y<11) return rng()<.78 ? red : hi;
      if(y<13) return pale;
      return vary(112,72,42,8);
    });

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

    const shadow = () => { g.fillStyle='rgba(0,0,0,.30)'; g.fillRect(6,38,36,4); };
    const glow = (x,y,r,color) => {
      const gr=g.createRadialGradient(x,y,1,x,y,r);
      gr.addColorStop(0,color); gr.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gr; g.fillRect(x-r,y-r,r*2,r*2);
    };
    const finish = () => { iconCache[id]=c.toDataURL(); return iconCache[id]; };

    if(id===ITEM.STICK){
      shadow();
      g.fillStyle='#5d371f';g.fillRect(21,7,7,34);
      g.fillStyle='#a96b39';g.fillRect(23,7,3,34);
      g.fillStyle='#d0914d';g.fillRect(24,7,1,28);
      return finish();
    }

    if(id===BLOCK.TORCH){
      glow(24,12,15,'rgba(255,180,55,.30)');
      shadow();
      g.fillStyle='#5e3821';g.fillRect(20,17,8,25);
      g.fillStyle='#a96d3c';g.fillRect(22,17,3,25);
      g.fillStyle='#ff7b20';g.fillRect(18,10,12,12);
      g.fillStyle='#ffd45a';g.fillRect(21,7,6,13);
      g.fillStyle='#fff1b0';g.fillRect(23,7,3,7);
      return finish();
    }

    if(getToolDef(id)){
      const td=getToolDef(id);
      const metal=td.tier===4?'#48dfe8':td.tier===3?'#dce4ed':td.tier===2?'#9ca7b2':'#b87343';
      const hi=td.tier===4?'#d8ffff':td.tier===3?'#ffffff':td.tier===2?'#d7e0e8':'#e2a46b';
      const handle='#6a4024';
      shadow();
      g.strokeStyle='rgba(0,0,0,.38)';g.lineWidth=8;g.lineCap='square';
      g.beginPath();g.moveTo(11,39);g.lineTo(34,10);g.stroke();
      g.strokeStyle='#8b572d';g.lineWidth=5;
      g.beginPath();g.moveTo(11,39);g.lineTo(34,10);g.stroke();
      if(td.tier===4){glow(25,22,18,'rgba(73,240,250,.18)');}
      if(td.type==='sword'){
        g.strokeStyle=metal;g.lineWidth=7;g.beginPath();g.moveTo(31,8);g.lineTo(13,30);g.stroke();
        g.strokeStyle=hi;g.lineWidth=2;g.beginPath();g.moveTo(30,8);g.lineTo(14,29);g.stroke();
        g.strokeStyle='#7a4a28';g.lineWidth=5;g.beginPath();g.moveTo(12,30);g.lineTo(20,38);g.stroke();
        g.strokeStyle='#d6b15a';g.lineWidth=3;g.beginPath();g.moveTo(9,27);g.lineTo(18,36);g.stroke();
        return finish();
      } else if(td.type==='pickaxe'){
        g.strokeStyle=metal;g.lineWidth=7;
        g.beginPath();g.moveTo(17,13);g.lineTo(40,18);g.stroke();
        g.beginPath();g.moveTo(17,13);g.lineTo(10,24);g.stroke();
        g.strokeStyle=hi;g.lineWidth=2;g.beginPath();g.moveTo(18,12);g.lineTo(39,17);g.stroke();
      } else if(td.type==='axe'){
        g.fillStyle=metal;g.fillRect(15,9,18,9);g.fillRect(27,12,8,16);
        g.fillStyle=hi;g.fillRect(16,10,14,3);
      } else {
        g.strokeStyle=metal;g.lineWidth=8;g.beginPath();g.moveTo(15,10);g.lineTo(29,18);g.stroke();
        g.fillStyle=hi;g.fillRect(24,14,10,7);
      }
      return finish();
    }

    if(id===ITEM.COAL){
      shadow(); g.fillStyle='#24262a';g.beginPath();g.moveTo(10,28);g.lineTo(15,12);g.lineTo(29,9);g.lineTo(39,20);g.lineTo(33,35);g.lineTo(18,39);g.closePath();g.fill();
      g.fillStyle='#596069';g.fillRect(18,15,5,4);g.fillRect(27,21,4,4);g.fillRect(15,27,5,4);
      return finish();
    }
    if(id===ITEM.RAW_IRON){
      shadow();g.fillStyle='#7e7f82';g.beginPath();g.moveTo(8,30);g.lineTo(14,15);g.lineTo(27,9);g.lineTo(40,19);g.lineTo(34,35);g.lineTo(18,40);g.closePath();g.fill();
      g.fillStyle='#e4d3bc';g.fillRect(16,16,7,6);g.fillRect(26,24,5,5);g.fillRect(13,28,5,4);
      return finish();
    }
    if(id===ITEM.RAW_GOLD){
      glow(25,24,18,'rgba(255,195,45,.12)');shadow();g.fillStyle='#8d6b20';g.beginPath();g.moveTo(8,30);g.lineTo(14,14);g.lineTo(28,9);g.lineTo(40,20);g.lineTo(33,36);g.lineTo(18,39);g.closePath();g.fill();
      g.fillStyle='#f4c63e';g.fillRect(16,15,6,6);g.fillRect(28,19,5,7);g.fillRect(14,29,7,5);
      return finish();
    }
    if(id===ITEM.DIAMOND){
      glow(25,23,20,'rgba(98,236,255,.20)');shadow();
      g.fillStyle='#51d8e5';g.beginPath();g.moveTo(11,20);g.lineTo(20,10);g.lineTo(33,13);g.lineTo(39,23);g.lineTo(28,38);g.lineTo(15,34);g.closePath();g.fill();
      g.fillStyle='#d8ffff';g.beginPath();g.moveTo(20,10);g.lineTo(27,20);g.lineTo(17,24);g.closePath();g.fill();
      g.fillStyle='#6ca8ff';g.fillRect(28,21,6,9);
      return finish();
    }

    if(id>=100){
      const colors={
        [ITEM.PORK]:['#ef9da6','#ffced0','#b85b6a'],
        [ITEM.BEEF]:['#a95443','#dc9074','#65322c'],
        [ITEM.CHICKEN]:['#e7d9bb','#fff6df','#d19a4a'],
        [ITEM.MUTTON]:['#b96f5f','#efb6a6','#6d3a34'],
        [ITEM.ROTTEN]:['#5f7a49','#89a96a','#31462a'],
        [ITEM.APPLE]:['#d83d39','#ff7a58','#6fae4a']
      };
      if(colors[id]){
        shadow();const cc=colors[id];g.fillStyle=cc[0];g.beginPath();g.ellipse(24,25,14,10,0,0,Math.PI*2);g.fill();
        g.fillStyle=cc[1];g.beginPath();g.ellipse(21,22,8,5,0,0,Math.PI*2);g.fill();
        g.fillStyle=cc[2];g.fillRect(28,15,4,7);
        if(id===ITEM.APPLE){g.fillStyle='#68a64d';g.fillRect(30,12,8,3);g.fillRect(34,10,3,3);}
        return finish();
      }
    }

    const B=BLOCKS[id];
    const topTile=B.tiles.top||B.tiles.all;
    const sideTile=B.tiles.side||B.tiles.all;
    const draw=(tile,m,dark)=>{
      g.save();g.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);
      g.drawImage(canvas,tile[0]*TS,tile[1]*TS,TS,TS,0,0,TS,TS);
      if(dark){g.fillStyle=`rgba(15,20,28,${dark})`;g.fillRect(0,0,TS,TS);}
      g.restore();
    };
    draw(topTile,[1.25,.625,-1.25,.625,24,2],0);
    draw(sideTile,[1.25,.625,0,1.25,4,12],.16);
    draw(sideTile,[1.25,-.625,0,1.25,24,22],.35);
    return finish();
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
