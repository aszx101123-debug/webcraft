'use strict';

const Player = (() => {
  const HW = .3, PH = 1.8, EYE = 1.62;
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const spawnPoint = new THREE.Vector3();
  let yaw = 0, pitch = -.2, onGround = false, flying = false, sneaking = false;
  let mode = GAME_MODE.CREATIVE;
  let hp = SURVIVAL.MAX_HP, food = SURVIVAL.MAX_FOOD, air = SURVIVAL.MAX_AIR;
  let exhaustion = 0, regenT = 0, starveT = 0, airT = 0, drownT = 0;
  let peakY = null, dead = false, lastInWater = false, headSubmerged = false, waterCoverage = 0;
  let onBeforeDamage=null;
  let cactusDamageCooldown=0;
  let movingSprint=false;
  let slowT=0,hungerT=0;


  function isWater(id) { return id === BLOCK.WATER || id === BLOCK.WATER_FLOW; }

  function sampleWaterAt(x, y, z) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const id = World.getBlock(bx, by, bz);
    if (!isWater(id)) return false;
    const level = id === BLOCK.WATER ? 8 : (World.getFluidLevel(bx, by, bz) || 1);
    // Only exposed water has a lowered surface. Covered cells are completely
    // filled, otherwise every block boundary becomes a false pocket of air.
    const surface = by + (isWater(World.getBlock(bx, by + 1, bz)) ? 1 : 0.15 + 0.72 * (level / 8));
    return surface >= y;
  }

  function sampleWaterState() {
    const samples = [[0,0],[.22,.22],[.22,-.22],[-.22,.22],[-.22,-.22]];
    let feetHits = 0, bodyHits = 0, headHits = 0;
    const feetY = pos.y + .14, bodyY = pos.y + .9, headY = pos.y + EYE;
    for (const [dx, dz] of samples) {
      if (sampleWaterAt(pos.x + dx, feetY, pos.z + dz)) feetHits++;
      if (sampleWaterAt(pos.x + dx, bodyY, pos.z + dz)) bodyHits++;
      if (sampleWaterAt(pos.x + dx, headY, pos.z + dz)) headHits++;
    }
    const inWater = feetHits >= 2 || bodyHits >= 2;
    const headWet = headHits >= 3 || (headHits >= 1 && sampleWaterAt(pos.x, headY, pos.z));
    return { inWater, headSubmerged: headWet, coverage: Math.max(feetHits, bodyHits) / samples.length };
  }
  let onHurt = null, onDeath = null, onEat = null;

  function reset(x, y, z, yw = 0, pt = -.2, fly = false) {
    pos.set(x, y, z);
    vel.set(0, 0, 0);
    yaw = yw; pitch = pt;
    onGround = false; flying = fly && mode === GAME_MODE.CREATIVE;
    sneaking = false;
    cactusDamageCooldown=0;
    movingSprint=false;
    slowT=hungerT=0;
    setSpawn(x, y, z);
  }

  function setSpawn(x, y, z) { spawnPoint.set(x, y, z); }

  function setMode(m) {
    mode = m;
    if (m === GAME_MODE.SURVIVAL) flying = false;
  }

  function collisionBoxesAt(bx,by,bz) {
    if(by>=CONFIG.HEIGHT)return [];
    if(by<0)return [[0,0,0,1,1,1]];
    // Do not walk through terrain while the destination chunk is loading.
    if(!World.getChunk(bx>>4,bz>>4))return [[0,0,0,1,1,1]];
    const id=World.getBlock(bx,by,bz);
    return isSolidBlock(id)
      ? getBlockBoxes(id,BlockFurniture.stateAt(bx,by,bz)) : [];
  }

  function worldCollisionAt(x,y,z) {
    for(let bx=Math.floor(x-HW);bx<=Math.floor(x+HW);bx++)
      for(let by=Math.floor(y);by<=Math.floor(y+PH-1e-4);by++)
        for(let bz=Math.floor(z-HW);bz<=Math.floor(z+HW);bz++){
          for(const b of collisionBoxesAt(bx,by,bz)){
            if(x+HW>bx+b[0]+1e-5&&x-HW<bx+b[3]-1e-5 &&
               y+PH>by+b[1]+1e-5&&y<by+b[4]-1e-5 &&
               z+HW>bz+b[2]+1e-5&&z-HW<bz+b[5]-1e-5)
              return true;
          }
        }
    return false;
  }

  function hasGroundSupportAt(x,y,z) {
    // A half-block descent is safe, including stairs and slabs. Check the
    // actual collision boxes rather than treating every block as a full cube.
    for(let bx=Math.floor(x-HW);bx<=Math.floor(x+HW);bx++)
      for(let by=Math.floor(y-.55);by<=Math.floor(y+.005);by++)
        for(let bz=Math.floor(z-HW);bz<=Math.floor(z+HW);bz++)
          for(const b of collisionBoxesAt(bx,by,bz)){
            const top=by+b[4];
            if(top>y+.005 || top<y-.55)continue;
            if(x+HW>bx+b[0]+1e-5&&x-HW<bx+b[3]-1e-5&&
               z+HW>bz+b[2]+1e-5&&z-HW<bz+b[5]-1e-5)return true;
          }
    return false;
  }

  function sneakDistance(axis,dist) {
    const supported=t=>hasGroundSupportAt(
      pos.x+(axis==='x'?dist*t:0),pos.y,
      pos.z+(axis==='z'?dist*t:0));
    if(supported(1)||!supported(0))return dist;
    let safe=0,unsafe=1;
    for(let i=0;i<10;i++){
      const middle=(safe+unsafe)/2;
      if(supported(middle))safe=middle;
      else unsafe=middle;
    }
    return dist*safe;
  }

  function moveAxis(axis,dist,protectEdge=false) {
    if(!dist)return false;
    const safeDist=protectEdge?sneakDistance(axis,dist):dist;
    let hit=safeDist!==dist;
    dist=safeDist;
    if(!dist)return hit;
    pos[axis]+=dist;
    const x0=Math.floor(pos.x-HW),x1=Math.floor(pos.x+HW);
    const y0=Math.floor(pos.y),y1=Math.floor(pos.y+PH-1e-4);
    const z0=Math.floor(pos.z-HW),z1=Math.floor(pos.z+HW);
    for(let bx=x0;bx<=x1;bx++)
      for(let by=y0;by<=y1;by++)
        for(let bz=z0;bz<=z1;bz++)for(const box of collisionBoxesAt(bx,by,bz)){
          const minX=bx+box[0],maxX=bx+box[3];
          const minY=by+box[1],maxY=by+box[4];
          const minZ=bz+box[2],maxZ=bz+box[5];
          if(!(pos.x+HW>minX+1e-5&&pos.x-HW<maxX-1e-5&&
               pos.y+PH>minY+1e-5&&pos.y<maxY-1e-5&&
               pos.z+HW>minZ+1e-5&&pos.z-HW<maxZ-1e-5))continue;
          if(axis!=='y'&&onGround){
            const rise=maxY-pos.y;
            if(rise>.001&&rise<=.53 &&
               !worldCollisionAt(pos.x,pos.y+rise+.002,pos.z)){
              pos.y+=rise+.002;
              continue;
            }
          }
          hit=true;
          if(axis==='y'){
            if(dist<0){pos.y=Math.max(pos.y,maxY);onGround=true;}
            else pos.y=Math.min(pos.y,minY-PH-.001);
          } else if(axis==='x') {
            pos.x=dist>0?Math.min(pos.x,minX-HW-.001):Math.max(pos.x,maxX+HW+.001);
          } else {
            pos.z=dist>0?Math.min(pos.z,minZ-HW-.001):Math.max(pos.z,maxZ+HW+.001);
          }
        }
    return hit;
  }

  function damage(amount, cause, sourcePos) {
    if(mode===GAME_MODE.CREATIVE||dead||amount<=0)return false;
    if(onBeforeDamage)amount=onBeforeDamage(amount,cause,sourcePos);
    if(amount<=0)return false;
    const armor=Inventory.getArmorDefense?Inventory.getArmorDefense():0;const reduced=Math.max(1,Math.ceil(amount*Math.max(.2,1-armor*.04)));hp=Math.max(0,hp-reduced);if(armor>0){const eq=Inventory.getEquipment();for(const k of ['head','chest','legs','feet']){const a=eq[k]&&getArmorDef(eq[k].id);if(a){eq[k].durability=Math.max(0,(eq[k].durability||a.maxDurability)-1);if(eq[k].durability<=0)Inventory.takeEquipment(k);break;}}}
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

  // Cacti are solid, so standing against a side must count as contact
  // even when collision resolution keeps the player a tiny gap from the block.
  function checkCactusContact(dt) {
    cactusDamageCooldown=Math.max(0,cactusDamageCooldown-dt);
    if(mode!==GAME_MODE.SURVIVAL||dead||cactusDamageCooldown>0)return;
    const reach=.075;
    const x0=Math.floor(pos.x-HW-reach),x1=Math.floor(pos.x+HW+reach);
    const z0=Math.floor(pos.z-HW-reach),z1=Math.floor(pos.z+HW+reach);
    const y0=Math.floor(pos.y-reach),y1=Math.floor(pos.y+PH-.06);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(let y=y0;y<=y1;y++){
      if(World.getBlock(x,y,z)!==BLOCK.CACTUS)continue;
      const b=getBlockBoxes(BLOCK.CACTUS)[0];
      if(pos.x+HW+reach<=x+b[0]||pos.x-HW-reach>=x+b[3]||
         pos.z+HW+reach<=z+b[2]||pos.z-HW-reach>=z+b[5]||
         pos.y+PH<=y+b[1]||pos.y-reach>=y+b[4])continue;
      cactusDamageCooldown=.9;
      damage(1,'선인장 가시',null);
      return;
    }
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
    if(Difficulty.isPeaceful()){
      // Peaceful automatically replenishes food and heals without spending it.
      food=SURVIVAL.MAX_FOOD;
      exhaustion=0;starveT=0;hungerT=0;slowT=0;
      if(hp<SURVIVAL.MAX_HP){
        regenT+=dt;
        if(regenT>=1){regenT-=1;heal(1);}
      }else regenT=0;
      return;
    }
    if(hungerT>0){hungerT=Math.max(0,hungerT-dt);addExhaustion(dt*.42);}
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
        if(hp>Difficulty.starveFloor()){
          // Use the normal damage pathway so hard-mode starvation can trigger
          // the existing death screen, while easy mode stops at half health.
          damage(1,'굶주림',null);
        }
      }
    } else starveT = 0;

    const ws = sampleWaterState();
    headSubmerged = ws.headSubmerged;
    waterCoverage = ws.coverage;
    if (headSubmerged) {
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
    headSubmerged = false;
    waterCoverage = 0;
    exhaustion = 0;
    regenT = starveT = airT = drownT = 0;
    peakY = null;
    dead = false;
    sneaking = false;
    cactusDamageCooldown=0;
    movingSprint=false;
    slowT=hungerT=0;
  }

  function update(dt, keys) {
    slowT=Math.max(0,slowT-dt);
    const f = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const s = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    const crouch = !!(keys['ShiftLeft'] || keys['ShiftRight']);
    const sprint = (keys['ControlLeft'] || keys['ControlRight'] || keys.DoubleTapSprint) && f > 0 && !crouch &&
      (mode !== GAME_MODE.SURVIVAL || food > 6);
    const ws = sampleWaterState();
    const inWater = ws.inWater;
    headSubmerged = ws.headSubmerged;
    waterCoverage = ws.coverage;
    lastInWater = inWater;
    const canFly = mode === GAME_MODE.CREATIVE && flying;
    sneaking = crouch && !canFly && !inWater;
    movingSprint=sprint && !canFly && !inWater;
    const speed=canFly?CONFIG.FLY:(movingSprint?CONFIG.SPRINT:CONFIG.SPEED)
      *(inWater?.55:1)*(crouch?.3:1)*(slowT>0?.67:1);
    const len = Math.hypot(f, s) || 1;
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    const wx = (-sy * f + cy * s) / len * speed;
    const wz = (-cy * f - sy * s) / len * speed;

    // Frame-rate independent momentum: sharp starts/stops on the ground,
    // weaker mid-air steering and extra glide on ice, as in a block sandbox.
    const wasGrounded=onGround;
    const hasInput=f!==0||s!==0;
    if (canFly) {
      const flyRate=hasInput?14:12;
      const k=1-Math.exp(-Math.min(.05,dt)*flyRate);
      vel.x+=(wx-vel.x)*k;
      vel.z+=(wz-vel.z)*k;
      const up=(keys['Space']?1:0)-(crouch?1:0);
      vel.y+=(up*CONFIG.FLY-vel.y)*k;
    } else {
      const underfoot=World.getBlock(Math.floor(pos.x),Math.floor(pos.y-.08),Math.floor(pos.z));
      const slippery=wasGrounded && underfoot===BLOCK.ICE && !inWater;
      // Ground traction is high; ice retains velocity and jumping carries it.
      const rate=inWater?6.5:slippery?(hasInput?3.1:1.4):
        wasGrounded?(hasInput?19:16):hasInput?2.6:1.05;
      const k=1-Math.exp(-Math.min(.05,dt)*rate);
      vel.x+=(wx-vel.x)*k;
      vel.z+=(wz-vel.z)*k;
      if(inWater){
        vel.y-=CONFIG.GRAVITY*.24*dt;
        vel.y=Math.max(vel.y,-4);
        if(keys['Space'])vel.y=Math.min(vel.y+26*dt,4.2);
      }else{
        if(keys['Space'] && wasGrounded){
          vel.y=CONFIG.JUMP;
          if(sprint){
            // A sprint-jump carries a short forward impulse, rather than
            // producing identical jumps while walking and running.
            vel.x-=Math.sin(yaw)*.60;
            vel.z-=Math.cos(yaw)*.60;
          }
          addExhaustion(SURVIVAL.JUMP_COST);
        }
        vel.y-=CONFIG.GRAVITY*dt;
      }
      vel.y=Math.max(vel.y,-46);
    }

    onGround = false;
    const maxDisp = Math.max(Math.abs(vel.x), Math.abs(vel.y), Math.abs(vel.z)) * dt;
    const steps = Math.max(1, Math.ceil(maxDisp / .35));
    for (let i = 0; i < steps; i++) {
      if (moveAxis('y', vel.y * dt / steps)) vel.y = 0;
      const protectEdge=sneaking && onGround && vel.y<=0;
      if (moveAxis('x', vel.x * dt / steps,protectEdge)) vel.x = 0;
      if (moveAxis('z', vel.z * dt / steps,protectEdge)) vel.z = 0;
    }

    checkCactusContact(dt);

    const afterWater = sampleWaterState();
    lastInWater = afterWater.inWater;
    headSubmerged = afterWater.headSubmerged;
    waterCoverage = afterWater.coverage;

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

  function applyMobEffect(effect,duration){
    if(mode!==GAME_MODE.SURVIVAL||dead)return;
    const seconds=Math.max(0,Math.min(15,Number(duration)||0));
    if(effect==='slow')slowT=Math.max(slowT,seconds);
    if(effect==='hunger')hungerT=Math.max(hungerT,seconds);
  }

  return {
    pos, vel, reset, update, damage, heal, eat, addExhaustion, survivalTick, respawn, applyMobEffect,
    setMode, setSpawn,
    get eyeY() { return sneaking ? EYE - .12 : EYE; },
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    get onGround() { return onGround; },
    get sprinting() { return movingSprint; },
    get sneaking() { return sneaking; },
    get flying() { return flying; }, set flying(v) { flying = v; if (v) vel.y = 0; },
    get inWater() { return lastInWater; },
    get headSubmerged() { return headSubmerged; },
    get waterCoverage() { return waterCoverage; },
    get mode() { return mode; },
    get hp() { return hp; }, set hp(v) { hp = Math.max(0, Math.min(SURVIVAL.MAX_HP, v)); },
    get food() { return food; },
    get mobEffects(){return {slowness:slowT,hunger:hungerT};}, set food(v) { food = Math.max(0, Math.min(SURVIVAL.MAX_FOOD, v)); },
    get air() { return air; },
    get dead() { return dead; },
    get spawnPoint() { return spawnPoint; },
    set onHurt(fn) { onHurt = fn; },
    set onDeath(fn) { onDeath = fn; },
    set onEat(fn) { onEat = fn; },
    set onBeforeDamage(fn) {onBeforeDamage=typeof fn==='function'?fn:null;}
  };
})();
