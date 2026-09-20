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
    const leg = (w, h, d, color, x, y, z) => {
      const l = box(w, h, d, color, x, y, z);
      parts.legs.push(l);
      g.add(l);
    };
    if (type === 'pig') {
      g.add(box(.9, .55, .65, 0xe89aa4, 0, .58, 0));
      g.add(box(.55, .5, .45, 0xe89aa4, 0, .68, .5));
      g.add(box(.22, .14, .08, 0xd07a88, 0, .6, .75));
      leg(.18, .34, .18, 0xd4818c, .26, .17, .2);
      leg(.18, .34, .18, 0xd4818c, -.26, .17, .2);
      leg(.18, .34, .18, 0xd4818c, .26, .17, -.2);
      leg(.18, .34, .18, 0xd4818c, -.26, .17, -.2);
    } else if (type === 'cow') {
      g.add(box(1.05, .68, .78, 0x6e4a33, 0, .92, 0));
      g.add(box(.5, .55, .42, 0x7a5540, 0, 1.05, .58));
      g.add(box(.26, .2, .08, 0xd8d0c4, 0, .95, .82));
      leg(.2, .6, .2, 0x5a3c2a, .34, .3, .26);
      leg(.2, .6, .2, 0x5a3c2a, -.34, .3, .26);
      leg(.2, .6, .2, 0x5a3c2a, .34, .3, -.26);
      leg(.2, .6, .2, 0x5a3c2a, -.34, .3, -.26);
    } else if (type === 'sheep') {
      g.add(box(.95, .72, .75, 0xe8e4da, 0, .92, 0));
      g.add(box(.4, .42, .42, 0xcbb9a5, 0, 1.08, .52));
      leg(.16, .56, .16, 0xb9ab98, .3, .28, .24);
      leg(.16, .56, .16, 0xb9ab98, -.3, .28, .24);
      leg(.16, .56, .16, 0xb9ab98, .3, .28, -.24);
      leg(.16, .56, .16, 0xb9ab98, -.3, .28, -.24);
    } else if (type === 'chicken') {
      g.add(box(.42, .42, .55, 0xe8e2d5, 0, .42, 0));
      g.add(box(.28, .35, .25, 0xe8e2d5, 0, .68, .26));
      g.add(box(.12, .08, .14, 0xd8a03a, 0, .66, .44));
      g.add(box(.1, .12, .1, 0xc03a34, 0, .88, .24));
      leg(.06, .24, .06, 0xd8a03a, .1, .12, 0);
      leg(.06, .24, .06, 0xd8a03a, -.1, .12, 0);
    } else if (type === 'zombie') {
      leg(.22, .7, .22, 0x2a4a6a, .13, .35, 0);
      leg(.22, .7, .22, 0x2a4a6a, -.13, .35, 0);
      g.add(box(.52, .72, .3, 0x3a7a6a, 0, 1.06, 0));
      g.add(box(.48, .48, .48, 0x5a9a4a, 0, 1.66, 0));
      g.add(box(.08, .08, .04, 0x1a1a1a, .12, 1.7, .25));
      g.add(box(.08, .08, .04, 0x1a1a1a, -.12, 1.7, .25));
      g.add(box(.16, .16, .62, 0x5a9a4a, .34, 1.28, .28));
      g.add(box(.16, .16, .62, 0x5a9a4a, -.34, 1.28, .28));
    } else if (type === 'skeleton') {
      leg(.14, .7, .14, 0xd8d8d0, .11, .35, 0);
      leg(.14, .7, .14, 0xd8d8d0, -.11, .35, 0);
      g.add(box(.4, .68, .24, 0xd8d8d0, 0, 1.06, 0));
      g.add(box(.42, .42, .42, 0xe4e4dc, 0, 1.64, 0));
      g.add(box(.07, .07, .04, 0x1a1a1a, .1, 1.68, .22));
      g.add(box(.07, .07, .04, 0x1a1a1a, -.1, 1.68, .22));
      g.add(box(.12, .12, .5, 0xd8d8d0, .3, 1.24, .24));
      g.add(box(.12, .12, .5, 0xd8d8d0, -.3, 1.24, .24));
      g.add(box(.06, .44, .06, 0x6b4a2a, .42, 1.2, .5));
    } else if (type === 'spider') {
      g.add(box(.9, .5, 1.05, 0x2a2a30, 0, .48, -.1));
      g.add(box(.5, .4, .5, 0x34343c, 0, .45, .62));
      g.add(box(.09, .09, .05, 0xd03a3a, .14, .52, .88));
      g.add(box(.09, .09, .05, 0xd03a3a, -.14, .52, .88));
      g.add(box(.09, .09, .05, 0x8a2a2a, .05, .42, .88));
      g.add(box(.09, .09, .05, 0x8a2a2a, -.05, .42, .88));
      leg(.75, .08, .08, 0x1e1e24, .68, .4, .32);
      leg(.75, .08, .08, 0x1e1e24, -.68, .4, .32);
      leg(.75, .08, .08, 0x1e1e24, .68, .4, -.32);
      leg(.75, .08, .08, 0x1e1e24, -.68, .4, -.32);
    } else if (type === 'creeper') {
      const body = box(.68, 1.15, .68, 0x4b9e4a, 0, .8, 0);
      const face = box(.58, .52, .06, 0x3a7e3a, 0, 1.38, .35);
      g.add(body, face);
      parts.face = face;
      leg(.18, .55, .18, 0x3f853f, .22, .28, .2);
      leg(.18, .55, .18, 0x3f853f, -.22, .28, .2);
      leg(.18, .55, .18, 0x3f853f, .22, .28, -.2);
      leg(.18, .55, .18, 0x3f853f, -.22, .28, -.2);
      const fuse = box(.16, .3, .16, 0x8fd14f, 0, 1.95, 0);
      g.add(fuse);
      parts.fuse = fuse;
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
      burnT: 0, fleeT: 0, animT: 0, fuseT: 0,
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

  function tryAttack(eye, dir, reach, damage = SURVIVAL.FIST_DMG) {
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
      const dx = Player.pos.x - m.pos.x;
      const dy = (Player.pos.y + .9) - (m.pos.y + 1);
      const dz = Player.pos.z - m.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 4.8) Player.damage(Math.max(2, Math.floor(10 * (1 - d / 4.8))), '크리퍼 폭발', m.pos);
    }
    const cx = Math.floor(m.pos.x), cy = Math.floor(m.pos.y + .8), cz = Math.floor(m.pos.z);
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 1; y <= cy + 2; y++) for (let z = cz - 2; z <= cz + 2; z++) {
      const dd = Math.hypot(x + .5 - m.pos.x, y + .5 - (m.pos.y + .8), z + .5 - m.pos.z);
      if (dd > 2.35) continue;
      const id = World.getBlock(x, y, z);
      if (id && id !== BLOCK.BEDROCK && id !== BLOCK.CRAFTING_TABLE) World.setBlock(x, y, z, BLOCK.AIR);
    }
    m.dead = true;
    m.deadT = .12;
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
      spawn(r < .42 ? 'zombie' : r < .70 ? 'skeleton' : r < .88 ? 'spider' : 'creeper', x + .5, y + 1, z + .5);
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
          if (m.type === 'creeper') {
            if (distXZ < 3.3) {
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
          } else {
            m.dir.set(dx, 0, dz).normalize();
            m.moving = true;
          }
          if (m.type !== 'creeper' && m.def.ranged) {
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
          } else if (m.type !== 'creeper' && distXZ < (m.def.width / 2 + .55) && Math.abs(pp.y - m.pos.y) < 1.8 && m.attackT <= 0) {
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
      if (m.type === 'creeper' && m.parts.fuse) {
        const pulse = 1 + Math.max(0, m.fuseT) * .12 + Math.sin(m.fuseT * 25) * Math.max(0, m.fuseT) * .05;
        m.parts.face.scale.setScalar(pulse);
        m.parts.fuse.scale.setScalar(1 + Math.max(0, m.fuseT) * .4);
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
