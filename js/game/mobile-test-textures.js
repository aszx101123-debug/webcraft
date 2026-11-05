'use strict';

const Textures = (() => {
  const TS=16, GRID=12, SIZE=TS*GRID;
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
    fill(0,0,(x,y)=>{
      const v=pixelNoise(x,y,1), blade=((x*3+y*7)%17===0);
      if(blade)return vary(119,167,66,6);
      if(v<.12)return vary(60,105,46,9);
      if(v>.87)return vary(104,151,56,8);
      return vary(79,135,58,8);
    });
    fill(1,0,(x,y)=>{
      const top=2+(pixelNoise(x,0,41)>.55?1:0);
      if(y<top)return css(80+(x%3)*7,141+(x%4)*4,57+(x%2)*4);
      if(y<top+2&&pixelNoise(x,y,4)>.35)return vary(89,128,57,8);
      const n=pixelNoise(x,y,12);
      return n<.13?vary(82,58,41,7):n>.88?vary(154,108,70,9):vary(127,91,62,9);
    });
    fill(2,0,(x,y)=>{
      const n=pixelNoise(x,y,12);
      if(n<.12)return vary(87,65,48,5);
      if(n>.9)return vary(160,115,71,6);
      return vary(126,90,62,10);
    });
    fill(3,0,(x,y)=>{
      const n=pixelNoise(x,y,27), dark=(x+y*3)%17===0;
      if(dark||n<.12)return vary(86,92,97,5);
      if(n>.83)return vary(151,158,161,9);
      return vary(120,128,131,6);
    });
    fill(4,0,(x,y)=>{
      const sx=Math.floor((x+((y>>2)&1)*2)/5),sy=Math.floor(y/4);
      const n=pixelNoise(sx,sy,3);
      const line=(y%4===0)||((x+((y>>2)&1)*2)%5===0);
      if(line)return vary(60,66,70,5);
      const v=106+n*48;
      return vary(v,v+1,v+3,7);
    });
    fill(5,0,(x,y)=>{
      const n=pixelNoise(x,y,22), grain=y%7===0;
      if(grain)return vary(202,190,145,7);
      if(n<.12)return vary(187,177,135,6);
      if(n>.87)return vary(240,229,188,6);
      return vary(218,207,166,5);
    });
    fill(0,1,(x,y)=>{
      const n=pixelNoise(x,y,50);
      if(n<.17 || ((x+y*3)%13===0))return null;
      if(n>.83)return vary(119,168,74,8);
      if(n<.34)return vary(37,92,35,8);
      return vary(67,125,55,8);
    });
    fill(1,1,(x,y)=>{
      const joint=(y%4===0)||(x===((Math.floor(y/4)%2)*7+3)%16);
      if(joint)return vary(100,75,48,4);
      if((x*7+y*13)%29===0)return vary(204,167,110,5);
      return vary(165,130,82,8);
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

    const armorColors=[[150,105,75],[120,125,135],[190,195,205],[220,180,55],[95,220,245]];let ac=0;const armorTile=(r,g,b)=>(x,y)=>vary(r,g,b,10);for(let row=8;row<10;row++)for(let col=0;col<10;col++){const q=armorColors[Math.min(4,Math.floor(ac/4))];fill(col,row,armorTile(...q));ac++;}

    function hashCell(cx, cy) { return (cx * 7 + cy * 13) % 5 / 5; }

    texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 1;
  }

  function tileUV(col, row) {
    const e = 1 / (SIZE*4);
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
