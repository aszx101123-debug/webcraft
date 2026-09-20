'use strict';

(() => {
  const params = new URLSearchParams(location.search);
  let worldId = params.get('world') || SaveSystem.currentId();
  let saved = worldId ? SaveSystem.load(worldId) : null;

  function seedFromParam(v) {
    if (!v) return null;
    if (/^\d+$/.test(v)) return parseInt(v, 10) % 2147483647;
    let h = 5381;
    for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    return h % 2147483647;
  }
  if (!worldId || !saved) {
    const seedParam = seedFromParam(params.get('seed'));
    worldId = SaveSystem.createWorld(params.get('name') || '새로운 월드', seedParam ?? Math.floor(Math.random() * 2147483647), params.get('mode') || 'survival');
    saved = SaveSystem.load(worldId);
  }

  const seed = saved.seed;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 500);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x54492e, .8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d0, .65);
  sun.position.set(60, 100, 35);
  scene.add(sun);

  Textures.init();
  World.init(scene, seed, saved ? saved.edits : null);
  Mobs.init(scene);
  Drops.init(scene, (id, n) => {
    UI.showToast(`${getItemName(id)} +${n}`);
    blip(640, .05, 'square', .04);
    setTimeout(() => blip(880, .05, 'square', .03), 60);
    UI.renderHotbar();
  });

  const state = {
    started: false,
    locked: false,
    ready: false,
    time: saved ? saved.time : .22,
    renderDist: saved ? saved.renderDist : CONFIG.RENDER_DIST,
    sound: saved ? saved.sound !== false : true,
    suppressPause: false,
    mode: saved && saved.version >= 2 && saved.mode ? saved.mode : GAME_MODE.CREATIVE
  };

  Player.setMode(state.mode);
  let savedHotbar = null;
  if (saved && Array.isArray(saved.hotbar)) {
    savedHotbar = saved.hotbar.map(s => (typeof s === 'number' && s > 0) ? { id: s, count: -1 } : s);
  }
  Inventory.init(state.mode, saved ? savedHotbar : null);

  if (saved && saved.player) {
    const p = saved.player;
    Player.reset(p.x, p.y, p.z, p.yaw || 0, p.pitch || -.2, !!p.flying);
    if (saved.version >= 2) {
      if (typeof saved.hp === 'number') Player.hp = saved.hp <= 0 ? SURVIVAL.MAX_HP : saved.hp;
      if (typeof saved.food === 'number') Player.food = saved.food;
      if (saved.spawn) Player.setSpawn(saved.spawn.x, saved.spawn.y, saved.spawn.z);
      if (Player.hp <= 0) Player.respawn();
    }
  } else {
    let sx = 8, sz = 8, found = false;
    for (let i = 0; i < 400; i++) {
      if (World.heightAt(sx, sz) > CONFIG.SEA + 1) { found = true; break; }
      sx += 11; sz += 7;
    }
    if (!found) { sx = 8; sz = 8; }
    Player.reset(sx + .5, World.heightAt(sx, sz) + 2.5, sz + .5);
  }

  Player.onHurt = () => {
    UI.flashVignette();
    blip(130, .18, 'sawtooth', .08);
  };
  Player.onDeath = cause => {
    state.suppressPause = true;
    document.exitPointerLock();
    UI.showDeath(cause);
    doSave(true);
  };
  Player.onEat = () => { };

  Mobs.onEvent = (type, m) => {
    if (type === 'hurt') blip(m.def.hostile ? 90 : 140, .1, 'triangle', .06);
    else if (type === 'die') blip(60, .22, 'sawtooth', .07);
    else if (type === 'shoot') blip(720, .06, 'square', .03);
  };

  const skyDay = new THREE.Color(0x8ecfef);
  const skyNight = new THREE.Color(0x0a0e1a);
  const skyDusk = new THREE.Color(0xe8956b);
  const skyNow = new THREE.Color();
  function applyFog() {
    const far = state.renderDist * 16 + 10;
    scene.fog = new THREE.Fog(skyNow.getHex(), far * .55, far);
    camera.far = Math.max(300, far * 2.2);
    camera.updateProjectionMatrix();
  }

  function updateSky(dt) {
    state.time = (state.time + dt / CONFIG.DAY_LENGTH) % 1;
    const e = Math.sin(state.time * Math.PI * 2);
    const f = Math.max(0, Math.min(1, (e + .15) / .75));
    skyNow.copy(skyNight).lerp(skyDay, f);
    const dusk = Math.max(0, 1 - Math.abs(e) / .22) * .5;
    if (dusk > 0) skyNow.lerp(skyDusk, dusk);
    scene.background = skyNow;
    scene.fog.color.copy(skyNow);
    sun.intensity = .15 + .6 * f;
    hemi.intensity = .3 + .5 * f;
    Mobs.setEnv(f < .28, f);
    const hours = (state.time * 24 + 6) % 24;
    const hh = String(Math.floor(hours)).padStart(2, '0');
    const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    UI.setTime(`${f > .45 ? '☀' : '☾'} ${hh}:${mm}`);
  }

  function doSave(silent) {
    const ok = SaveSystem.save({
      version: 2,
      savedAt: Date.now(),
      seed,
      time: state.time,
      renderDist: state.renderDist,
      sound: state.sound,
      mode: state.mode,
      hp: Player.hp,
      food: Player.food,
      spawn: { x: Player.spawnPoint.x, y: Player.spawnPoint.y, z: Player.spawnPoint.z },
      hotbar: Inventory.serialize(),
      player: {
        x: Player.pos.x, y: Player.pos.y, z: Player.pos.z,
        yaw: Player.yaw, pitch: Player.pitch, flying: Player.flying
      },
      worldId,
      worldName: (SaveSystem.getWorldMeta(worldId) || {}).name || '새로운 월드',
      edits: World.getEdits()
    }, worldId);
    if (!silent) UI.showToast(ok ? '월드가 저장되었습니다' : '저장 실패: 저장 공간 부족');
    return ok;
  }

  let audioCtx = null;
  function blip(freq, dur = .08, type = 'square', vol = .05) {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { }
  }

  Interact.init(camera, scene);
  applyFog();
  updateSky(0);

  function setMode(mode) {
    state.mode = mode;
    Player.setMode(mode);
    Inventory.setMode(mode);
    Mobs.setMode(mode);
    doSave(true);
  }

  const keys = {};
  const canvas = renderer.domElement;

  window.addEventListener('webcraft-inventory-closed', () => {
    if (state.started && !Player.dead) {
      state.suppressPause = true;
      startGameInput();
    }
  });

  function startGameInput() {
    canvas.requestPointerLock();
  }

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'F3' || e.code === 'KeyE' || e.code === 'KeyB') {
      e.preventDefault();
      return;
    }

    if (!state.locked) return;

    if (e.code.startsWith('Digit')) {
      const n = +e.code[5];
      if (n >= 1 && n <= 9) { UI.setSelected(n - 1); blip(300, .04, 'square', .02); }
    }

    if (e.code === 'KeyF') {
      if (state.mode !== GAME_MODE.CREATIVE) return;
      Player.flying = !Player.flying;
      blip(Player.flying ? 520 : 260, .09, 'triangle', .04);
    }

  });

  document.addEventListener('keyup', e => keys[e.code] = false);

  document.addEventListener('mousemove', e => {
    if (!state.locked) return;
    Player.yaw -= e.movementX * .0022;
    Player.pitch = Math.max(-1.55, Math.min(1.55, Player.pitch - e.movementY * .0022));
  });

  document.addEventListener('mousedown', e => {
    if (!state.locked || Player.dead) return;

    if (e.button === 0) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      const selected = Inventory.selectedSlot();
      const weaponDamage = selected && getToolDef(selected.id)
        ? getWeaponDamage(selected.id)
        : SURVIVAL.FIST_DMG;
      const hitMob = Mobs.tryAttack(camera.position, dir, 3.6, weaponDamage);

      if (hitMob) {
        Interact.cancelBreak();
        Player.addExhaustion(SURVIVAL.ATTACK_COST);

        const weapon = selected && getToolDef(selected.id)
          && getToolDef(selected.id).type === 'sword';
        if (state.mode === GAME_MODE.SURVIVAL && weapon) {
          const result = Inventory.damageSelectedTool(1);

        }
      } else {
        Interact.beginBreak(state.mode === GAME_MODE.SURVIVAL);
      }
    } else if (e.button === 2) {
      const target = Interact.getTarget();

      if (target && target.id === BLOCK.CRAFTING_TABLE) {
        Interact.cancelBreak();
        return;
      }

      if (target && target.id === BLOCK.BED) {
        Player.setSpawn(target.x + .5, target.y + 1, target.z + .5);
        blip(440, .08, 'sine', .04);
        return;
      }

      const s = Inventory.selectedSlot();
      if (!s) return;

      if (isFoodId(s.id)) {
        if (Player.eat(ITEMS[s.id].food)) {
          blip(280, .07, 'triangle', .05);
          setTimeout(() => blip(200, .08, 'triangle', .05), 100);
          Inventory.consumeSelected();

      } else if (isBlockId(s.id)) {
        if (Interact.tryPlace(s.id)) {
          Inventory.consumeSelected();
          blip(190, .07, 'square', .05);
        }
      }
    } else if (e.button === 1) {
      e.preventDefault();
      const id = Interact.pickBlock();
      if (id) {
        Inventory.setSlot(Inventory.getSelected(), id);
        blip(340, .05, 'square', .03);
      }
    }
  });

  document.addEventListener('mouseup', e => {
    if (e.button === 0) Interact.cancelBreak();
  });
  addEventListener('blur', () => Interact.cancelBreak());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (!state.locked) return;
    UI.setSelected(Inventory.getSelected() + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (state.locked) {
      state.started = true;
      state.suppressPause = false;
    } else if (state.started && !Player.dead) {
      Interact.cancelBreak();
      doSave(true);
    }
  });

  canvas.addEventListener('click', () => {
    if (state.ready && !state.locked && !Player.dead) startGameInput();
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  addEventListener('beforeunload', () => { if (state.started) doSave(true); });
  setInterval(() => { if (state.started) doSave(true); }, CONFIG.AUTOSAVE_SEC * 1000);

  let frames = 0, fpsTime = 0, fps = 0;
  const clock = new THREE.Clock();

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05);

    if (!state.ready) {
      World.update(Player.pos.x, Player.pos.z, state.renderDist, 6, 10);
      if (World.isReady()) {
        state.ready = true;
      }
    } else {
      const active = state.started && state.locked && !Player.dead;
      if (active) {
        Player.update(dt, keys);
        Interact.update();
        updateSky(dt);
        const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'] && !Player.flying;
        Player.survivalTick(dt, sprinting);
        const mineResult = Interact.updateMining(dt, state.mode === GAME_MODE.SURVIVAL);
        if (mineResult.broken) blip(95, .12, 'triangle', .09);
        Mobs.update(dt, true);
        Drops.update(dt, Player.pos, state.mode === GAME_MODE.SURVIVAL && !Player.dead);
      } else {
        updateSky(dt);
      }
      World.update(Player.pos.x, Player.pos.z, state.renderDist);
    }

    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'] && !Player.flying;
    const targetFov = sprinting ? 79 : 72;
    if (Math.abs(camera.fov - targetFov) > .1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }

    camera.position.set(Player.pos.x, Player.pos.y + Player.eyeY, Player.pos.z);
    camera.rotation.set(Player.pitch, Player.yaw, 0);

    frames++;
    fpsTime += dt;
    if (fpsTime >= .5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }

    renderer.render(scene, camera);
  }
  loop();
})();
