'use strict';

const Textures = (() => {
  const TS=16, GRID=32, SIZE=TS*GRID;
  let canvas = null, ctx = null, texture = null;
  const iconCache = {};
  let gpuCanvas = null, gpuContext = null, waterStrip = null, waterFrame = 0, waterElapsed = 0;

  function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function css(r, g, b, a = 1) { return `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`; }

  function init() {
    gpuCanvas = gpuContext = waterStrip = null;
    waterFrame = waterElapsed = 0;
    for(const id of Object.keys(iconCache))delete iconCache[id];
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const rng = Noise.mulberry32(20260101);
    const P = (col, row, x, y, style) => { if (!style) return; ctx.fillStyle = style; ctx.fillRect(col * TS + x, row * TS + y, 1, 1); };
    const vary = (r, g, b, amt) => { const d = (rng() * 2 - 1) * amt; return css(r + d, g + d, b + d); };
    const fill = (col, row, fn, overlay = false) => {
      if (!overlay) ctx.clearRect(col * TS, row * TS, TS, TS);
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) P(col, row, x, y, fn(x, y));
    };

    fill(0, 0, (x, y) => { const d = ((x * 17 + y * 29) % 11 === 0) ? -24 : ((x * 7 + y * 3) % 13 === 0 ? 15 : 0); return vary(91 + d, 143 + d, 61 + d * .7, 10); });
    fill(1, 0, (x, y) => (y < 3 || (y === 3 && rng() < .5)) ? vary(91, 143, 61, 11) : vary(128, 91, 59, 10));
    fill(2, 0, (x,y) => ((x*13+y*7)%23===0 ? vary(93,67,46,8) : vary(128,91,59,10)));
    fill(3, 0, (x, y) => {
      const base = rng() < .18 ? 102 : 125;
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
      const groove = (x + (y >> 3)) % 5 === 0;
      if (groove) return vary(65, 51, 31, 6);
      if ((x * 3 + (y >> 1) * 5) % 13 < 2) return vary(132, 104, 64, 7);
      return vary(102, 80, 47, 8);
    });
    fill(7, 0, (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 7.2) return vary(78, 56, 34, 6);
      const ring = Math.floor(d) % 3;
      return ring === 0 ? vary(174, 142, 88, 7) : ring === 1 ? vary(128, 100, 59, 6) : vary(157, 126, 77, 6);
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
      const ripple = (y + Math.floor(Math.sin(x * .5) * 2)) % 7 === 0;
      return ripple ? vary(67, 119, 211, 5) : vary(47, 91, 185, 5);
    });
    fill(6, 1, () => { const v = rng() < .5 ? 52 : 88; return vary(v, v, v, 14); });
    fill(7, 1, (x, y) => {
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
    }, true);
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
    // Original pixel-art furnace: framed dark opening and carved top grate.
    fill(9, 0, (x, y) => {
      const border = x < 2 || x > 13 || y < 2 || y > 13;
      const opening = x >= 4 && x <= 11 && y >= 6 && y <= 12;
      if (border) return vary(68, 71, 76, 7);
      if (opening) {
        if (y >= 10 && x >= 6 && x <= 9) return vary(221, 116, 38, 12);
        return vary(24, 27, 32, 5);
      }
      return ((x*5+y*7)%9 < 2) ? vary(139, 143, 149, 9) : vary(112, 116, 121, 9);
    });
    fill(8, 1, (x, y) => {
      if (x <= 1 || x >= 14 || y <= 1 || y >= 14) return vary(73, 76, 82, 7);
      if ((x >= 5 && x <= 10) && (y >= 5 && y <= 10)) return vary(57, 59, 62, 8);
      return vary(130, 134, 140, 10);
    });

    // Original torch textures: warm flame over a dark wooden shaft.
    fill(8, 2, (x, y) => {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d < 4.5) return vary(255, 218, 103, 12);
      if (d < 7) return vary(240, 123, 35, 12);
      return vary(80, 56, 35, 7);
    });
    fill(9, 1, (x, y) => {
      const flame = y < 6 && x >= 5 && x <= 10;
      if (flame) return (x >= 7 && x <= 8 && y >= 2) ? vary(255, 236, 128, 7) : vary(242, 145, 50, 12);
      if (x >= 5 && x <= 10) return (x === 5 || x === 10) ? vary(86, 53, 33, 6) : vary(142, 98, 58, 9);
      return vary(36, 35, 33, 7);
    });

    // Original five-tier 16px sword silhouettes (no borrowed game assets).
    const swordColors = [
      [157,116,70], [137,145,151], [208,221,229], [245,197,76], [89,218,232]
    ];
    swordColors.forEach((metal, col) => {
      fill(col, 7, (x, y) => {
        const diagonal = Math.abs(x + y - 14);
        if (x >= 7 && y <= 7 && diagonal <= 1) {
          if (x === 14 && y <= 1) return vary(239,240,242,3);
          return vary(metal[0], metal[1], metal[2], 12);
        }
        if (x >= 4 && x <= 9 && y >= 7 && y <= 12 && Math.abs(x - y + 2) <= 1)
          return vary(74, 53, 36, 7);
        if ((x === 4 && y === 10) || (x === 5 && y === 11) || (x === 9 && y === 7))
          return vary(184, 154, 88, 9);
        if ((x === 2 || x === 3) && (y === 13 || y === 14)) return vary(110, 79, 51, 8);
        return null;
      });
    });

    // v1.3.2: higher-contrast original pixel-art. Preserve all original atlas indices.
    const pixelNoise = (x,y,n=0) => {
      let z = (x*374761393 + y*668265263 + n*1442695041) | 0;
      z = Math.imul(z^(z>>>13),1274126177); z ^= z>>>16;
      return (z>>>0) / 4294967295;
    };
    const dirtPixel = (x, y) => {
      const cluster = pixelNoise(x >> 1, y >> 1, 12), grain = pixelNoise(x, y, 15);
      if (grain < .07) return vary(175, 137, 98, 4);
      if (cluster < .2) return vary(104, 75, 53, 6);
      return vary(137 + cluster * 12, 98 + cluster * 8, 67 + cluster * 5, 6);
    };
    fill(0,0,(x,y)=>{
      const v=pixelNoise(x>>1,y>>1,1), blade=pixelNoise(x,y,8);
      if(blade<.08)return vary(141,181,78,4);
      if(v<.2)return vary(86,137,46,6);
      if(v>.8)return vary(123,171,65,5);
      return vary(108,158,56,6);
    });
    fill(1,0,(x,y)=>{
      const top=3+Math.floor(pixelNoise(x>>1,0,41)*3);
      if(y<top)return vary(100+(x%3)*6,151+(x%4)*4,50+(x%2)*5,6);
      if(y===top)return vary(92,83,44,5);
      return dirtPixel(x,y);
    });
    fill(2,0,dirtPixel);
    fill(3,0,(x,y)=>{
      const n=pixelNoise(x>>1,y>>1,27), grain=pixelNoise(x,y,28);
      if(grain<.09)return vary(105,104,102,4);
      if(n>.78)return vary(147,146,142,5);
      if(n<.18)return vary(112,111,108,4);
      return vary(128,127,123,5);
    });
    fill(4,0,(x,y)=>{
      const sx=Math.floor((x+((y>>2)&1)*2)/5),sy=Math.floor(y/4);
      const n=pixelNoise(sx,sy,3);
      const line=(y%4===0)||((x+((y>>2)&1)*2)%5===0);
      if(line)return vary(69,68,65,5);
      const v=112+n*40;
      return vary(v,v-1,v-4,6);
    });
    fill(5,0,(x,y)=>{
      const n=pixelNoise(x,y,22), cluster=pixelNoise(x>>1,y>>1,23);
      if(n<.08)return vary(196,185,137,4);
      if(cluster>.8)return vary(235,225,180,4);
      return vary(223,213,164,5);
    });
    fill(0,1,(x,y)=>{
      const n=pixelNoise(x,y,50), cluster=pixelNoise(x>>1,y>>1,51);
      if(n<.12)return null;
      if(cluster>.78)return vary(105,150,57,6);
      if(cluster<.25)return vary(45,91,32,6);
      return vary(73,123,43,7);
    });
    fill(1,1,(x,y)=>{
      const joint=(y%4===0)||(x===((Math.floor(y/4)%2)*7+3)%16);
      if(joint)return vary(117,89,51,4);
      if((x*7+(y>>1)*13)%29<2)return vary(193,157,96,4);
      return vary(168+(y%4)*3,137+(y%4)*2,82,6);
    });
    // Ores are recognizable colored mineral clusters, instead of isolated noise dots.
    const orePalettes=[
      [[38,42,45],[70,74,78]],[[219,170,111],[242,197,125]],
      [[228,184,50],[255,228,112]],[[206,112,67],[244,160,101]],
      [[190,43,50],[249,80,69]],[[39,76,194],[99,139,239]],
      [[72,187,222],[170,249,252]],[[62,164,80],[137,224,140]]
    ];
    orePalettes.forEach((palette,col)=>{
      fill(col,3,(x,y)=>{
        let near=20;
        for(const [cx,cy] of [[3,4],[10,10],[12,3],[5,13]]) {
          const distance=Math.abs(x-cx)+Math.abs(y-cy)*.8+pixelNoise(x,y,col)*1.1;
          near=Math.min(near,distance);
        }
        if(near<2.1)return vary(...palette[1],9);
        if(near<3.5)return vary(...palette[0],9);
        if(near<4)return vary(72,77,82,6);
        const noise=pixelNoise(x,y,41);
        return noise<.19?vary(94,99,105,7):noise>.85?vary(151,155,158,7):vary(119,124,129,7);
      });
    });

    // 14 entirely new construction and biome blocks (atlas columns 10 and 11).
    fill(10,0,(x,y)=>{
      const tx=Math.floor((x+(y&1)*2)/4), ty=Math.floor(y/4);
      const n=pixelNoise(tx,ty,61),edge=x%4===0||y%4===0;
      return edge?vary(64,68,72,5):vary(107+n*56,111+n*56,116+n*56,9);
    }); // gravel
    fill(11,0,(x,y)=>{
      const n=pixelNoise(x,y,14);
      if(n<.13)return vary(91,100,115,8);
      if(n>.87)return vary(149,157,164,7);
      return vary(121,135,149,6);
    }); // clay
    fill(10,1,(x,y)=>{
      const seam=y===1||y===8||y===14;
      return seam?vary(205,188,145,5):vary(233,216,173,6);
    }); // sandstone top
    fill(11,1,(x,y)=>{
      const seam=y===4||y===11;
      const streak=x%8===0&&y>5;
      return seam?vary(182,168,132,7):streak?vary(218,200,153,6):vary(232,213,170,6);
    }); // sandstone side
    fill(10,2,(x,y)=>{
      const row=Math.floor(y/4),shift=(row%2)*4;
      const line=(y%4===3)||((x+shift)%8===7);
      return line?vary(62,66,70,6):vary(137+(row%2)*8,141+(row%2)*8,143+(row%2)*8,9);
    }); // stone bricks
    fill(11,2,(x,y)=>{
      const edge=x===0||y===0||x===15||y===15;
      const n=pixelNoise(x,y,44);
      return edge?vary(85,92,97,8):vary(148+n*28,154+n*25,160+n*22,5);
    }); // smooth stone
    fill(10,3,(x,y)=>{
      const sx=Math.floor((x+(y&1)*2)/5),sy=Math.floor(y/4);
      const mortar=y%4===0||(x+((y>>2)&1)*2)%5===0;
      if(mortar)return vary(66,79,64,6);
      const moss=pixelNoise(x,y,16)>.77||((x+y*3)%17===0);
      return moss?vary(72,128,62,12):vary(117,122,116,8);
    }); // mossy cobblestone
    fill(11,3,(x,y)=>{
      const scar=(y*5+x*3)%23===0||((y*7+x)%19===0);
      const line=x===2||x===13;
      if(scar)return vary(54,60,60,8);
      if(line)return vary(112,113,103,8);
      return vary(224,215,185,9);
    }); // birch bark
    fill(10,4,(x,y)=>{
      const d=Math.hypot(x-7.5,y-7.5),rings=Math.floor(d*1.4)%3;
      return rings===0?vary(177,143,95,8):rings===1?vary(215,188,142,8):vary(195,160,108,8);
    }); // birch rings
    fill(11,4,(x,y)=>{
      const n=pixelNoise(x,y,66);
      if(n<.16)return null;
      return n>.72?vary(144,201,85,10):n<.35?vary(75,138,54,9):vary(102,169,65,10);
    }); // birch leaves
    fill(10,5,(x,y)=>{
      const seam=y%4===3||x===((Math.floor(y/4)%2)*8+4)%16;
      return seam?vary(155,124,80,6):vary(207,171,112,9);
    }); // birch planks
    fill(11,5,(x,y)=>{
      if(x%5===0)return vary(45,35,30,6);
      const n=pixelNoise(x,y,4);
      return n>.80?vary(116,83,61,6):vary(77,56,46,7);
    }); // spruce bark
    fill(10,6,(x,y)=>{
      const d=Math.hypot(x-7.5,y-7.5);
      return Math.floor(d*1.5)%3===0?vary(92,64,45,7):vary(128,91,65,8);
    }); // spruce rings
    fill(11,6,(x,y)=>{
      const n=pixelNoise(x,y,64);
      if(n<.15)return null;
      return n>.76?vary(86,143,78,10):n<.35?vary(30,76,46,9):vary(48,108,58,9);
    }); // spruce leaves
    fill(10,7,(x,y)=>{
      const seam=y%4===3||x===((Math.floor(y/4)%2)*8+4)%16;
      return seam?vary(63,45,35,6):vary(112,78,55,8);
    }); // spruce planks
    fill(11,7,(x,y)=>{
      const rib=x%5===0;
      const spine=(y%7===2&&x%5===2);
      if(spine)return vary(213,230,155,8);
      return rib?vary(39,100,56,7):vary(53,142,79,9);
    }); // cactus ribs
    fill(10,8,(x,y)=>{
      const edge=x<2||x>13||y<2||y>13;
      const center=Math.hypot(x-7.5,y-7.5)<3;
      return edge?vary(37,97,49,6):center?vary(126,163,76,7):vary(56,133,71,9);
    }); // cactus top
    fill(11,8,(x,y)=>{
      if(x===0||y===0||x===15||y===15)return vary(84,54,35,6);
      if(y===2||y===13)return vary(122,87,53,6);
      const column=Math.floor((x-1)/3), spine=(x%3===0);
      if(spine)return vary(59,44,29,5);
      const colors=[[158,81,66],[69,101,146],[197,168,76],[75,126,83],[150,88,145]];
      const rgb=colors[(column+Math.floor(y/7))%colors.length];
      return vary(...rgb,9);
    }); // bookshelf book spines

    // v1.3.3 · construction shapes: original 16px pixel-art thumbnails.
    fill(0,10,(x,y)=>{
      const edge=x===0||x===15||y===0||y===15;
      const grain=(x*13+y*7)%19===0;
      return edge?vary(86,92,96,5):grain?vary(177,183,188,8):vary(139,148,153,7);
    }); // slab stone
    fill(1,10,(x,y)=>{
      const plank=y%5===0||x===((Math.floor(y/5)%2)*6+4);
      if(plank)return vary(81,58,39,6);
      return (x*11+y*3)%23===0?vary(195,154,95,6):vary(158,116,73,7);
    }); // stair timber
    fill(2,10,(x,y)=>{
      const frame=x<2||x>13||y<2||y>13;
      const seam=x===7||x===8;
      const window=x>=4&&x<=6&&y>=3&&y<=6;
      if(frame)return vary(72,48,29,7);
      if(window)return vary(124,188,203,6);
      if(seam)return vary(94,65,38,5);
      if((x===11||x===12)&&y>=8&&y<=10)return vary(213,180,96,5);
      return (y%5===0)?vary(140,100,59,7):vary(170,127,76,7);
    }); // door face
    fill(3,10,(x,y)=>{
      const edge=x<2||x>13||y<2||y>13;
      return edge?vary(74,49,29,5):vary(151,111,66,7);
    }); // door edge
    fill(4,10,(x,y)=>{
      const lip=y<3||y>13||x<2||x>13;
      if(lip)return vary(70,45,28,6);
      if(y===7||y===8)return vary(106,72,44,6);
      if(x%6===0)return vary(116,78,46,5);
      return vary(164,115,63,7);
    }); // chest sides
    fill(5,10,(x,y)=>{
      const border=x<2||x>13||y<2||y>13;
      const seam=(x===7||y===7);
      return border?vary(71,50,31,6):seam?vary(118,76,45,6):vary(180,132,73,7);
    }); // chest lid
    fill(6,10,(x,y)=>{
      if(x<2||y<2||x>13||y>13)return vary(84,56,35,6);
      if(x>=6&&x<=9&&y>=5&&y<=10)return vary(217,180,88,8);
      return vary(158,109,66,7);
    }); // chest clasp
    const armorColors=[[150,105,75],[120,125,135],[190,195,205],[220,180,55],[95,220,245]];let ac=0;const armorTile=(r,g,b)=>(x,y)=>vary(r,g,b,10);for(let row=8;row<10;row++)for(let col=0;col<10;col++){const q=armorColors[Math.min(4,Math.floor(ac/4))];fill(col,row,armorTile(...q));ac++;}

    // Local fallback plant sprites are also available when an image fails to load.
    const grass = [
      '................','................','....g.......g...',
      '...lg...g..lg...','..lg....lg.lg...','..lg..g.lglg....',
      '...lg.lglg.g....','...lglglg.lg....','....lglg.lg.....',
      '...g.lglglg.....','....g.lglg......','.....glglg......',
      '......lglg......','.....glglg......','......ggg.......','......ggg.......'
    ];
    for (let col=0;col<2;col++) fill(col,11,(x,y)=> {
      const pixel=grass[y][col ? 15-x : x];
      return pixel==='l'?'#83b34c':pixel==='g'?'#5d9135':null;
    });
    for (let col=2;col<4;col++) fill(col,11,(x,y)=> {
      if(y>=8 && (x===7||x===8))return '#5d8b39';
      if(y===12 && x>=4 && x<=7)return '#76a14b';
      const d=Math.abs(x-7.5)+Math.abs(y-6);
      if(d>5)return null;
      if(d<2)return col===2?'#a62325':'#e3bf41';
      return col===2?'#e84835':'#eeeee3';
    });

    // New content keeps the original atlas coordinates and uses the extra rows.
    for(let id=50;id<=73;id++){
      const def=BLOCKS[id];if(!def)continue;
      const rgb=[def.color>>16&255,def.color>>8&255,def.color&255];
      const [col,row]=def.tiles.all;
      fill(col,row,(x,y)=>{
        const noise=pixelNoise(x>>1,y>>1,id);
        const border=id>=66&&(x===0||y===0||x===15||y===15);
        const shine=id>=66&&(x===2||y===2);
        const delta=border?-38:shine?26:(noise-.5)*(id<66?30:18);
        return css(rgb[0]+delta,rgb[1]+delta,rgb[2]+delta);
      });
    }
    fill(12,2,(x,y)=>y%4===0?vary(69,45,28,5):vary(111,75,42,7));
    fill(13,2,(x,y)=>y<2?vary(83,56,31,5):vary(130,91,61,7));
    for(const [row,kind] of [[3,'wheat'],[4,'carrot'],[5,'potato']])for(let stage=0;stage<4;stage++){
      fill(12+stage,row,(x,y)=>{
        const top=13-stage*3;
        if(y<top||y>15)return null;
        const stem=x===4||x===8||x===12;
        if(kind==='wheat'&&stage===3&&y<top+5&&([3,4,5,7,8,9,11,12,13].includes(x)))return vary(210,171,65,10);
        if(stem)return vary(82,132,38,8);
        if((x+y+stage)%5<2&&y>top+2&&x>1&&x<15)return vary(100,158,49,8);
        if(kind==='carrot'&&stage===3&&y>12&&x>5&&x<11)return '#dc822b';
        if(kind==='potato'&&stage===3&&y>12&&x>5&&x<11)return '#ab8b51';
        return null;
      });
    }
    fill(12,6,(x,y)=>x<3||x>12||y<3||y>12?'#45494b':'#a5a490');
    fill(13,6,(x,y)=>x<2||x>13||y<2||y>13?'#45494b':x===4||x===11?'#686558':vary(255,205,87,12));

    for(const [key,def] of Object.entries(ITEMS)){
      const id=Number(key);if(id<300||id>=500)continue;
      const pixels=new Array(256).fill(null),[col,row]=def.tiles.all;
      const dot=(x,y,color)=>{if(x>=0&&x<16&&y>=0&&y<16)pixels[(y|0)*16+(x|0)]=color;};
      const rect=(x,y,w,h,color)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)dot(xx,yy,color);};
      const line=(x0,y0,x1,y1,color)=>{
        const steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
        for(let n=0;n<=steps;n++)dot(Math.round(x0+(x1-x0)*n/(steps||1)),Math.round(y0+(y1-y0)*n/(steps||1)),color);
      };
      const oval=(cx,cy,rx,ry,color)=>{for(let y=0;y<16;y++)for(let x=0;x<16;x++)if((x-cx)**2/(rx*rx)+(y-cy)**2/(ry*ry)<=1)dot(x,y,color);};
      if(id>=400){
        const rgb=[def.color>>16&255,def.color>>8&255,def.color&255];
        oval(8,10,5,3,css(...rgb));rect(6,6,4,5,css(rgb[0]+20,rgb[1]+20,rgb[2]+20));dot(7,6,'#f3ead9');
      }else if(id===300){for(const [x,y] of [[4,8],[9,4],[10,11]]){oval(x,y,2,1,'#719c3e');dot(x,y-1,'#a2be59');}}
      else if(id===301){for(const x of [4,8,12]){line(x,4,x-2,14,'#9a7730');for(let y=3;y<9;y+=2){line(x-2,y,x+1,y+1,'#e4bc55');}}}
      else if(id===302){for(let y=5;y<15;y++)rect(4+Math.floor((y-5)/3),y,7-Math.floor((y-5)/2),1,y%3?'#e38b30':'#ba5d20');line(7,6,5,1,'#4f8c35');line(8,5,11,1,'#74ac42');}
      else if([303,304,305,313].includes(id)){
        oval(8,9,6,4,'#70502d');oval(8,8,5,4,id===303?'#b69c6b':'#d8ae65');
        if(id===313)for(const [x,y] of [[5,6],[9,10],[11,6],[5,10]])rect(x,y,2,2,'#65422a');
        else for(const x of [5,8,11])line(x,6,x-1,8,id===304?'#f0d99d':'#957544');
      }else if(id>=306&&id<=309){
        const meatColors={306:['#74402a','#c38a59'],307:['#552d23','#8a4930'],308:['#825125','#d7a65c'],309:['#603324','#aa653c']};
        const [edge,inside]=meatColors[id];
        oval(7,9,id===308?4:5,4,edge);oval(7,8,id===308?3:4,3,inside);
        if(id!==307){line(10,10,14,12,'#e0d6b7');dot(14,11,'#fff0d1');}
        else{line(4,7,8,6,'#c77c50');line(7,10,10,9,'#b66a42');}
      }
      else if(id===310||id===311){oval(8,8,5,3,id===310?'#7ea6b5':'#b59059');rect(1,5,3,6,id===310?'#527f91':'#795c3f');dot(11,7,'#20252a');line(6,7,9,7,'#d4dbcf');}
      else if(id===312||id===323){oval(8,9,5,4,id===312?'#7b4930':'#292a2d');oval(8,7,3,3,id===312?'#aa7143':'#494b4c');line(8,5,6,11,id===312?'#4a2c22':'#73766d');}
      else if(id===318){for(let y=2;y<14;y++)for(let x=2;x<14;x++)if(x+y>10&&x+y<24&&x>y/2&&x<14-y/3)dot(x,y,x<8?'#a3aab1':'#606b79');line(5,10,11,4,'#d5d9db');line(5,11,10,12,'#373e49');}
      else if(id===314){line(3,12,12,3,'#d8d8bf');line(4,13,13,4,'#faf5db');for(const [x,y] of [[2,11],[4,13],[11,2],[13,4]])rect(x,y,2,2,'#e5e5ce');}
      else if(id===315){for(const [x,y] of [[4,11],[9,10],[7,5]]){oval(x,y,3,2,'#b6baa7');oval(x,y-1,2,1,'#f0f1da');}}
      else if(id===316){for(let n=0;n<3;n++){line(3+n,5+n,12-n,4+n,'#c4c6ba');line(12-n,4+n,11-n,12-n,'#e3e4d9');line(11-n,12-n,3+n,10-n,'#c4c6ba');}}
      else if(id===317){line(3,14,12,2,'#d8caa5');for(let n=0;n<9;n++){line(4+n,12-n,3+n,8-n,'#eff0df');line(4+n,12-n,8+n,11-n,'#c5d0c3');}}
      else if(id===319||id===320){rect(3,2,10,12,id===319?'#c8cbbb':'#6f3d2a');rect(4,3,8,10,id===319?'#ececdf':'#ad6643');for(const y of [5,8,11])line(5,y,10,y,id===319?'#b8bdad':'#ddc895');}
      else if(id===321||id===322){oval(8,9,5,3,id===321?'#828f98':'#ac812b');rect(4,6,8,3,id===321?'#d5dfe0':'#f4cd59');line(5,6,10,6,'#fff2c4');}
      else if(id===324||id===325){line(8,7,8,14,'#518239');line(8,11,4,9,'#6c9c44');oval(8,5,4,3,id===324?'#c54230':'#ebead7');dot(8,5,'#d8b53d');}
      else if(id>=326&&id<=328){rect(3,5,10,8,'#60696d');rect(4,6,8,6,id===326?'#2f383d':id===327?'#3f83da':'#ebe5c9');rect(5,12,6,2,'#a7b7ba');line(3,5,5,2,'#cbd2cb');line(5,2,11,2,'#cbd2cb');line(11,2,13,5,'#cbd2cb');}
      else if(id===329){line(3,2,9,4,'#ba8743');line(9,4,11,8,'#94602c');line(11,8,9,12,'#94602c');line(9,12,3,14,'#ba8743');line(3,2,3,14,'#d1d0bd');}
      else if(id===330){line(2,13,12,3,'#9a7b43');line(3,14,13,4,'#c5a96b');rect(11,2,3,3,'#c9d2d1');line(2,9,6,13,'#dedfce');line(1,11,4,14,'#b9c5be');}
      else if(id===331){line(3,2,11,11,'#c6d2cf');line(12,2,5,11,'#a3b4b1');oval(4,12,3,2,'#778c91');oval(11,12,3,2,'#778c91');dot(4,12,'#26363b');dot(11,12,'#26363b');dot(8,8,'#e3d6a5');}
      else if(id===332||id===333){oval(8,8,6,6,id===332?'#58656c':'#a17b29');oval(8,8,5,5,id===332?'#bcc8c5':'#e6bd4c');oval(8,8,4,4,'#34495e');if(id===332){line(8,3,6,9,'#d5493b');line(6,9,9,12,'#e6e6d8');}else{rect(5,5,7,4,'#83b4d0');rect(6,8,5,3,'#eac459');dot(9,5,'#f5df78');}}
      else if(id===334){line(3,14,10,2,'#77542e');line(4,14,11,2,'#bf8b4d');line(11,2,13,9,'#b4bcb6');rect(12,9,2,3,'#c94b3e');}
      else if(id===335){rect(3,2,10,9,'#687476');rect(4,3,8,9,'#9e7145');rect(5,11,6,2,'#687476');rect(7,13,2,1,'#687476');line(8,3,8,11,'#c9ab70');}
      else if(id===336){oval(6,9,4,4,'#c59026');oval(10,9,4,4,'#efc74d');rect(7,2,2,4,'#76552c');line(9,3,12,2,'#8fab47');dot(4,7,'#fff1a4');}
      fill(col,row,(x,y)=>pixels[y*16+x]);
    }

    function hashCell(cx, cy) { return (cx * 7 + cy * 13) % 5 / 5; }


    // Procedural biome art lives beyond the retained classic pack's 16x16 tile area.
    // A resource node stays opaque while its three collectible icons have distinct silhouettes.
    for(const [resource,def] of BLOCKS.entries()){
      if(!def?.biomeResource)continue;
      const rgb=[def.color>>16&255,def.color>>8&255,def.color&255];
      const [col,row]=def.tiles.all;
      fill(col,row,(x,y)=>{
        const seam=x%7===0||y%7===0;
        const fleck=(x*5+y*11+resource)%17<3;
        return seam?css(rgb[0]*.4,rgb[1]*.4,rgb[2]*.4):fleck
          ?css(rgb[0]*.6+95,rgb[1]*.6+95,rgb[2]*.6+95)
          :vary(rgb[0]*.55,rgb[1]*.55,rgb[2]*.55,10);
      });
    }
    for(let id=91;id<=98;id++){
      const def=BLOCKS[id],rgb=[def.color>>16&255,def.color>>8&255,def.color&255];
      const [col,row]=def.tiles.all;
      fill(col,row,(x,y)=>{
        if(id===96&&(x*3+y*5)%13===0)return null;
        const d=id===94?(x%5===0?-27:0)
          :id===95?((x+y)%9===0?34:0)
          :id===97?(y%6===0?-32:x%5===0?20:0)
          :id===92?(y%5===0?-21:0)
          :id===98?((x-y+16)%7===0?38:-8)
          :((x*7+y*13)%19===0?22:0);
        return vary(rgb[0]+d,rgb[1]+d,rgb[2]+d,8);
      });
    }
    for(const [itemId,def] of Object.entries(ITEMS)){
      if(!def.biome)continue;
      const rgb=[def.color>>16&255,def.color>>8&255,def.color&255];
      const [col,row]=def.tiles.all;
      fill(col,row,(x,y)=>{
        const dx=x-7.5,dy=y-8;
        if(def.variant===0){
          // Fibres, branches and rough shards use a diagonal bundle.
          if(Math.abs(dx+dy)>.9&&Math.abs(dx+dy-3)>.9)return null;
          if(x<3||x>12||y<3||y>13)return null;
        }else if(def.variant===1){
          // Seeds, berries and middle-tier minerals have a compact cluster.
          if((dx*dx/25+dy*dy/16)>1&&((x-6)**2+(y-4)**2)>5)return null;
        }else{
          // The rare find is a faceted, bright crystal or heart.
          if(Math.abs(dx)/5+Math.abs(dy)/7>1)return null;
        }
        const edge=def.variant===2?(dx<0?45:5):((x+y)%3===0?24:-7);
        return css(rgb[0]+edge,rgb[1]+edge,rgb[2]+edge);
      });
    }

    paintMobLoot();
    paintCactus();
    paintFallingTiles();
    ItemArt.paint(canvas,ITEMS);
    texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
  }

  function paintMobLoot(){
    const paint=(col,x,y,color)=>{ctx.fillStyle=color;ctx.fillRect(col*TS+x,22*TS+y,1,1);};
    const rnd=(x,y,seed)=>{
      let n=Math.imul(x+seed*13,374761393)^Math.imul(y+seed*19,668265263);
      n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
    };
    for(const col of [0,1]){
      ctx.clearRect(col*TS,22*TS,TS,TS);
      for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
        const radius=Math.hypot(x-7.5,y-7.5),noise=rnd(x,y,30+col);
        if(radius>(col?6.4:5.8)||(!col&&radius>4.7&&noise>.78))continue;
        const shade=rnd(x>>2,y>>2,35+col);
        if(col===0){
          const n=Math.round(63+shade*65+(noise-.5)*18);
          paint(col,x,y,css(n,n,n+1));
        }else{
          const k=noise>.82?[149,239,134]:noise<.18?[40,121,43]:[79,180,65];
          paint(col,x,y,css(k[0]+shade*12,k[1]+shade*12,k[2]+shade*12));
        }
      }
    }
  }

  function paintFallingTiles() {
    // Original pixel artwork inspired by natural granular sand and gravel.
    // Repaint the same atlas coordinates for both generated and classic packs.
    const hash=(x,y,salt)=>{
      let h=Math.imul(x+salt*17,374761393)^Math.imul(y+salt*31,668265263);
      h=Math.imul(h^(h>>>13),1274126177);
      return ((h^(h>>>16))>>>0)/4294967295;
    };
    const sand=BLOCKS[BLOCK.SAND].tiles.all;
    const gravel=BLOCKS[BLOCK.GRAVEL].tiles.all;
    for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
      const grain=hash(x,y,3),patch=hash(x>>2,y>>2,5),fleck=hash(x,y,7);
      const shade=(patch-.5)*15+(grain-.5)*16;
      const sg=grain<.07?-.28:grain>.93?.22:0;
      const sRGB=[217+shade+sg*35,204+shade+sg*32,158+shade+sg*20];
      if(fleck<.025){sRGB[0]-=28;sRGB[1]-=25;sRGB[2]-=17;}
      ctx.fillStyle=css(...sRGB);
      ctx.fillRect(sand[0]*TS+x,sand[1]*TS+y,1,1);
      // Distinct pebbles of irregular sizes, never a repeating stone grid.
      const pebble=hash((x+((y>>1)&1))>>1,y>>1,13);
      const rough=hash(x,y,17),stonePatch=hash(x>>2,y>>2,19);
      let base=110+stonePatch*31+(rough-.5)*23;
      let rgb=[base,base+1,base+1];
      if(pebble<.20)rgb=[78+rough*17,79+rough*17,81+rough*16];
      else if(pebble>.81)rgb=[148+rough*27,147+rough*27,143+rough*25];
      else if(rough<.085)rgb=[71,72,73];
      else if(rough>.91)rgb=[185,184,179];
      ctx.fillStyle=css(...rgb);
      ctx.fillRect(gravel[0]*TS+x,gravel[1]*TS+y,1,1);
    }
  }

  function paintCactus() {
    const tiles = BLOCKS[39].tiles;
    // Dedicated opaque tiles stay intact when the classic atlas is loaded.
    for (const [face, tile] of Object.entries(tiles)) {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const grain = (x * 13 + y * 7) % 5 - 2;
        let rgb;
        if (face === 'side') {
          const rib = x % 4, spineY = (Math.floor(x / 4) % 2) * 3 + 1;
          rgb = rib === 0 ? [35,91,33] : rib === 1 ? [105,157,55] : [67,127,41];
          if (rib === 2 && y % 7 === spineY) rgb = [31,55,23];
          if (rib === 3 && y % 7 === spineY) rgb = [190,196,113];
        } else {
          const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          rgb = face === 'bottom' ? (ring > 5.5 ? [56,91,32] : [135,141,70])
            : ring > 6.5 ? [36,88,31] : ring > 5.5 ? [103,156,55]
            : ring < 2 ? [164,183,89] : [91,145,45];
        }
        ctx.fillStyle = css(rgb[0] + grain, rgb[1] + grain, rgb[2] + grain);
        ctx.fillRect(tile[0] * TS + x, tile[1] * TS + y, 1, 1);
      }
    }
  }

  function tileUV(col, row) {
    if (gpuCanvas) return {
      u0: (col*32+8.25)/(GRID*32), u1: (col*32+23.75)/(GRID*32),
      v0: 1-(row*32+23.75)/(GRID*32), v1: 1-(row*32+8.25)/(GRID*32)
    };
    const e = 1 / (SIZE*4);
    return {
      u0: col / GRID + e,
      u1: (col + 1) / GRID - e,
      v0: 1 - (row + 1) / GRID + e,
      v1: 1 - row / GRID - e
    };
  }

  function copyGPUTile(col,row) {
    const sx=col*TS, sy=row*TS, x=col*32+8, y=row*32+8;
    gpuContext.clearRect(col*32,row*32,32,32);
    gpuContext.drawImage(canvas,sx,sy,16,16,x,y,16,16);
    gpuContext.drawImage(canvas,sx,sy,1,16,x-8,y,8,16);
    gpuContext.drawImage(canvas,sx+15,sy,1,16,x+16,y,8,16);
    gpuContext.drawImage(canvas,sx,sy,16,1,x,y-8,16,8);
    gpuContext.drawImage(canvas,sx,sy+15,16,1,x,y+16,16,8);
    for(const dx of [0,1])for(const dy of [0,1])
      gpuContext.drawImage(canvas,sx+dx*15,sy+dy*15,1,1,x+(dx?16:-8),y+(dy?16:-8),8,8);
  }

  async function loadClassicPack() {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),5000);
    const loadImage = url => new Promise((resolve,reject) => {
      const img = new Image();
      const timer = setTimeout(()=>reject(new Error('Texture image timed out')),5000);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Texture image unavailable')); };
      img.src = url;
    });
    try {
      const [response, atlas, water] = await Promise.all([
        fetch('img/classic/pack.json?v=v170',{signal:controller.signal}),
        loadImage('img/classic/atlas.png?v=v170'),
        loadImage('img/classic/water.png?v=v170')
      ]);
      if(!response.ok) return false;
      const pack = await response.json();
      if(!Array.isArray(pack.tiles)||atlas.width!==256||atlas.height!==256||water.width!==TS||water.height%TS!==0)return false;
      for(const tile of pack.tiles){
        const [col,row] = tile.at;
        if(!Number.isInteger(col)||!Number.isInteger(row)||col<0||row<0||col>=16||row>=16)return false;
      }
      for(const tile of pack.tiles)ctx.clearRect(tile.at[0]*TS,tile.at[1]*TS,TS,TS);
      ctx.drawImage(atlas,0,0);
      // Redraw mob loot after the optional classic texture pack is applied.
      paintMobLoot();
      paintFallingTiles();
      ItemArt.paint(canvas,ITEMS);
      waterStrip = water;
      // Eight-pixel gutters keep all four mip levels inside their own tile.
      gpuCanvas = document.createElement('canvas');
      gpuCanvas.width = gpuCanvas.height = GRID*32;
      gpuContext = gpuCanvas.getContext('2d');
      gpuContext.imageSmoothingEnabled = false;
      for(let row=0;row<GRID;row++)for(let col=0;col<GRID;col++)copyGPUTile(col,row);
      texture.image = gpuCanvas;
      texture.minFilter = THREE.NearestMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      for(const id of Object.keys(iconCache))delete iconCache[id];
      return true;
    } catch (_) {
      gpuCanvas = gpuContext = waterStrip = null;
      texture.image = canvas;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      return false; // The generated atlas remains fully playable offline.
    } finally {
      clearTimeout(timeout);
    }
  }

  function animate(dt) {
    if(!waterStrip||dt<=0)return;
    waterElapsed += dt;
    if(waterElapsed<.125)return;
    const frames = waterStrip.height / TS;
    waterFrame = (waterFrame+Math.floor(waterElapsed/.125))%frames;
    waterElapsed %= .125;
    ctx.clearRect(5*TS,TS,TS,TS);
    ctx.drawImage(waterStrip,0,waterFrame*TS,TS,TS,5*TS,TS,TS,TS);
    copyGPUTile(5,1);
    texture.needsUpdate = true;
  }

  function decorTile(kind) {
    return tileUV(({grass:0,fern:1,poppy:2,daisy:3})[kind]??0,11);
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
    if(B.shape==='slab'||B.shape==='stair'||B.shape==='door'||B.shape==='doorTop'){
      const drawTile=(tile,x,y,w,h)=>{
        g.drawImage(canvas,tile[0]*TS,tile[1]*TS,TS,TS,x,y,w,h);
      };
      if(B.shape==='slab'){
        drawTile(sideTile,5,24,38,15);
        g.fillStyle='rgba(23,28,34,.25)';g.fillRect(5,35,38,4);
        drawTile(B.tiles.top||sideTile,8,19,33,8);
      }else if(B.shape==='stair'){
        drawTile(sideTile,5,28,37,12);
        drawTile(sideTile,22,15,20,14);
        g.fillStyle='rgba(17,23,26,.30)';g.fillRect(5,36,37,4);
      }else{
        drawTile(sideTile,14,3,20,42);
        g.fillStyle='rgba(16,24,28,.40)';g.fillRect(14,42,20,3);
      }
      iconCache[id]=c.toDataURL();return iconCache[id];
    }
    const draw = (tile, m, dark) => {
      g.save();
      const inset = B.shape === 'cactus' ? .875 : 1;
      g.setTransform(m[0] * inset, m[1], m[2] * inset, m[3],
        24 + (m[4] - 24) * inset, m[5]);
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
    // Original 9px sprites: dark outline, a bright highlight and a shaded edge.
    const heart = [
      '.OO...OO.',
      'OHHHOHHHO',
      'OHLHHHLHO',
      'OHLLLLLLO',
      'OSLLLLLSO',
      '.OSLLLSO.',
      '..OSLSO..',
      '...OSO...',
      '....O....'
    ];
    const drumstick = [
      '..OOO....',
      '.OHHHO...',
      'OHLLLHO..',
      'OSLLLHO..',
      'OSLLLSO..',
      '.OSSSOBO.',
      '..OOOBWBO',
      '.....OBBO',
      '......OO.'
    ];
    const bubble = [
      '..XXX..', '.XXXXX.', 'XXOXXXX', 'XXXXXXX',
      'XXXXXXX', '.XXXXX.', '..XXX..'
    ];
    const make = (pattern, colors, half = null) => {
      const c = document.createElement('canvas');
      c.width = pattern[0].length;
      c.height = pattern.length;
      const g = c.getContext('2d');
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const ch = pattern[y][x];
        const empty = half && (half === 'left' ? x > 4 : x < 4);
        const color = empty && ch !== 'O' && ch !== '.' ? colors.empty : colors[ch];
        if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
      }
      return c.toDataURL();
    };
    const heartColors = { O:'#1b0b10', H:'#ff9696', L:'#f22d3b', S:'#a40e20', empty:'#35252b' };
    const foodColors = { O:'#20100c', H:'#e9b17b', L:'#b96b35', S:'#783815', B:'#d9c9a2', W:'#fff5d7', empty:'#382b23' };
    const emptyColors = colors => Object.fromEntries(Object.entries(colors).map(([key,value]) =>
      [key, key === 'O' ? value : colors.empty]));
    hudCache = {
      heart: make(heart, heartColors),
      heartHalf: make(heart, heartColors, 'left'),
      heartEmpty: make(heart, emptyColors(heartColors)),
      food: make(drumstick, foodColors),
      foodHalf: make(drumstick, foodColors, 'right'),
      foodEmpty: make(drumstick, emptyColors(foodColors)),
      bubble: make(bubble, { X:'#55aef0', O:'#cfe8ff' })
    };
    return hudCache;
  }

  return {
    init, loadClassicPack, animate, decorTile, tileUV, tileFor, blockIcon, hudIcons,
    getTexture: () => texture,
    getAtlas: () => canvas
  };
})();
