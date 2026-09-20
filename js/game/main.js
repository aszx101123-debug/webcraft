'use strict';

(() => {
  const params = new URLSearchParams(location.search);

  function seedFromParam(v) {
    if (!v) return null;
    if (/^\d+$/.test(v)) return parseInt(v, 10) % 2147483647;
    let h = 5381;
    for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    return h % 2147483647;
  }

  let worldId = params.get('world') || SaveSystem.getActiveId();
  if (!worldId) worldId = SaveSystem.ensureDefault(seedFromParam(params.get('seed')));
  if (!worldId) {
    document.body.textContent = '월드를 만들 수 없습니다. 브라우저 저장 공간을 확인해 주세요.';
    return;
  }
  SaveSystem.setActiveId(worldId);
  let worldMeta = SaveSystem.get(worldId);
  let saved = SaveSystem.load(worldId);
  if (!worldMeta) {
    worldId = SaveSystem.ensureDefault(seedFromParam(params.get('seed')));
    worldMeta = SaveSystem.get(worldId);
    saved = SaveSystem.load(worldId);
  }
  const seed = saved?.seed ?? worldMeta.seed;

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
  Fluids.init();
  PlayerModel.init(scene);
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
    thirdPerson: saved && saved.thirdPerson === true,
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
    const ok = SaveSystem.save(worldId, {
      version: 3,
      savedAt: Date.now(),
      worldId,
      worldName: worldMeta.name,
      seed,
      time: state.time,
      renderDist: state.renderDist,
      sound: state.sound,
      mode: state.mode,
      hp: Player.hp,
      food: Player.food,
      spawn: { x: Player.spawnPoint.x, y: Player.spawnPoint.y, z: Player.spawnPoint.z },
      hotbar: Inventory.serialize(),
      thirdPerson: state.thirdPerson,
      player: {
        x: Player.pos.x, y: Player.pos.y, z: Player.pos.z,
        yaw: Player.yaw, pitch: Player.pitch, flying: Player.flying
      },
      edits: World.getEdits()
    });
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

  UI.renderHotbar();
  UI.setModeLabel(state.mode);
  UI.renderWorlds(SaveSystem.list(), worldId);
  UI.showOverlay('start');
  UI.setStartEnabled(false);
  Interact.init(camera, scene);
  applyFog();
  updateSky(0);
  const modeLabel = state.mode === GAME_MODE.SURVIVAL ? '서바이벌' : '크리에이티브';
  document.getElementById('seed-label').textContent =
    `월드: ${worldMeta.name} · 시드: ${seed} · ${saved ? `${modeLabel} 월드 불러옴` : '새 월드 생성'}`;

  function setMode(mode) {
    state.mode = mode;
    Player.setMode(mode);
    Inventory.setMode(mode);
    Mobs.setMode(mode);
    UI.setModeLabel(mode);
    UI.renderHotbar();
    syncModeBtn();
    doSave(true);
    UI.showToast(mode === GAME_MODE.SURVIVAL ? '서바이벌 모드 — 행운을 빕니다' : '크리에이티브 모드');
  }

  const keys = {};
  let miningHeld = false;
  const canvas = renderer.domElement;

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape' && UI.isCraftingOpen()) {
      UI.closeCrafting();
      canvas.requestPointerLock();
      return;
    }
    if (e.code === 'F3') { e.preventDefault(); const h = document.getElementById('hud-info'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
    if (e.code === 'F5') {
      e.preventDefault();
      state.thirdPerson = !state.thirdPerson;
      UI.showToast(state.thirdPerson ? '3인칭 카메라 ON' : '1인칭 카메라 ON');
    }
    if (!state.locked) return;
    if (e.code.startsWith('Digit')) {
      const n = +e.code[5];
      if (n >= 1 && n <= 9) { UI.setSelected(n - 1); blip(300, .04, 'square', .02); }
    }
    if (e.code === 'KeyF') {
      if (state.mode !== GAME_MODE.CREATIVE) { UI.showToast('서바이벌에서는 날 수 없습니다'); return; }
      Player.flying = !Player.flying;
      UI.showToast(Player.flying ? '비행 모드 ON' : '비행 모드 OFF');
      blip(Player.flying ? 520 : 260, .09, 'triangle', .04);
    }
    if (e.code === 'KeyC') {
      state.suppressPause = true;
      document.exitPointerLock();
      UI.openCrafting();
      return;
    }
    if (e.code === 'KeyB' || e.code === 'KeyE') {
      if (state.mode !== GAME_MODE.CREATIVE) { UI.showToast('서바이벌에서는 블록을 직접 캐서 얻으세요'); return; }
      state.suppressPause = true;
      document.exitPointerLock();
      UI.openPicker(id => {
        Inventory.setSlot(Inventory.getSelected(), id);
        UI.renderHotbar();
        blip(340, .05, 'square', .03);
        canvas.requestPointerLock();
      });
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
      const hitMob = Mobs.tryAttack(camera.position, dir, 3.6);
      if (hitMob) {
        Player.addExhaustion(SURVIVAL.ATTACK_COST);
      } else if (state.mode === GAME_MODE.SURVIVAL) {
        miningHeld = Interact.startBreak(true);
        UI.setMiningProgress(Interact.miningProgress());
      } else if (Interact.startBreak(false)) {
        miningHeld = false;
        UI.setMiningProgress(0);
        blip(95, .12, 'triangle', .09);
      }
    } else if (e.button === 2) {
      const target = Interact.getTarget();
      if (target && target.id === BLOCK.CRAFTING_TABLE) {
        state.suppressPause = true;
        document.exitPointerLock();
        UI.openCrafting();
        return;
      }
      const s = Inventory.selectedSlot();
      if (!s) return;
      if (isFoodId(s.id)) {
        if (Player.eat(ITEMS[s.id].food)) {
          blip(280, .07, 'triangle', .05);
          setTimeout(() => blip(200, .08, 'triangle', .05), 100);
          Inventory.consumeSelected();
          UI.renderHotbar();
        } else UI.showToast('배가 부릅니다');
      } else if (isBlockId(s.id)) {
        if (Interact.tryPlace(s.id)) {
          Inventory.consumeSelected();
          blip(190, .07, 'square', .05);
          UI.renderHotbar();
        }
      }
    } else if (e.button === 1) {
      e.preventDefault();
      const id = Interact.pickBlock();
      if (id) {
        Inventory.setSlot(Inventory.getSelected(), id);
        UI.renderHotbar();
        blip(340, .05, 'square', .03);
      }
    }
  });
  document.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    miningHeld = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
  });
  addEventListener('blur', () => {
    miningHeld = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
  });
  document.addEventListener('pointerlockerror', () => UI.showToast('마우스 잠금을 시작하지 못했습니다. 게임 화면을 한 번 클릭해 주세요.'));
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
      UI.showOverlay(null);
    } else if (state.started && !Player.dead) {
      miningHeld = false;
      Interact.cancelBreak();
      UI.setMiningProgress(0);
      if (state.suppressPause) { state.suppressPause = false; return; }
      UI.showOverlay('pause');
      doSave(true);
    }
  });

  function createWorldAndOpen(name, rawSeed) {
    const parsed = seedFromParam(rawSeed);
    doSave(true);
    const meta = SaveSystem.create(name, parsed ?? undefined);
    if (!meta) {
      UI.showToast('새 월드를 만들지 못했습니다. 저장 공간을 확인해 주세요.');
      return;
    }
    location.href = 'play.html?world=' + encodeURIComponent(meta.id);
  }

  function openWorldMenu() {
    state.suppressPause = true;
    state.started = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
    document.exitPointerLock();
    UI.closeCrafting();
    UI.showOverlay('start');
    UI.setStartEnabled(state.ready);
    UI.renderWorlds(SaveSystem.list(), worldId);
  }

  const startBtn = document.getElementById('start-btn');
  const btnSurvival = document.getElementById('btn-start-survival');
  const btnCreative = document.getElementById('btn-start-creative');
  if (saved) {
    btnSurvival.classList.add('hidden');
    btnCreative.classList.add('hidden');
    startBtn.textContent = `이어서 플레이 (${modeLabel})`;
  } else {
    startBtn.classList.add('hidden');
  }
  startBtn.addEventListener('click', () => {
    if (!state.ready) return;
    SaveSystem.setActiveId(worldId);
    canvas.requestPointerLock();
  });
  btnSurvival.addEventListener('click', () => { if (!state.ready) return;
    state.mode = GAME_MODE.SURVIVAL;
    Player.setMode(GAME_MODE.SURVIVAL);
    UI.setModeLabel(GAME_MODE.SURVIVAL);
    Inventory.init(GAME_MODE.SURVIVAL, null);
    Mobs.setMode(GAME_MODE.SURVIVAL);
    UI.renderHotbar();
    canvas.requestPointerLock();
  });
  btnCreative.addEventListener('click', () => { if (!state.ready) return;
    state.mode = GAME_MODE.CREATIVE;
    Player.setMode(GAME_MODE.CREATIVE);
    UI.setModeLabel(GAME_MODE.CREATIVE);
    Inventory.init(GAME_MODE.CREATIVE, null);
    Mobs.setMode(GAME_MODE.CREATIVE);
    UI.renderHotbar();
    canvas.requestPointerLock();
  });

  document.getElementById('btn-resume').addEventListener('click', () => canvas.requestPointerLock());
  document.getElementById('btn-crafting').addEventListener('click', () => {
    state.suppressPause = true;
    document.exitPointerLock();
    UI.openCrafting();
  });
  document.getElementById('btn-worlds').addEventListener('click', openWorldMenu);
  document.getElementById('crafting-close').addEventListener('click', () => {
    UI.closeCrafting();
    canvas.requestPointerLock();
  });
  document.getElementById('btn-create-world').addEventListener('click', () => {
    const name = document.getElementById('world-name-input').value.trim();
    const rawSeed = document.getElementById('world-seed-input').value.trim();
    createWorldAndOpen(name, rawSeed);
  });
  document.getElementById('btn-save').addEventListener('click', () => doSave(false));
  document.getElementById('btn-home').addEventListener('click', () => { doSave(true); location.href = 'index.html'; });
  document.getElementById('btn-respawn').addEventListener('click', () => {
    miningHeld = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
    Player.respawn();
    UI.hideDeath();
    canvas.requestPointerLock();
  });
  document.getElementById('picker-close').addEventListener('click', () => { UI.closePicker(); canvas.requestPointerLock(); });
  document.getElementById('btn-newworld').addEventListener('click', () => {
    if (!confirm('현재 월드는 저장된 상태로 남기고 새 월드를 만들까요?')) return;
    const v = document.getElementById('seed-input').value.trim();
    const name = document.getElementById('world-name-input').value.trim();
    createWorldAndOpen(name, v);
  });
  const modeBtn = document.getElementById('btn-mode');
  function syncModeBtn() {
    modeBtn.textContent = state.mode === GAME_MODE.SURVIVAL
      ? '모드: 서바이벌 (전환)'
      : '모드: 크리에이티브 (전환)';
  }
  syncModeBtn();
  modeBtn.addEventListener('click', () => {
    setMode(state.mode === GAME_MODE.SURVIVAL ? GAME_MODE.CREATIVE : GAME_MODE.SURVIVAL);
  });
  const rdSel = document.getElementById('sel-renderdist');
  rdSel.value = String(state.renderDist);
  rdSel.addEventListener('change', () => {
    state.renderDist = +rdSel.value;
    applyFog();
    UI.showToast(`렌더 거리: ${state.renderDist}청크`);
  });
  const soundBtn = document.getElementById('btn-sound');
  const syncSoundBtn = () => soundBtn.textContent = state.sound ? '🔊 소리 켜짐' : '🔇 소리 꺼짐';
  syncSoundBtn();
  soundBtn.addEventListener('click', () => { state.sound = !state.sound; syncSoundBtn(); });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  addEventListener('beforeunload', () => { if (state.started) doSave(true); });
  setInterval(() => { if (state.started) doSave(true); }, CONFIG.AUTOSAVE_SEC * 1000);

  let frames = 0, fpsTime = 0, fps = 0;
  const clock = new THREE.Clock();
  let hudTick = 0;

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05);

    if (!state.ready) {
      World.update(Player.pos.x, Player.pos.z, state.renderDist, 10, 16);
      if (World.isReady()) {
        state.ready = true;
        UI.setStartEnabled(true);
      }
    } else {
      const active = state.started && state.locked && !Player.dead;
      if (active) {
        Player.update(dt, keys);
        Interact.update();
        const mined = Interact.updateMining(dt, state.mode === GAME_MODE.SURVIVAL);
        UI.setMiningProgress(Interact.miningProgress());
        if (mined) {
          miningHeld = false;
          blip(95, .12, 'triangle', .09);
          UI.showToast('블록을 캤습니다');
        }
        if (!Interact.miningProgress()) miningHeld = false;
        updateSky(dt);
        Fluids.update(Player.pos.x, Player.pos.y, Player.pos.z, dt);
        const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'] && !Player.flying;
        Player.survivalTick(dt, sprinting);
        Mobs.update(dt, true);
        Drops.update(dt, Player.pos, state.mode === GAME_MODE.SURVIVAL && !Player.dead);
      } else {
        updateSky(dt);
        Fluids.update(Player.pos.x, Player.pos.y, Player.pos.z, dt);
      }
      World.update(Player.pos.x, Player.pos.z, state.renderDist);
    }

    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'] && !Player.flying;
    const targetFov = sprinting ? 79 : 72;
    if (Math.abs(camera.fov - targetFov) > .1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }

    PlayerModel.update(Player, dt, state.thirdPerson);
    if (state.thirdPerson) {
      const cp = new THREE.Vector3();
      const target = new THREE.Vector3(Player.pos.x, Player.pos.y + 1.15, Player.pos.z);
      const cy = Math.cos(Player.pitch), sy = Math.sin(Player.pitch);
      cp.set(
        Player.pos.x + Math.sin(Player.yaw) * cy * 4.5,
        Player.pos.y + 1.65 + sy * 2.0,
        Player.pos.z + Math.cos(Player.yaw) * cy * 4.5
      );
      camera.position.copy(cp);
      // 벽 안쪽으로 카메라가 들어가지 않도록 간단한 복셀 충돌 보정.
      const dx = cp.x - target.x, dy = cp.y - target.y, dz = cp.z - target.z;
      const dist = Math.hypot(dx, dy, dz);
      const steps = Math.max(1, Math.ceil(dist / .35));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const sx = target.x + dx * t;
        const sy = target.y + dy * t;
        const sz = target.z + dz * t;
        if (isSolidBlock(World.getBlock(Math.floor(sx), Math.floor(sy), Math.floor(sz)))) {
          const safeT = Math.max(0, (i - 1) / steps);
          camera.position.set(target.x + dx * safeT, target.y + dy * safeT, target.z + dz * safeT);
          break;
        }
      }
      camera.lookAt(target);
    } else {
      camera.position.set(Player.pos.x, Player.pos.y + Player.eyeY, Player.pos.z);
      camera.rotation.set(Player.pitch, Player.yaw, 0);
    }

    frames++;
    fpsTime += dt;
    if (fpsTime >= .5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }
    if (++hudTick % 10 === 0) {
      const p = Player.pos;
      const mc = Mobs.counts();
      UI.setHUD(`FPS ${fps} · x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} z ${p.z.toFixed(0)} · 청크 ${World.chunkCount()} · 몹 ${mc.total}`);
      UI.updateSurvival(state.mode, Player.hp, Player.food, Player.air);
    }

    renderer.render(scene, camera);
  }
  loop();
})();
