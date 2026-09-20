'use strict';

const Player = (() => {
  const HW = .3, PH = 1.8, EYE = 1.62;
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const spawnPoint = new THREE.Vector3();
  let yaw = 0, pitch = -.2, onGround = false, flying = false;
  let mode = GAME_MODE.CREATIVE;
  let hp = SURVIVAL.MAX_HP, food = SURVIVAL.MAX_FOOD, air = SURVIVAL.MAX_AIR;
  let exhaustion = 0, regenT = 0, starveT = 0, airT = 0, drownT = 0;
  let peakY = null, dead = false, lastInWater = false;
  let onHurt = null, onDeath = null, onEat = null;

  function reset(x, y, z, yw = 0, pt = -.2, fly = false) {
    pos.set(x, y, z);
    vel.set(0, 0, 0);
    yaw = yw; pitch = pt;
    onGround = false; flying = fly && mode === GAME_MODE.CREATIVE;
    setSpawn(x, y, z);
  }

  function setSpawn(x, y, z) { spawnPoint.set(x, y, z); }

  function setMode(m) {
    mode = m;
    if (m === GAME_MODE.SURVIVAL) flying = false;
  }

  function isSolidAt(x, y, z) {
    return isSolidBlock(World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  function moveAxis(axis, dist) {
    if (!dist) return false;
    pos[axis] += dist;
    const x0 = Math.floor(pos.x - HW), x1 = Math.floor(pos.x + HW);
    const y0 = Math.floor(pos.y), y1 = Math.floor(pos.y + PH - 1e-4);
    const z0 = Math.floor(pos.z - HW), z1 = Math.floor(pos.z + HW);
    let hit = false;
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      if (!isSolidAt(bx, by, bz)) continue;
      hit = true;
      if (axis === 'y') {
        if (dist < 0) pos.y = Math.max(pos.y, by + 1), onGround = true;
        else pos.y = Math.min(pos.y, by - PH - 1e-3);
      } else if (axis === 'x') {
        pos.x = dist > 0 ? Math.min(pos.x, bx - HW - 1e-3) : Math.max(pos.x, bx + 1 + HW + 1e-3);
      } else {
        pos.z = dist > 0 ? Math.min(pos.z, bz - HW - 1e-3) : Math.max(pos.z, bz + 1 + HW + 1e-3);
      }
    }
    return hit;
  }

  function damage(amount, cause, sourcePos) {
    if (mode === GAME_MODE.CREATIVE || dead || amount <= 0) return false;
    hp = Math.max(0, hp - amount);
    if (sourcePos) {
      const kx = pos.x - sourcePos.x, kz = pos.z - sourcePos.z;
      const l = Math.hypot(kx, kz) || 1;
      vel.x += kx / l * 6.5;
      vel.z += kz / l * 6.5;
      vel.y = Math.max(vel.y, 4);
    }
    if (onHurt) onHurt(cause || '피해');
    if (hp <= 0) {
      dead = true;
      if (onDeath) onDeath(cause || '사망');
    }
    return true;
  }

  function heal(n) {
    if (!dead) hp = Math.min(SURVIVAL.MAX_HP, hp + n);
  }

  function eat(foodValue) {
    if (mode !== GAME_MODE.SURVIVAL || dead || food >= SURVIVAL.MAX_FOOD) return false;
    food = Math.min(SURVIVAL.MAX_FOOD, food + foodValue);
    if (onEat) onEat();
    return true;
  }

  function addExhaustion(n) {
    if (mode !== GAME_MODE.SURVIVAL || dead) return;
    exhaustion += n;
    while (exhaustion >= SURVIVAL.EXHAUST_PER_FOOD) {
      exhaustion -= SURVIVAL.EXHAUST_PER_FOOD;
      if (food > 0) food--;
    }
  }

  function survivalTick(dt, sprinting) {
    if (mode !== GAME_MODE.SURVIVAL || dead) return;
    const moving = Math.abs(vel.x) > .5 || Math.abs(vel.z) > .5;
    addExhaustion(SURVIVAL.BASE_EXHAUST * dt * (sprinting && moving ? SURVIVAL.SPRINT_MULT : 1));

    if (food >= SURVIVAL.REGEN_MIN_FOOD && hp < SURVIVAL.MAX_HP) {
      regenT += dt;
      if (regenT >= SURVIVAL.REGEN_SEC) {
        regenT = 0;
        heal(1);
        addExhaustion(SURVIVAL.REGEN_COST);
      }
    } else regenT = 0;

    if (food <= 0) {
      starveT += dt;
      if (starveT >= SURVIVAL.STARVE_SEC) {
        starveT = 0;
        if (hp > SURVIVAL.STARVE_MIN_HP) {
          hp--;
          if (onHurt) onHurt('굶주림에 허기져');
        }
      }
    } else starveT = 0;

    const eyeWaterId = World.getBlock(Math.floor(pos.x), Math.floor(pos.y + EYE), Math.floor(pos.z));
    const eyeWater = eyeWaterId === BLOCK.WATER || eyeWaterId === BLOCK.WATER_FLOW;
    if (eyeWater) {
      airT += dt;
      if (airT >= 1) {
        airT = 0;
        if (air > 0) air--;
        else {
          drownT += 1;
          if (drownT >= 1) { drownT = 0; damage(2, '익사', null); }
        }
      }
    } else {
      air = SURVIVAL.MAX_AIR;
      airT = 0;
      drownT = 0;
    }
  }

  function respawn() {
    pos.copy(spawnPoint);
    vel.set(0, 0, 0);
    hp = SURVIVAL.MAX_HP;
    food = SURVIVAL.MAX_FOOD;
    air = SURVIVAL.MAX_AIR;
    exhaustion = 0;
    regenT = starveT = airT = drownT = 0;
    peakY = null;
    dead = false;
  }

  function update(dt, keys) {
    const f = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const s = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const waterId = World.getBlock(Math.floor(pos.x), Math.floor(pos.y + .5), Math.floor(pos.z));
    const inWater = waterId === BLOCK.WATER || waterId === BLOCK.WATER_FLOW;
    lastInWater = inWater;
    const canFly = mode === GAME_MODE.CREATIVE && flying;
    const speed = canFly ? CONFIG.FLY : (sprint && f > 0 ? CONFIG.SPRINT : CONFIG.SPEED) * (inWater ? .55 : 1);
    const len = Math.hypot(f, s) || 1;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const wx = (-sy * f + cy * s) / len * speed;
    const wz = (-cy * f - sy * s) / len * speed;

    if (canFly) {
      const k = Math.min(1, dt * 8);
      vel.x += (wx - vel.x) * k;
      vel.z += (wz - vel.z) * k;
      const up = (keys['Space'] ? 1 : 0) - (sprint ? 1 : 0);
      vel.y += (up * CONFIG.FLY - vel.y) * k;
    } else {
      const k = Math.min(1, dt * (onGround ? 12 : 3.5));
      vel.x += (wx - vel.x) * k;
      vel.z += (wz - vel.z) * k;
      if (inWater) {
        vel.y -= CONFIG.GRAVITY * .28 * dt;
        vel.y = Math.max(vel.y, -4);
        if (keys['Space']) vel.y = Math.min(vel.y + 26 * dt, 4.2);
      } else {
        if (keys['Space'] && onGround) {
          vel.y = CONFIG.JUMP;
          addExhaustion(SURVIVAL.JUMP_COST);
        }
        vel.y -= CONFIG.GRAVITY * dt;
      }
      vel.y = Math.max(vel.y, -46);
    }

    onGround = false;
    const maxDisp = Math.max(Math.abs(vel.x), Math.abs(vel.y), Math.abs(vel.z)) * dt;
    const steps = Math.max(1, Math.ceil(maxDisp / .35));
    for (let i = 0; i < steps; i++) {
      if (moveAxis('y', vel.y * dt / steps)) vel.y = 0;
      if (moveAxis('x', vel.x * dt / steps)) vel.x = 0;
      if (moveAxis('z', vel.z * dt / steps)) vel.z = 0;
    }

    if (mode !== GAME_MODE.SURVIVAL || dead || flying || inWater) {
      peakY = null;
    } else if (onGround) {
      if (peakY !== null) {
        const fall = peakY - pos.y;
        if (fall > SURVIVAL.FALL_SAFE) damage(Math.floor(fall - SURVIVAL.FALL_SAFE), '추락했다', null);
      }
      peakY = null;
    } else if (peakY === null || pos.y > peakY) {
      peakY = pos.y;
    }
  }

  return {
    pos, vel, reset, update, damage, heal, eat, addExhaustion, survivalTick, respawn,
    setMode, setSpawn,
    get eyeY() { return EYE; },
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    get onGround() { return onGround; },
    get flying() { return flying; }, set flying(v) { flying = v; if (v) vel.y = 0; },
    get inWater() { return lastInWater; },
    get mode() { return mode; },
    get hp() { return hp; }, set hp(v) { hp = Math.max(0, Math.min(SURVIVAL.MAX_HP, v)); },
    get food() { return food; }, set food(v) { food = Math.max(0, Math.min(SURVIVAL.MAX_FOOD, v)); },
    get air() { return air; },
    get dead() { return dead; },
    get spawnPoint() { return spawnPoint; },
    set onHurt(fn) { onHurt = fn; },
    set onDeath(fn) { onDeath = fn; },
    set onEat(fn) { onEat = fn; }
  };
})();
