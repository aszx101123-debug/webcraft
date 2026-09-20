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
    const parts = { legs: [] };
    const limb = (w, h, d, color, x, y, z) => {
      const l = box(w, h, d, color, x, y, z);
      parts.legs.push(l);
      g.add(l);
      return l;
    };
    const sphere = (r, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(color));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      g.add(m);
      return m;
    };
    const cone = (r, h, color, x, y, z, rotX = 0, rotZ = 0) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(color));
      m.position.set(x, y, z);
      m.rotation.x = rotX;
      m.rotation.z = rotZ;
      g.add(m);
      return m;
    };
    const eye = (x, y, z, color = 0x1b1b1b, w = .08, h = .08) => {
      g.add(box(w, h, .035, color, x, y, z));
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
      wanderT: Math.random() * 2, attackT: 0, shootT: 1 + Math.random() * 2,
      strafeT: 2, strafeDir: 1, hurtT: 0, flashed: false,
      burnT: 0, fleeT: 0, animT: 0,
      dead: false, deadT: 0
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
    if (onEvent) onEvent('hurt', m);
    if (m.hp <= 0) {
      m.dead = true;
      m.deadT = .35;
      if (onEvent) onEvent('die', m);
    }
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
      hurtMob(best, SURVIVAL.FIST_DMG, Player.pos);
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

      m.attackT -= dt;
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
        const aggro = survival && !Player.dead && m.def.aggro && dist < m.def.aggro;
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
            if (m.shootT <= 0 && dist < 22) {
              m.shootT = 2.2 + Math.random();
              shootArrow(m);
            }
          } else if (distXZ < (m.def.width / 2 + .55) && Math.abs(pp.y - m.pos.y) < 1.8 && m.attackT <= 0) {
            m.attackT = 1.2;
            Player.damage(m.def.dmg, m.def.name + '에게 당했다', m.pos);
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

        if (!env.night && skyExposed(m)) {
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
      m.animT += dt * (m.moving ? speed * 3.2 : 0);
      m.parts.legs.forEach((l, li) => {
        l.rotation.x = m.moving ? Math.sin(m.animT + (li % 2) * Math.PI) * .55 : l.rotation.x * .8;
      });
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
