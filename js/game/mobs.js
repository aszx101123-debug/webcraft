'use strict';

const Mobs = (() => {
  let scene = null, group = null;
  let mobs = [];
  let arrows = [];
  let env = { night: false, brightness: 1 };
  let mode = GAME_MODE.CREATIVE;
  let spawnTimer = 3;
  let lastPlayerAttackAt = -Infinity;
  let lastAttackResult = null;
  let onEvent = null;

  function init(scene_) {
    scene = scene_;
    group = new THREE.Group();
    scene.add(group);
  }

  function reset() {
    if (!group) return;
    while(mobs.length)removeMob(mobs.length-1);
    while(arrows.length)removeArrow(arrows.length-1);
    spawnTimer = 3;
    lastPlayerAttackAt = -Infinity;
    lastAttackResult = null;
  }

  function setEnv(night, brightness) { env.night = night; env.brightness = brightness; }
  function setMode(m) { mode = m; }

  // An original procedurally-generated 16×16 texture gives each surface small
  // pixel-level color variation without loading external assets or copying textures.
  const mobTextureCache=new Map();
  function pixelTexture(color){
    if(mobTextureCache.has(color))return mobTextureCache.get(color);
    if(typeof document==='undefined'||typeof THREE.CanvasTexture!=='function')return null;
    const canvas=document.createElement('canvas');
    canvas.width=16;canvas.height=16;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    let seed=(color^0x71e9a63)>>>0;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      seed=(Math.imul(seed^((x+3)*17+(y+7)*41),1664525)+1013904223)>>>0;
      const edge=(x===0||y===0||x===15||y===15)?-.07:0;
      const grain=((seed>>>22)%24)/255;
      const v=Math.max(170,Math.min(255,Math.round(233+edge*255+grain*255-12)));
      ctx.fillStyle='rgb('+v+','+v+','+v+')';
      ctx.fillRect(x,y,1,1);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.encoding=THREE.sRGBEncoding;
    texture.magFilter=THREE.NearestFilter;
    texture.minFilter=THREE.NearestFilter;
    texture.generateMipmaps=false;
    mobTextureCache.set(color,texture);
    return texture;
  }
  function mat(color) {
    const texture=pixelTexture(color);
    return new THREE.MeshLambertMaterial(texture?{color,map:texture}:{color});
  }
  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
  }

  function buildMob(type) {
    const g = new THREE.Group();
    const parts = { legs: [], arms: [], extraLegs: [], eyes: [], head: null, healthBar: null, detailGroup: null };
    const limb = (w, h, d, color, x, y, z) => {
      const l = box(w, h, d, color, x, y, z);
      parts.legs.push(l);
      g.add(l);
      return l;
    };
    const sphere = (r, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = box(2*r*sx,2*r*sy,2*r*sz,color,x,y,z);
      g.add(m);
      return m;
    };
    const cone = (r, h, color, x, y, z, rotX = 0, rotZ = 0) => {
      const m = box(r*1.65,h,r*1.65,color,x,y,z);
      m.rotation.x=rotX;m.rotation.z=rotZ;
      g.add(m);
      return m;
    };
    const eye = (x, y, z, color = 0x1b1b1b, w = .08, h = .08) => {
      const pupil=box(w,h,.035,color,x,y,z);
      g.add(pupil);
      parts.eyes.push(pupil);
    };

    if (type === 'pig') {
      g.add(box(1.0, .58, .72, 0xe69aa8, 0, .62, 0));
      g.add(box(.66, .46, .5, 0xeea9b4, 0, .68, .46));
      g.add(box(.3, .16, .09, 0xc97988, 0, .59, .71));
      g.add(box(.045, .06, .025, 0x9e5968, .07, .61, .755));
      g.add(box(.045, .06, .025, 0x9e5968, -.07, .61, .755));
      eye(.16, .76, .69); eye(-.16, .76, .69);
      cone(.12, .16, 0xd98492, .24, .88, .35, .35, -.25);
      cone(.12, .16, 0xd98492, -.24, .88, .35, .35, .25);
      limb(.18, .34, .18, 0xcf808e, .29, .17, .24);
      limb(.18, .34, .18, 0xcf808e, -.29, .17, .24);
      limb(.18, .34, .18, 0xcf808e, .29, .17, -.24);
      limb(.18, .34, .18, 0xcf808e, -.29, .17, -.24);
      const tail = new THREE.Mesh(new THREE.TorusGeometry(.09, .025, 6, 10, Math.PI * 1.5), mat(0xc97988));
      tail.position.set(-.56, .65, -.24);
      tail.rotation.y = Math.PI / 2;
      g.add(tail);
    } else if (type === 'cow') {
      g.add(box(1.08, .74, .82, 0x5b3d2b, 0, .92, 0));
      g.add(box(.52, .58, .46, 0x6f4a34, 0, 1.08, .56));
      g.add(box(.31, .18, .1, 0xd2c8b8, 0, .94, .8));
      sphere(.14, 0x352317, .28, 1.0, .05, .85, 1.1, .45);
      sphere(.13, 0x352317, -.3, 1.18, -.12, .8, 1, .45);
      sphere(.11, 0x352317, .2, .72, .2, .75, 1.1, .45);
      eye(.14, 1.21, .78); eye(-.14, 1.21, .78);
      cone(.1, .2, 0xe5dcc9, .2, 1.48, .45, 0, -.35);
      cone(.1, .2, 0xe5dcc9, -.2, 1.48, .45, 0, .35);
      g.add(box(.12, .16, .22, 0x6a4c36, .3, 1.3, .35));
      g.add(box(.12, .16, .22, 0x6a4c36, -.3, 1.3, .35));
      limb(.2, .62, .2, 0x463021, .35, .31, .28);
      limb(.2, .62, .2, 0x463021, -.35, .31, .28);
      limb(.2, .62, .2, 0x463021, .35, .31, -.28);
      limb(.2, .62, .2, 0x463021, -.35, .31, -.28);
      g.add(box(.16, .11, .2, 0xc98e92, .2, .33, .25));
      g.add(box(.16, .11, .2, 0xc98e92, -.2, .33, .25));
    } else if (type === 'sheep') {
      g.add(box(.98, .76, .78, 0xe9e8df, 0, .94, 0));
      g.add(box(.42, .44, .44, 0x8f7867, 0, 1.08, .55));
      g.add(box(.34, .25, .25, 0xd9d2c7, 0, 1.16, .8));
      eye(.11, 1.17, .79, 0x141414, .06, .09); eye(-.11, 1.17, .79, 0x141414, .06, .09);
      sphere(.11, 0xd9d2c7, .25, 1.28, .48, .7, .8, .7);
      sphere(.11, 0xd9d2c7, -.25, 1.28, .48, .7, .8, .7);
      sphere(.16, 0xf4f2eb, .32, 1.27, .18, .8, .7, .8);
      sphere(.16, 0xf4f2eb, -.32, 1.27, .18, .8, .7, .8);
      limb(.16, .56, .16, 0x7a6658, .3, .28, .25);
      limb(.16, .56, .16, 0x7a6658, -.3, .28, .25);
      limb(.16, .56, .16, 0x7a6658, .3, .28, -.25);
      limb(.16, .56, .16, 0x7a6658, -.3, .28, -.25);
    } else if (type === 'chicken') {
      g.add(box(.46, .46, .58, 0xe7e1d6, 0, .5, 0));
      g.add(box(.31, .38, .3, 0xf0e9dd, 0, .78, .29));
      g.add(box(.13, .1, .14, 0xe3a038, 0, .7, .48));
      g.add(box(.08, .14, .08, 0xc9463e, 0, .99, .27));
      g.add(box(.07, .1, .06, 0xc9463e, 0, .62, .46));
      eye(.1, .87, .43, 0x151515, .055, .055);
      eye(-.1, .87, .43, 0x151515, .055, .055);
      g.add(box(.12, .22, .05, 0xd9d1c7, .28, .54, .02));
      g.add(box(.12, .22, .05, 0xd9d1c7, -.28, .54, .02));
      limb(.065, .24, .065, 0xd8a03a, .11, .12, .02);
      limb(.065, .24, .065, 0xd8a03a, -.11, .12, .02);
      cone(.08, .18, 0xe7e1d6, 0, .56, -.32, Math.PI / 2, 0);
    } else if (type === 'zombie') {
      limb(.23, .72, .23, 0x263e5d, .14, .36, 0);
      limb(.23, .72, .23, 0x263e5d, -.14, .36, 0);
      g.add(box(.58, .76, .34, 0x3d7a6c, 0, 1.08, 0));
      g.add(box(.5, .48, .48, 0x5d9b4e, 0, 1.7, 0));
      g.add(box(.18, .16, .42, 0x314f8b, .28, .99, .03));
      g.add(box(.18, .16, .42, 0x314f8b, -.28, .99, .03));
      g.add(box(.63, .06, .06, 0x8a6a43, 0, .76, -.18));
      eye(.12, 1.74, .25, 0x9cff68, .085, .08); eye(-.12, 1.74, .25, 0x9cff68, .085, .08);
      g.add(box(.22, .06, .06, 0x2b4435, 0, 1.55, .25));
      g.add(box(.18, .2, .2, 0x5d9b4e, .34, 1.06, .12));
      g.add(box(.18, .2, .2, 0x5d9b4e, -.34, 1.06, .12));
    } else if (type === 'skeleton') {
      limb(.14, .72, .14, 0xd8d6cc, .12, .36, 0);
      limb(.14, .72, .14, 0xd8d6cc, -.12, .36, 0);
      g.add(box(.42, .7, .24, 0xdcdad0, 0, 1.08, 0));
      g.add(box(.44, .44, .44, 0xe6e4da, 0, 1.68, 0));
      eye(.11, 1.73, .23, 0x262018, .07, .08); eye(-.11, 1.73, .23, 0x262018, .07, .08);
      g.add(box(.06, .48, .06, 0xc5c2ba, 0, 1.2, .16));
      g.add(box(.05, .38, .06, 0xc5c2ba, .16, 1.2, .17));
      g.add(box(.05, .38, .06, 0xc5c2ba, -.16, 1.2, .17));
      g.add(box(.06, .58, .06, 0x6b4a2a, .42, 1.22, .44));
      const bow = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 5, 12, Math.PI), mat(0x7d5730));
      bow.position.set(.38, 1.28, .43);
      bow.rotation.x = Math.PI / 2;
      g.add(bow);
      g.add(box(.02, .04, .54, 0xd7d2c7, .38, 1.28, .44));
      g.add(box(.12, .12, .48, 0xd7d2c7, .29, 1.25, .2));
      g.add(box(.12, .12, .48, 0xd7d2c7, -.29, 1.25, .2));
    } else if (type === 'spider') {
      g.add(box(.96, .5, 1.08, 0x25242b, 0, .5, -.08));
      g.add(box(.5, .4, .54, 0x36343d, 0, .46, .6));
      g.add(box(.64, .18, .62, 0x16151a, 0, .58, -.1));
      eye(.14, .52, .89, 0xe04a43, .08, .08); eye(-.14, .52, .89, 0xe04a43, .08, .08);
      eye(.05, .42, .91, 0x9b302f, .055, .06); eye(-.05, .42, .91, 0x9b302f, .055, .06);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * .66, z = sz * .28;
        const a = box(.72, .08, .08, 0x17161b, x, .42, z);
        a.rotation.y = sz * .18;
        parts.legs.push(a);
        g.add(a);
        const tip = box(.42, .07, .07, 0x17161b, sx * .9, .29, sz * .5);
        tip.rotation.z = sx * .42;
        tip.rotation.y = sz * .22;
        parts.legs.push(tip);
        g.add(tip);
      }
      g.add(box(.14, .1, .08, 0xb72e31, .08, .25, .94));
      g.add(box(.14, .1, .08, 0xb72e31, -.08, .25, .94));
    }
    // Pixel-overlaid details and animated shoulder/hip joints for each species.
    const detailGroup=new THREE.Group();
    g.add(detailGroup);
    parts.detailGroup=detailGroup;
    const detail=(w,h,d,col,x,y,z)=>{
      const p=box(w,h,d,col,x,y,z);detailGroup.add(p);return p;
    };
    const patch=(x,y,z,w,h,color)=>{
      const p=detail(w,h,.018,color,x,y,z);return p;
    };
    const legJoint=(mesh)=>{
      const base=mesh.position.clone();
      const height=mesh.geometry?.parameters?.height||.4;
      const pivot=new THREE.Group();
      pivot.position.set(base.x,base.y+height*.5,base.z);
      g.remove(mesh);
      mesh.position.set(0,-height*.5,0);
      pivot.add(mesh);
      g.add(pivot);
      return pivot;
    };
    if(type!=='spider')parts.legs=parts.legs.map(legJoint);
    const makeArm=(x,y,z,color,sleeveColor,raised=0)=>{
      const pivot=new THREE.Group();
      pivot.position.set(x,y,z);
      pivot.rotation.x=raised;
      pivot.userData.baseX=raised;
      const sleeve=box(.17,.29,.20,sleeveColor,0,-.16,0);
      const arm=box(.16,.37,.18,color,0,-.48,0);
      const cuff=box(.18,.045,.20,0x303c46,0,-.34,.004);
      pivot.add(sleeve,arm,cuff);
      g.add(pivot);
      parts.arms.push(pivot);
      return pivot;
    };
    if(type==='pig'){
      patch(.0,.87,.725,.10,.06,0xffddce);
      patch(-.21,.71,.707,.035,.035,0xfdf0e3);
      patch(.21,.71,.707,.035,.035,0xfdf0e3);
      patch(-.22,.6,.763,.07,.045,0xb8697e);
      patch(.22,.6,.763,.07,.045,0xb8697e);
      detail(.15,.09,.16,0xffb6c3,-.245,.93,.35);
      detail(.15,.09,.16,0xffb6c3,.245,.93,.35);
      for(const sx of [-1,1]){
        detail(.19,.075,.20,0x7d5360,sx*.29,.07,.25);
        detail(.19,.075,.20,0x7d5360,sx*.29,.07,-.25);
      }
    }else if(type==='cow'){
      for(const [px,py,pz,w,h] of [
        [-.27,.97,.42,.24,.25],[.34,1.0,.42,.21,.19],
        [-.18,.87,-.421,.25,.30],[.30,1.08,-.421,.27,.25]
      ])patch(px,py,pz,w,h,0x312921);
      patch(0,1.0,.812,.18,.09,0xeab3b0);
      for(const sx of [-1,1]){
        detail(.1,.1,.12,0x372a22,sx*.17,.37,.40);
        patch(sx*.14,1.23,.795,.035,.045,0xe8ebed);
      }
    }else if(type==='sheep'){
      for(const x of [-.31,0,.31])for(const z of [-.25,.12,.39]){
        if(z===.39&&x===0)continue;
        detail(.27,.23,.26,((x+z)>0)?0xf4f1e7:0xd3d8d2,x,1.33,z);
      }
      for(const sx of [-1,1])for(const z of [-.24,.24]){
        detail(.19,.14,.19,0xe6e9e0,sx*.34,.68,z);
        detail(.18,.12,.18,0x524840,sx*.30,.065,z);
      }
      patch(0,1.03,.942,.065,.045,0x302b27);
    }else if(type==='chicken'){
      detail(.34,.17,.28,0xf4f1e9,0,.46,-.43);
      for(const sx of [-1,1]){
        detail(.15,.29,.09,0xd4d8d2,sx*.28,.58,-.04);
        detail(.12,.055,.16,0xdca542,sx*.11,.08,.17);
      }
      detail(.10,.1,.12,0xecaf4c,0,.73,.55);
      detail(.06,.06,.07,0xffede0,-.10,.88,.443);
      detail(.06,.06,.07,0xffede0,.10,.88,.443);
    }else if(type==='zombie'){
      makeArm(-.40,1.43,.10,0x669c63,0x3e7e79,-.85);
      makeArm(.40,1.43,.10,0x669c63,0x3e7e79,-.85);
      patch(0,1.25,.184,.42,.065,0x4e938a);
      patch(-.15,.98,.19,.18,.20,0x2f5952);
      patch(.20,1.05,.19,.13,.13,0x6faca0);
      patch(0,1.81,.247,.36,.075,0x6cae62);
      patch(-.13,1.58,.253,.085,.045,0x2a3c28);
      patch(.13,1.58,.253,.085,.045,0x2a3c28);
      for(const sx of [-1,1]){
        patch(sx*.14,.62,.126,.1,.14,0x1d3049);
        patch(sx*.14,.14,.126,.12,.1,0x253447);
      }
    }else if(type==='skeleton'){
      makeArm(-.33,1.45,.04,0xdcd8c8,0xd8d4c8,-.52);
      makeArm(.33,1.45,.04,0xdcd8c8,0xd8d4c8,-.52);
      // Exposed vertebrae, rib lines, jaw and facial shading.
      detail(.11,.68,.1,0xbab9ad,0,1.06,.15);
      for(const y of [.93,1.04,1.15,1.26]){
        patch(0,y,.185,.35,.048,0xc4c5b9);
        for(const sx of [-1,1])detail(.04,.09,.07,0x888b85,sx*.17,y,.145);
      }
      detail(.32,.09,.25,0xc9c5b9,0,1.44,.055);
      patch(0,1.57,.238,.12,.04,0x4e4840);
      patch(-.11,1.69,.252,.10,.11,0x201f23);
      patch(.11,1.69,.252,.10,.11,0x201f23);
      detail(.025,.48,.025,0xd5d0b6,.40,1.30,.61);
      for(const sx of [-1,1])patch(sx*.12,.30,.079,.045,.17,0xb8b7af);
    }else if(type==='spider'){
      // Four additional articulated legs complete the eight-legged silhouette.
      for(const sx of [-1,1])for(const z of [-.47,.44]){
        const hip=new THREE.Group();
        hip.position.set(sx*.47,.5,z);
        const upper=box(.50,.09,.08,0x292833,sx*.25,-.005,0);
        upper.rotation.z=sx*.20;
        const joint=box(.14,.12,.16,0x3d3847,sx*.51,-.12,0);
        const foot=box(.10,.34,.095,0x201f26,sx*.62,-.26,0);
        hip.add(upper,joint,foot);
        g.add(hip);
        parts.extraLegs.push(hip);
      }
      for(const x of [-.24,0,.24])for(const z of [-.32,-.08,.18]){
        detail(.11,.035,.12,0x514552,x,.77,z);
      }
      patch(-.14,.54,.929,.09,.1,0xff7563);
      patch(.14,.54,.929,.09,.1,0xff7563);
    }
    const health=new THREE.Group();
    health.position.set(0,(MOB_DEFS[type]?.height||1.2)+.27,0);
    const bg=box(.76,.075,.025,0x171b26,0,0,0);
    const fill=box(.72,.048,.029,0x8edc80,0,0,.01);
    health.add(bg,fill);
    health.visible=false;
    g.add(health);
    parts.healthBar={group:health,fill};
    return { mesh: g, parts };
  }
  function spawn(type, x, y, z) {
    if (!group) return null;
    const def = MOB_DEFS[type];
    const built = buildMob(type);
    built.mesh.position.set(x, y, z);
    group.add(built.mesh);
    const m = {
      type, def, hp: def.hp,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      mesh: built.mesh, parts: built.parts,
      dir: new THREE.Vector3(0, 0, 1),
      moving: false, onGround: false,
      wanderT: Math.random() * 2, wanderMoving: false, grazeT: 2+Math.random()*6,
      blinkT: 2+Math.random()*4, blinkDuration: 0,
      attackT: 0, shootT: 1 + Math.random() * 2,
      strafeT: 2, strafeDir: 1, hurtT: 0, flashed: false,
      hurtGrace: 0, healthVisibleT: 0, provokedT: 0,
      burnT: 0, fleeT: 0, animT: 0, jumpT: 0, pathT: 0,
      dead: false, deadT: 0
    };
    mobs.push(m);
    return m;
  }

  function removeMob(i) {
    group.remove(mobs[i].mesh);
    mobs[i].mesh.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      if(o.material){
        for(const material of (Array.isArray(o.material)?o.material:[o.material]))
          if(material?.dispose)material.dispose();
      }
    });
    mobs.splice(i,1);
  }

  function collideBox(m, axis, dist) {
    if (!dist) return false;
    const halfW = m.def.width / 2, hgt = m.def.height;
    m.pos[axis] += dist;
    const x0 = Math.floor(m.pos.x - halfW), x1 = Math.floor(m.pos.x + halfW);
    const y0 = Math.floor(m.pos.y), y1 = Math.floor(m.pos.y + hgt - 1e-4);
    const z0 = Math.floor(m.pos.z - halfW), z1 = Math.floor(m.pos.z + halfW);
    let hit = false;
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      if (!isSolidBlock(World.getBlock(bx, by, bz))) continue;
      hit = true;
      if (axis === 'y') {
        if (dist < 0) m.pos.y = Math.max(m.pos.y, by + 1), m.onGround = true;
        else m.pos.y = Math.min(m.pos.y, by - hgt - 1e-3);
      } else if (axis === 'x') {
        m.pos.x = dist > 0 ? Math.min(m.pos.x, bx - halfW - 1e-3) : Math.max(m.pos.x, bx + 1 + halfW + 1e-3);
      } else {
        m.pos.z = dist > 0 ? Math.min(m.pos.z, bz - halfW - 1e-3) : Math.max(m.pos.z, bz + 1 + halfW + 1e-3);
      }
    }
    return hit;
  }

  function flash(m, on) {
    m.flashed = on;
    m.mesh.traverse(o => {
      if (!o.material) return;
      if (on) {
        if (o.userData.baseColor === undefined) o.userData.baseColor = o.material.color.getHex();
        o.material.color.setHex(0xff5555);
      } else if (o.userData.baseColor !== undefined) {
        o.material.color.setHex(o.userData.baseColor);
      }
    });
  }

  function hurtMob(m, dmg, knockFrom) {
    if (m.dead || m.hurtGrace > 0) return false;
    m.hurtGrace = .33;
    m.healthVisibleT = 1.8;
    m.hp -= dmg;
    m.hurtT = .18;
    flash(m, true);
    if (knockFrom) {
      const dx = m.pos.x - knockFrom.x, dz = m.pos.z - knockFrom.z;
      const l = Math.hypot(dx, dz) || 1;
      m.vel.x += dx / l * 6;
      m.vel.z += dz / l * 6;
      m.vel.y = Math.max(m.vel.y, 4.5);
    }
    if (!m.def.hostile) m.fleeT = 4;
    if (m.type==='spider')m.provokedT=7;
    if (onEvent) onEvent('hurt', m);
    if (m.hp <= 0) {
      m.dead = true;
      m.deadT = .35;
      if (onEvent) onEvent('die', m);
    }
    return true;
  }

  function dropLoot(m) {
    if (mode === GAME_MODE.CREATIVE) return;
    (m.def.drops || []).forEach(d => {
      if (d.chance && Math.random() > d.chance) return;
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) Drops.spawn(d.id, n, m.pos.x, m.pos.y + .4, m.pos.z);
    });
  }

  function rayBox(o, d, min, max) {
    let t0 = 0, t1 = Infinity;
    for (const axis of ['x', 'y', 'z']) {
      if (Math.abs(d[axis]) < 1e-9) {
        if (o[axis] < min[axis] || o[axis] > max[axis]) return null;
        continue;
      }
      const inv = 1 / d[axis];
      let ta = (min[axis] - o[axis]) * inv;
      let tb = (max[axis] - o[axis]) * inv;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return null;
    }
    return t0;
  }

  function tryAttack(eye, dir, reach) {
    let best = null, bestT = Infinity;
    for (const m of mobs) {
      if (m.dead) continue;
      const halfW = m.def.width / 2;
      const t = rayBox(eye, dir,
        { x: m.pos.x - halfW, y: m.pos.y, z: m.pos.z - halfW },
        { x: m.pos.x + halfW, y: m.pos.y + m.def.height, z: m.pos.z + halfW });
      if (t !== null && t < reach && t < bestT) { bestT = t; best = m; }
    }
    if (best) {
      // Consistent, visible cooldown instead of applying damage on every click.
      const now=performance.now();
      const charge=Math.max(0,Math.min(1,(now-lastPlayerAttackAt)/450));
      if(now-lastPlayerAttackAt<450){
        lastAttackResult={target:best,landed:false,reason:'recharge',charge,damage:0};
        return best;
      }
      if(!hasLineOfSight(eye,{x:best.pos.x,y:best.pos.y+best.def.height*.64,z:best.pos.z})){
        lastAttackResult={target:best,landed:false,reason:'blocked',charge,damage:0};
        return null;
      }
      lastPlayerAttackAt=now;
      const tool=Inventory.selectedTool();
      const damage=tool&&Number.isFinite(tool.attackDamage)
        ? tool.attackDamage:SURVIVAL.FIST_DMG;
      const landed=hurtMob(best,damage,Player.pos);
      if(landed&&tool){
        Inventory.damageSelectedTool(1);
        UI.renderHotbar();
      }
      lastAttackResult={target:best,landed,
        reason:landed?'hit':'hurt-grace',charge,damage:landed?damage:0};
      return best;
    }
    return null;
  }


  function hasLineOfSight(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / .45));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = Math.floor(from.x + dx * t);
      const y = Math.floor(from.y + dy * t);
      const z = Math.floor(from.z + dz * t);
      if (isSolidBlock(World.getBlock(x, y, z))) return false;
    }
    return true;
  }

  function shootArrow(m) {
    const from = new THREE.Vector3(m.pos.x, m.pos.y + m.def.height * .78, m.pos.z);
    const to = new THREE.Vector3(Player.pos.x, Player.pos.y + 1.1, Player.pos.z);
    const dir = to.sub(from).normalize();
    const vel = dir.multiplyScalar(19);
    vel.y += 1.4;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .55), mat(0x9a7a4a));
    mesh.position.copy(from);
    group.add(mesh);
    arrows.push({ pos: from.clone(), vel, mesh, life: 5 });
    if (onEvent) onEvent('shoot', m);
  }

  function surfaceY(x, z) {
    for (let y = CONFIG.HEIGHT - 1; y > 0; y--) {
      const id = World.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) return y;
    }
    return 0;
  }

  function skyExposed(m) {
    const bx = Math.floor(m.pos.x), bz = Math.floor(m.pos.z);
    const from = Math.ceil(m.pos.y + m.def.height);
    for (let y = from; y < Math.min(CONFIG.HEIGHT, from + 14); y++) {
      if (isSolidBlock(World.getBlock(bx, y, bz))) return false;
    }
    return true;
  }

  function trySpawn(category) {
    const pp = Player.pos;
    const ang = Math.random() * Math.PI * 2;
    const dist = 22 + Math.random() * (category === 'hostile' ? 16 : 26);
    const x = Math.floor(pp.x + Math.cos(ang) * dist);
    const z = Math.floor(pp.z + Math.sin(ang) * dist);
    if (!World.getChunk(x >> 4, z >> 4)) return;
    const y = surfaceY(x, z);
    if (y <= 1) return;
    const top = World.getBlock(x, y, z);
    if (World.getBlock(x, y + 1, z) !== BLOCK.AIR || World.getBlock(x, y + 2, z) !== BLOCK.AIR) return;
    if (category === 'hostile') {
      if (!isSolidBlock(top) || top === BLOCK.LEAVES) return;
      const r = Math.random();
      spawn(r < .45 ? 'zombie' : r < .75 ? 'skeleton' : 'spider', x + .5, y + 1, z + .5);
    } else {
      if (top !== BLOCK.GRASS) return;
      const r = Math.random();
      spawn(r < .3 ? 'pig' : r < .55 ? 'cow' : r < .8 ? 'sheep' : 'chicken', x + .5, y + 1, z + .5);
    }
  }

  function lerpAngle(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function update(dt, active) {
    if (!group) return;
    const pp = Player.pos;
    const survival = mode === GAME_MODE.SURVIVAL;

    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];

      if (m.dead) {
        m.deadT -= dt;
        m.mesh.scale.setScalar(Math.max(m.deadT / .35, .02));
        m.mesh.position.copy(m.pos);
        if (m.deadT <= 0) {
          dropLoot(m);
          removeMob(i);
        }
        continue;
      }
      if (!active) continue;

      const dx = pp.x - m.pos.x, dz = pp.z - m.pos.z;
      const distXZ = Math.hypot(dx, dz);
      const dist = Math.sqrt(dx * dx + dz * dz + (pp.y - m.pos.y) ** 2);

      if (dist > 64) { removeMob(i); continue; }
      if(m.parts.detailGroup)m.parts.detailGroup.visible=dist<28;
      if(!m.def.hostile){
        m.blinkT-=dt;
        if(m.blinkT<=0){m.blinkDuration=.11;m.blinkT=2+Math.random()*4;}
        m.blinkDuration=Math.max(0,m.blinkDuration-dt);
        for(const eye of m.parts.eyes)eye.visible=m.blinkDuration<=0;
        if(!m.moving && m.fleeT<=0){
          m.grazeT-=dt;
          if(m.grazeT<0){m.grazeT=4+Math.random()*5;}
        }
      }

      m.attackT -= dt;
      m.hurtT -= dt;
      m.hurtGrace = Math.max(0,m.hurtGrace-dt);
      m.healthVisibleT = Math.max(0,m.healthVisibleT-dt);
      m.provokedT = Math.max(0,m.provokedT-dt);
      m.jumpT -= dt;
      m.pathT -= dt;
      if (m.hurtT <= 0 && m.flashed) flash(m, false);

      let speed = m.def.speed;
      m.moving = false;

      if (!m.def.hostile) {
        if (m.fleeT > 0) {
          m.fleeT -= dt;
          m.dir.set(-dx, 0, -dz).normalize();
          m.moving = true;
          speed *= 1.7;
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 1.5 + Math.random() * 3;
            m.wanderMoving=Math.random()>=.45;
            if(m.wanderMoving) {
              const a=Math.random()*Math.PI*2;
              m.dir.set(Math.cos(a),0,Math.sin(a));
            }
          }
          m.moving=m.wanderMoving;
        }
      } else {
        const aggro = survival && !Player.dead && m.def.aggro && dist < m.def.aggro &&
          (m.type!=='spider'||env.night||m.provokedT>0);
        if (aggro) {
          m.dir.set(dx, 0, dz).normalize();
          m.moving = true;
          if (m.def.ranged) {
            if (dist > 11) { /* approach */ }
            else if (dist < 5) { m.dir.set(-dx, 0, -dz).normalize(); }
            else {
              m.strafeT -= dt;
              if (m.strafeT <= 0) { m.strafeT = 1.5 + Math.random() * 2; m.strafeDir *= -1; }
              m.dir.set(-dz * m.strafeDir, 0, dx * m.strafeDir).normalize();
            }
            m.shootT -= dt;
            if (m.shootT <= 0 && dist < 22 && hasLineOfSight({ x: m.pos.x, y: m.pos.y + 1.2, z: m.pos.z }, { x: pp.x, y: pp.y + 1.1, z: pp.z })) {
              m.shootT = 2.2 + Math.random();
              shootArrow(m);
            }
          } else if (distXZ < (m.def.width / 2 + .55) && Math.abs(pp.y - m.pos.y) < 1.8 && m.attackT <= 0 &&
              hasLineOfSight({x:m.pos.x,y:m.pos.y+m.def.height*.75,z:m.pos.z},
                {x:pp.x,y:pp.y+1.1,z:pp.z})) {
            m.attackT = 1.2;
            Player.damage(m.def.dmg, m.def.name + '에게 당했다', m.pos);
          }
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 2 + Math.random() * 3;
            m.wanderMoving=Math.random()>=.5;
            if(m.wanderMoving){
              const a=Math.random()*Math.PI*2;
              m.dir.set(Math.cos(a),0,Math.sin(a));
            }
          }
          m.moving=m.wanderMoving;
        }

        if (!env.night && (m.type==='zombie'||m.type==='skeleton') && skyExposed(m)) {
          m.burnT += dt;
          if (m.burnT >= 1) {
            m.burnT = 0;
            hurtMob(m, 2, null);
            if (onEvent) onEvent('burn', m);
          }
        }
      }

      m.vel.x = m.moving ? m.dir.x * speed : m.vel.x * .8;
      m.vel.z = m.moving ? m.dir.z * speed : m.vel.z * .8;
      m.vel.y = Math.max(m.vel.y - 26 * dt, -40);

      m.onGround = false;
      const maxD = Math.max(Math.abs(m.vel.x), Math.abs(m.vel.y), Math.abs(m.vel.z)) * dt;
      const steps = Math.max(1, Math.ceil(maxD / .3));
      let blockedH = false;
      for (let s = 0; s < steps; s++) {
        if (collideBox(m, 'y', m.vel.y * dt / steps)) m.vel.y = 0;
        if (collideBox(m, 'x', m.vel.x * dt / steps)) { m.vel.x = 0; blockedH = true; }
        if (collideBox(m, 'z', m.vel.z * dt / steps)) { m.vel.z = 0; blockedH = true; }
      }
      if (blockedH && m.onGround && m.jumpT <= 0) {
        m.vel.y = 7.8;
        m.jumpT = .8;
      }

      if (m.pos.y < -12) { removeMob(i); continue; }

      if (m.moving) m.yaw = lerpAngle(m.yaw, Math.atan2(m.dir.x, m.dir.z), Math.min(1, dt * 8));
      m.mesh.rotation.y = m.yaw;
      m.animT += dt * (m.moving ? speed * 3.2 : .25);
      m.mesh.position.copy(m.pos);
      m.mesh.position.y += m.moving
        ? Math.sin(m.animT*2)*.025 : Math.sin(m.animT*.8)*.008;
      m.mesh.rotation.z = m.moving
        ? Math.sin(m.animT)*.014 : Math.sin(m.animT*.45)*.006;
      m.parts.legs.forEach((l, li) => {
        l.rotation.x = m.moving ? Math.sin(m.animT + (li % 2) * Math.PI) * .50
          : l.rotation.x * Math.max(0,1-dt*5);
      });
      m.parts.arms.forEach((arm,i)=>{
        const base=arm.userData.baseX||0;
        arm.rotation.x=base+(m.moving?Math.sin(m.animT+Math.PI*(i+1))*.34
          :Math.sin(m.animT*.38+i)*.025);
      });
      m.parts.extraLegs.forEach((limb,i)=>{
        limb.rotation.z=Math.sin(m.animT+i*Math.PI*.5)*.13;
      });
      if(m.parts.healthBar){
        const {group:bar,fill}=m.parts.healthBar;
        bar.visible=CONFIG.MOB_HEALTH_BARS===true && m.healthVisibleT>0;
        if(bar.visible){
          const ratio=Math.max(.015,Math.min(1,m.hp/m.def.hp));
          fill.scale.x=ratio;
          fill.position.x=-.36*(1-ratio);
          bar.rotation.y=Math.atan2(pp.x-m.pos.x,pp.z-m.pos.z)-m.yaw;
        }
      }
    }

    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      if (!active) break;
      a.life -= dt;
      if (a.life <= 0) { removeArrow(i); continue; }
      a.vel.y -= 12 * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(a.pos.x + a.vel.x, a.pos.y + a.vel.y, a.pos.z + a.vel.z);
      if (isSolidBlock(World.getBlock(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z)))) {
        removeArrow(i);
        continue;
      }
      if (mode === GAME_MODE.SURVIVAL && !Player.dead &&
          Math.abs(a.pos.x - pp.x) < .45 && Math.abs(a.pos.z - pp.z) < .45 &&
          a.pos.y > pp.y && a.pos.y < pp.y + 1.9) {
        Player.damage(3, '스켈레톤의 화살', a.pos);
        removeArrow(i);
      }
    }

    if (active) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = 2.5;
        const hostiles = mobs.filter(m => m.def.hostile && !m.dead).length;
        const passives = mobs.filter(m => !m.def.hostile && !m.dead).length;
        if (env.night && hostiles < MOB_CAPS.hostile) trySpawn('hostile');
        if (passives < MOB_CAPS.passive && Math.random() < .5) trySpawn('passive');
      }
    }
  }

  function removeArrow(i) {
    group.remove(arrows[i].mesh);
    arrows[i].mesh.geometry.dispose();
    arrows.splice(i, 1);
  }

  function getAttackCharge() {
    return Math.max(0,Math.min(1,(performance.now()-lastPlayerAttackAt)/450));
  }
  function getLastAttackResult(){return lastAttackResult;}

  function counts() {
    return {
      total: mobs.length,
      hostile: mobs.filter(m => m.def.hostile).length,
      passive: mobs.filter(m => !m.def.hostile).length,
      arrows: arrows.length
    };
  }

  return {
    init, reset, spawn, update, tryAttack, getAttackCharge, getLastAttackResult,
    setEnv, setMode, counts,
    set onEvent(fn) { onEvent = fn; }
  };
})();
