'use strict';

const Mobs = (() => {
  let scene = null, group = null;
  let mobs = [];
  let arrows = [];
  let env = { night: false, brightness: 1 };
  let mode = GAME_MODE.CREATIVE;
  let spawnTimer = 3;
  let onEvent = null;

  function init(scene_) {
    scene = scene_;
    group = new THREE.Group();
    scene.add(group);
  }

  function reset() {
    if (!group) return;
    mobs.forEach(m => group.remove(m.mesh));
    arrows.forEach(a => group.remove(a.mesh));
    mobs = [];
    arrows = [];
    spawnTimer = 3;
  }

  function setEnv(night, brightness) { env.night = night; env.brightness = brightness; }
  function setMode(m) { mode = m; }

  function mat(color) { return new THREE.MeshLambertMaterial({ color }); }
  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    return m;
  }

  function buildMob(type) {
    const g = new THREE.Group();
    const parts = { legs: [], bob: [], face: null, attack: null };
    const M = (color, rough=true) => new THREE.MeshStandardMaterial({ color, roughness: rough ? .84 : .58, metalness: .04, flatShading:true });
    const eyeM = new THREE.MeshBasicMaterial({ color:0x18222a });
    const redEye = new THREE.MeshBasicMaterial({ color:0xff3d3d });
    const white = new THREE.MeshLambertMaterial({ color:0xf6f1df, flatShading:true });
    const dark = new THREE.MeshLambertMaterial({ color:0x20252c, flatShading:true });

    const add = (mesh, x=0, y=0, z=0, bob=true) => {
      mesh.position.set(x,y,z); if(bob) parts.bob.push(mesh); g.add(mesh); return mesh;
    };
    const cube = (w,h,d,color,x=0,y=0,z=0,bob=true) => add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), M(color)),x,y,z,bob);
    const sph = (rx,ry,rz,color,x=0,y=0,z=0,bob=true) => add(new THREE.Mesh(new THREE.SphereGeometry(1,8,6), M(color)),x,y,z,bob).scale.set(rx,ry,rz);
    const cyl = (r1,r2,h,color,x=0,y=0,z=0,bob=true) => add(new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,8), M(color)),x,y,z,bob);
    const cone = (r,h,color,x=0,y=0,z=0,bob=true) => add(new THREE.Mesh(new THREE.ConeGeometry(r,h,7), M(color)),x,y,z,bob);
    const leg = (w,h,d,color,x,y,z) => {
      const l = cube(w,h,d,color,x,y,z,true); parts.legs.push(l); return l;
    };
    const eye = (x,y,z,matl=eyeM,s=0.055) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(s,s,.035),matl); e.position.set(x,y,z); g.add(e); return e;
    };

    if(type==='pig'){
      cube(.95,.55,.72,0xf19aa7,0,.58,0);
      const head=cube(.54,.46,.5,0xf5abb6,0,.72,.48);
      parts.face=head;
      cube(.18,.13,.06,0xc97785,0,.62,.77);
      eye(.12,.80,.74,eyeM,.055); eye(-.12,.80,.74,eyeM,.055);
      for(const sx of [-.23,.23]){ cube(.12,.12,.10,0xe08d99,sx,.88,.45); }
      cube(.14,.08,.14,0xd67c8c,0,.92,.47);
      const tail=new THREE.Mesh(new THREE.TorusGeometry(.11,.035,6,8,Math.PI*1.7),M(0xf19aa7));tail.rotation.x=Math.PI/2;tail.position.set(-.52,.72,-.18);g.add(tail);
      [[.25,.2,.22],[-.25,.2,.22],[.25,.2,-.22],[-.25,.2,-.22]].forEach(p=>leg(.18,.35,.18,0xd9818d,p[0],p[1],p[2]));
    }
    if(type==='cow'){
      cube(1.08,.68,.82,0x5b3c2d,0,.92,0);
      const head=cube(.54,.58,.48,0x7a5643,0,1.12,.53); parts.face=head;
      cube(.27,.19,.09,0xe5dfd1,0,.97,.81);
      eye(.12,1.18,.80,eyeM,.06); eye(-.12,1.18,.80,eyeM,.06);
      for(const sx of [-.19,.19]){ cone(.07,.26,0xe9e1cf,sx,1.48,.48); }
      cube(.20,.12,.16,0x6a4938,.33,1.32,.45); cube(.20,.12,.16,0x6a4938,-.33,1.32,.45);
      const udder=cube(.28,.16,.22,0xe8c4c9,0,.55,-.18);
      udder.rotation.x=.08;
      [[.34,.3,.28],[-.34,.3,.28],[.34,.3,-.28],[-.34,.3,-.28]].forEach(p=>leg(.2,.58,.2,0x493226,p[0],p[1],p[2]));
      const tail=cyl(.035,.055,.5,0x3c2b23,-.44,.8,-.38);tail.rotation.x=-.65;
    }
    if(type==='sheep'){
      sph(.52,.48,.43,0xf0eee7,0,.9,0);
      const head=cube(.42,.48,.42,0x5a504c,0,1.08,.48); parts.face=head;
      eye(.10,1.16,.70,eyeM,.055); eye(-.10,1.16,.70,eyeM,.055);
      cube(.10,.16,.13,0xd0c8be,.24,1.20,.48); cube(.10,.16,.13,0xd0c8be,-.24,1.20,.48);
      cube(.13,.07,.10,0x2d2730,0,1.00,.70);
      [[.27,.28,.23],[-.27,.28,.23],[.27,.28,-.23],[-.27,.28,-.23]].forEach(p=>leg(.15,.55,.15,0x8a817c,p[0],p[1],p[2]));
      const tail=sph(.13,.14,.12,0xf0eee7,-.43,1.0,-.35);
    }
    if(type==='chicken'){
      sph(.28,.28,.34,0xf0ece2,0,.48,0);
      const head=sph(.19,.2,.18,0xf7f4eb,0,.72,.25); parts.face=head;
      eye(.075,.76,.40,eyeM,.045); eye(-.075,.76,.40,eyeM,.045);
      cone(.08,.13,0xe6a63b,0,.68,.46);
      cone(.055,.14,0xd5473c,0,.94,.20);
      const wing1=sph(.12,.20,.24,0xd4cfc4,.23,.48,.02); wing1.rotation.z=-.25;
      const wing2=sph(.12,.20,.24,0xd4cfc4,-.23,.48,.02); wing2.rotation.z=.25;
      parts.wings=[wing1,wing2];
      leg(.055,.23,.055,0xe4a52f,.10,.13,0); leg(.055,.23,.055,0xe4a52f,-.10,.13,0);
    }
    if(type==='zombie'){
      leg(.22,.72,.24,0x253f64,.13,.36,0); leg(.22,.72,.24,0x253f64,-.13,.36,0);
      cube(.56,.76,.34,0x2e6f63,0,1.08,0);
      cube(.18,.26,.36,0x244f4c,.35,1.23,.02); cube(.18,.26,.36,0x244f4c,-.35,1.23,.02);
      const head=cube(.5,.5,.48,0x5b9c57,0,1.68,0); parts.face=head;
      cube(.16,.11,.035,0x4a7f48,.23,1.78,.245); cube(.16,.11,.035,0x4a7f48,-.23,1.78,.245);
      eye(.12,1.72,.26,redEye,.07); eye(-.12,1.72,.26,redEye,.07);
      cube(.30,.09,.05,0x2d3a2a,0,1.58,.25);
      const arm1=cube(.16,.62,.18,0x5b9c57,.42,1.18,.18); arm1.rotation.z=-.22;
      const arm2=cube(.16,.62,.18,0x5b9c57,-.42,1.18,.18); arm2.rotation.z=.22;
      cube(.12,.1,.12,0x3c6840,.42,1.02,.42); cube(.12,.1,.12,0x3c6840,-.42,1.02,.42);
    }
    if(type==='skeleton'){
      leg(.15,.72,.15,0xbec0ba,.11,.36,0); leg(.15,.72,.15,0xbec0ba,-.11,.36,0);
      cube(.43,.68,.25,0xbec0ba,0,1.07,0);
      const head=cube(.44,.44,.44,0xdcdcd3,0,1.63,0); parts.face=head;
      eye(.10,1.68,.225,redEye,.06); eye(-.10,1.68,.225,redEye,.06);
      cube(.26,.07,.045,0x6d6961,0,1.56,.23);
      cube(.12,.48,.12,0xb6b8b1,.32,1.22,.18); cube(.12,.48,.12,0xb6b8b1,-.32,1.22,.18);
      const bow=cyl(.025,.025,.58,0x6d4727,.42,1.25,.42);bow.rotation.z=Math.PI/2;
      const string=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.01,.62,.01)),new THREE.LineBasicMaterial({color:0xd9d9d2}));string.position.set(.42,1.25,.42);g.add(string);
    }
    if(type==='spider'){
      sph(.48,.30,.55,0x25262c,0,.55,0);
      sph(.28,.24,.30,0x353941,0,.53,.62);
      for(const sx of [-1,1]) for(const sz of [-1,1]) {
        const legBase=cyl(.035,.055,.72,0x17191d,sx*.48,.54,sz*.27);
        legBase.rotation.z=sx*(.9); legBase.rotation.x=sz*.2;
        const foot=cyl(.025,.04,.68,0x17191d,sx*.76,.36,sz*.42);
        foot.rotation.z=sx*(1.15); foot.rotation.x=sz*.16;
        parts.legs.push(legBase,foot);
      }
      eye(.12,.58,.91,redEye,.085); eye(-.12,.58,.91,redEye,.085);
      eye(.04,.48,.93,redEye,.05); eye(-.04,.48,.93,redEye,.05);
      const fang1=cone(.04,.18,0xd7d5cc,.10,.34,.86); fang1.rotation.x=Math.PI;
      const fang2=cone(.04,.18,0xd7d5cc,-.10,.34,.86); fang2.rotation.x=Math.PI;
    }
    if(type==='cow'){
      cube(.26,.12,.035,0x2b201a,.33,1.00,.40,false);
      cube(.20,.10,.035,0x2b201a,-.30,1.07,-.35,false);
      cube(.16,.09,.035,0x2b201a,.12,.74,-.39,false);
    }
    if(type==='sheep'){
      for(const p of [[.34,1.10,.18],[-.34,1.08,.18],[.28,.72,-.20],[-.28,.72,-.20]]){
        sph(.18,.14,.16,0xfffaf1,p[0],p[1],p[2],false);
      }
    }
    if(type==='pig'){
      cone(.10,.16,0xf7b5bf,.23,.91,.48,false).rotation.z=-.35;
      cone(.10,.16,0xf7b5bf,-.23,.91,.48,false).rotation.z=.35;
    }
    if(type==='chicken'){
      for(const sx of [-.11,.11]){ const feather=cone(.06,.22,0xfff7e9,sx,.60,-.27,false); feather.rotation.x=.45; }
    }
    if(type==='zombie'){
      for(const sx of [-.11,.11]) cube(.035,.035,.025,0xb6d65e,sx,1.42,.19,false);
      cube(.40,.035,.04,0x1c3a35,0,.91,.20,false);
      cube(.12,.08,.08,0x1a2637,.15,.08,.06,false);
      cube(.12,.08,.08,0x1a2637,-.15,.08,.06,false);
    }
    if(type==='skeleton'){
      for(const y of [1.02,1.16,1.30]) cube(.29,.035,.035,0x7e817d,0,y,.14,false);
      cube(.05,.30,.035,0x7e817d,0,1.16,.13,false);
    }
    if(type==='spider'){
      for(const z of [.18,-.18]) cube(.62,.055,.055,0x4b1e27,0,.63,z,false);
    }
    if(type==='creeper'){
      const body=cube(.52,.88,.44,0x5e9f47,0,.86,0);
      const head=cube(.48,.48,.46,0x6fb84f,0,1.52,0); parts.face=head;
      eye(.105,1.58,.235,redEye,.07); eye(-.105,1.58,.235,redEye,.07);
      cube(.10,.18,.035,0x1b2520,.12,1.43,.245); cube(.10,.18,.035,0x1b2520,-.12,1.43,.245);
      cube(.06,.20,.04,0x18221c,0,1.38,.245);
      cube(.10,.28,.40,0x4e8c3f,.34,.43,.02); cube(.10,.28,.40,0x4e8c3f,-.34,.43,.02);
      const legA=leg(.16,.42,.16,0x477b38,.17,.20,.18);
      const legB=leg(.16,.42,.16,0x477b38,-.17,.20,.18);
      const legC=leg(.16,.42,.16,0x477b38,.17,.20,-.18);
      const legD=leg(.16,.42,.16,0x477b38,-.17,.20,-.18);
      parts.legs.push(legA,legB,legC,legD);
      parts.fuse=head;
    }
    g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    return { mesh:g, parts };
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
      wanderT: Math.random() * 2, attackT: 0, shootT: 1 + Math.random() * 2,
      strafeT: 2, strafeDir: 1, hurtT: 0, flashed: false,
      burnT: 0, fleeT: 0, animT: 0,
      dead: false, deadT: 0,
      aggroT: 0, jumpT: 0, thinkT: 0, fuseT: 0
    };
    mobs.push(m);
    return m;
  }

  function removeMob(i) {
    group.remove(mobs[i].mesh);
    mobs[i].mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    mobs.splice(i, 1);
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
    if (m.dead) return;
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
    else m.aggroT = 8;
    if (onEvent) onEvent('hurt', m);
    if (m.hp <= 0) {
      m.dead = true;
      m.deadT = .35;
      if (onEvent) onEvent('die', m);
    }
  }

  function dropLoot(m) {
    if (mode === GAME_MODE.CREATIVE) return;
    if (m.def.hostile && onEvent) onEvent('xp', {mob:m, amount: m.type==='creeper' ? 6 : (m.type==='skeleton' ? 5 : 4)});
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

  function tryAttack(eye, dir, reach, damage=SURVIVAL.FIST_DMG) {
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
      hurtMob(best, damage, Player.pos);
      return best;
    }
    return null;
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

  function explodeCreeper(m) {
    if (onEvent) onEvent('explode', m);
    if (mode === GAME_MODE.SURVIVAL && !Player.dead) {
      const dx=Player.pos.x-m.pos.x, dy=(Player.pos.y+.9)-(m.pos.y+1), dz=Player.pos.z-m.pos.z;
      const d=Math.hypot(dx,dy,dz);
      if(d<4.8) Player.damage(Math.max(2,Math.floor(10*(1-d/4.8))), '크리퍼 폭발', m.pos);
    }
    const cx=Math.floor(m.pos.x), cy=Math.floor(m.pos.y+.8), cz=Math.floor(m.pos.z);
    for(let x=cx-2;x<=cx+2;x++)for(let y=cy-1;y<=cy+2;y++)for(let z=cz-2;z<=cz+2;z++){
      const dd=Math.hypot(x+.5-m.pos.x,y+.5-(m.pos.y+.8),z+.5-m.pos.z);
      if(dd>2.35)continue;
      const id=World.getBlock(x,y,z);
      if(id && id!==BLOCK.BEDROCK && id!==BLOCK.CRAFTING_TABLE && id!==BLOCK.FURNACE) World.setBlock(x,y,z,BLOCK.AIR);
    }
    m.dead=true;m.deadT=.12;
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

  function hasLineOfSight(m) {
    const from = new THREE.Vector3(m.pos.x, m.pos.y + m.def.height * .72, m.pos.z);
    const to = new THREE.Vector3(Player.pos.x, Player.pos.y + 1.15, Player.pos.z);
    const d = to.clone().sub(from);
    const len = d.length();
    if (len <= .001) return true;
    d.multiplyScalar(1 / len);
    const steps = Math.ceil(len / .22);
    for (let i = 1; i < steps; i++) {
      const p = from.clone().addScaledVector(d, i * .22);
      if (isSolidBlock(World.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) return false;
    }
    return true;
  }

  function torchNearby(x, y, z, radius = 8) {
    const r = Math.ceil(radius);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        for (let dy = -4; dy <= 4; dy++) {
          const id = World.getBlock(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz));
          if (id === BLOCK.TORCH) return true;
        }
      }
    }
    return false;
  }

  function undergroundSpawnPoint(x, z) {
    for (let y = CONFIG.HEIGHT - 3; y >= 3; y--) {
      const here = World.getBlock(x, y, z);
      const floor = World.getBlock(x, y - 1, z);
      const above = World.getBlock(x, y + 1, z);
      if (here !== BLOCK.AIR || !isSolidBlock(floor) || above !== BLOCK.AIR) continue;
      let sky = true;
      for (let sy = y + 2; sy < CONFIG.HEIGHT; sy++) {
        if (isSolidBlock(World.getBlock(x, sy, z))) { sky = false; break; }
      }
      if (!sky) return {x, y, z};
    }
    return null;
  }

  function trySpawnCaveHostile() {
    const pp = Player.pos;
    for (let attempt = 0; attempt < 8; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 22;
      const x = Math.floor(pp.x + Math.cos(ang) * dist);
      const z = Math.floor(pp.z + Math.sin(ang) * dist);
      if (!World.getChunk(x >> 4, z >> 4)) continue;
      const p = undergroundSpawnPoint(x, z);
      const surface = surfaceY(x, z);
      if (!p || p.y > surface - 3) continue;
      if (Math.abs(p.x + .5 - pp.x) < 10 && Math.abs(p.z + .5 - pp.z) < 10) continue;
      if (torchNearby(p.x + .5, p.y, p.z + .5, 8)) continue;
      const r = Math.random();
      const type = r < .38 ? 'zombie' : r < .63 ? 'skeleton' : r < .84 ? 'spider' : 'creeper';
      return spawn(type, p.x + .5, p.y, p.z + .5);
    }
    return null;
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
      const type = r < .38 ? 'zombie' : r < .63 ? 'skeleton' : r < .84 ? 'spider' : 'creeper';
      spawn(type, x + .5, y + 1, z + .5);
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

      m.attackT -= dt;
      m.jumpT -= dt;
      m.thinkT -= dt;
      m.aggroT = Math.max(0, m.aggroT - dt);
      m.hurtT -= dt;
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
            if (Math.random() < .45) m.moving = false;
            else {
              const a = Math.random() * Math.PI * 2;
              m.dir.set(Math.cos(a), 0, Math.sin(a));
              m.moving = true;
            }
          } else m.moving = m.wanderT > 0 && m.dir.lengthSq() > 0;
        }
      } else {
        const visible = dist < 32 ? hasLineOfSight(m) : false;
        const aggro = survival && !Player.dead && m.def.aggro && (dist < m.def.aggro || m.aggroT > 0);
        if (aggro) {
          if (m.type === 'creeper') {
            if (visible && dist < 3.3) {
              m.fuseT += dt;
              m.moving = false;
              if (m.fuseT >= 1.25) {
                explodeCreeper(m);
                continue;
              }
            } else {
              m.fuseT = Math.max(0, m.fuseT - dt * .8);
              m.dir.set(dx, 0, dz).normalize();
              m.moving = true;
            }
          } else if (m.def.ranged) {
            if (!visible || dist > 12) {
              m.dir.set(dx, 0, dz).normalize();
              m.moving = true;
            } else if (dist < 6.5) {
              m.dir.set(-dx, 0, -dz).normalize();
              m.moving = true;
            } else {
              m.strafeT -= dt;
              if (m.strafeT <= 0) {
                m.strafeT = 1 + Math.random() * 1.6;
                m.strafeDir *= -1;
              }
              m.dir.set(-dz * m.strafeDir, 0, dx * m.strafeDir).normalize();
              m.moving = true;
            }
            m.shootT -= dt;
            if (visible && m.shootT <= 0 && dist > 5.5 && dist < 24) {
              m.shootT = 1.8 + Math.random() * .9;
              shootArrow(m);
            }
          } else {
            m.dir.set(dx, 0, dz).normalize();
            m.moving = true;
            if (m.type === 'spider' && distXZ > 2.5 && distXZ < 9 && m.jumpT <= 0 && m.onGround) {
              m.vel.y = 7.5;
              m.vel.x += m.dir.x * 3.5;
              m.vel.z += m.dir.z * 3.5;
              m.jumpT = 2;
            }
            if (distXZ < (m.def.width / 2 + .65) && Math.abs(pp.y - m.pos.y) < 2.1 && m.attackT <= 0) {
              m.attackT = m.type === 'spider' ? 1.5 : 1.0;
              Player.damage(m.def.dmg, m.def.name + '에게 당했다', m.pos);
            }
          }
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 2 + Math.random() * 3;
            if (Math.random() < .5) m.moving = false;
            else {
              const a = Math.random() * Math.PI * 2;
              m.dir.set(Math.cos(a), 0, Math.sin(a));
              m.moving = true;
            }
          } else m.moving = m.dir.lengthSq() > 0;
        }

        if (m.type !== 'creeper' && !env.night && skyExposed(m)) {
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
      if (blockedH && m.onGround) m.vel.y = 7.8;

      if (m.pos.y < -12) { removeMob(i); continue; }

      if (m.moving) m.yaw = lerpAngle(m.yaw, Math.atan2(m.dir.x, m.dir.z), Math.min(1, dt * 8));
      m.mesh.rotation.y = m.yaw;
      m.mesh.position.copy(m.pos);
      m.animT += dt * (m.moving ? speed * 3.2 : 1);
      const idle = Math.sin(m.animT * 1.7) * .018;
      if (m.parts.face) {
        if (m.parts.face.userData.baseY === undefined) m.parts.face.userData.baseY = m.parts.face.position.y;
        m.parts.face.position.y = m.parts.face.userData.baseY + idle;
        m.parts.face.rotation.x = Math.sin(m.animT * .7) * .025;
      }
      m.parts.legs.forEach((l, li) => {
        const phase = (li % 2) * Math.PI;
        l.rotation.x = m.moving ? Math.sin(m.animT + phase) * .55 : l.rotation.x * .78;
      });
      if(m.parts.wings){
        const flap = Math.sin(m.animT * 2.8) * (m.moving ? .16 : .04);
        m.parts.wings[0].rotation.z = -.25 - flap;
        m.parts.wings[1].rotation.z = .25 + flap;
      }
      if(m.type==='spider' && m.moving){
        m.parts.legs.forEach((l,li)=>{
          l.rotation.y = Math.sin(m.animT*1.5 + li) * .12;
          l.rotation.x += Math.sin(m.animT + li*.7) * .08;
        });
      }
      if(m.type==='creeper' && m.parts.fuse){
        const pulse=1+Math.max(0,m.fuseT)*.12+Math.sin(m.fuseT*25)*Math.max(0,m.fuseT)*.05;
        m.parts.face.scale.setScalar(pulse);
        if(m.fuseT>0) m.parts.face.material.emissive && m.parts.face.material.emissive.setHex(0x123000);
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
        if (hostiles < MOB_CAPS.hostile) {
          if (env.night) trySpawn('hostile');
          if (!env.night || Math.random() < .7) trySpawnCaveHostile();
        }
        if (passives < MOB_CAPS.passive && Math.random() < .5) trySpawn('passive');
      }
    }
  }

  function removeArrow(i) {
    group.remove(arrows[i].mesh);
    arrows[i].mesh.geometry.dispose();
    arrows.splice(i, 1);
  }

  function counts() {
    return {
      total: mobs.length,
      hostile: mobs.filter(m => m.def.hostile).length,
      passive: mobs.filter(m => !m.def.hostile).length,
      arrows: arrows.length
    };
  }

  return {
    init, reset, spawn, update, tryAttack, setEnv, setMode, counts,
    set onEvent(fn) { onEvent = fn; }
  };
})();
