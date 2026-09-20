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

  let worldId = params.get('world');
  const createRequested = params.get('new') === '1';
  if (createRequested) {
    const newSeed = seedFromParam(params.get('seed')) ?? (Math.floor(Math.random() * 2147483646) + 1);
    worldId = SaveSystem.createWorld(params.get('name') || '새로운 월드', newSeed, params.get('mode') || GAME_MODE.SURVIVAL);
  } else if (!worldId) {
    worldId = SaveSystem.currentId();
    if (!worldId) {
      worldId = SaveSystem.createWorld('새로운 월드', seedFromParam(params.get('seed')) ?? (Math.floor(Math.random() * 2147483646) + 1), GAME_MODE.SURVIVAL);
    }
  }

  const saved = SaveSystem.load(worldId);
  const worldMeta = SaveSystem.getWorldMeta(worldId);
  const rawSeed = saved ? saved.seed : (worldMeta && worldMeta.seed != null ? worldMeta.seed : (seedFromParam(params.get('seed')) ?? (Math.floor(Math.random() * 2147483646) + 1)));
  const seed = typeof rawSeed === 'number' ? rawSeed : seedFromParam(String(rawSeed));

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .1, 500);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x211b16, .28);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d0, .9);
  sun.position.set(60, 100, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  scene.add(sun);

  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  const starCount = 380;
  for (let i = 0; i < starCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const h = Math.random() * Math.PI * .42 + .08;
    const r = 170;
    starPos.push(
      Math.cos(a) * Math.cos(h) * r,
      Math.sin(h) * r,
      Math.sin(a) * Math.cos(h) * r
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 1.15, sizeAttenuation: false, transparent: true, opacity: 0
  }));
  skyGroup.add(stars);

  const celestial = document.createElement('canvas');
  celestial.width = celestial.height = 128;
  const cg = celestial.getContext('2d');
  cg.clearRect(0,0,128,128);
  const sg = cg.createRadialGradient(64,64,5,64,64,48);
  sg.addColorStop(0,'rgba(255,245,205,.98)');
  sg.addColorStop(.45,'rgba(255,233,155,.75)');
  sg.addColorStop(1,'rgba(255,220,130,0)');
  cg.fillStyle = sg; cg.beginPath(); cg.arc(64,64,50,0,Math.PI*2); cg.fill();
  const celestialTex = new THREE.CanvasTexture(celestial);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:celestialTex,transparent:true,depthWrite:false}));
  sunSprite.scale.set(28,28,1);
  skyGroup.add(sunSprite);
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 128;
  const mg = moonCanvas.getContext('2d');
  mg.clearRect(0,0,128,128);
  mg.fillStyle='rgba(220,232,255,.96)'; mg.beginPath(); mg.arc(64,64,34,0,Math.PI*2); mg.fill();
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:moonTex,transparent:true,depthWrite:false}));
  moonSprite.scale.set(18,18,1);
  skyGroup.add(moonSprite);

  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.16,depthWrite:false});
  for(let ci=0;ci<18;ci++){
    const g=new THREE.Group();
    const parts=3+Math.floor(Math.random()*5);
    for(let pi=0;pi<parts;pi++){
      const box=new THREE.Mesh(new THREE.BoxGeometry(7+Math.random()*8,1.2+Math.random()*1.8,5+Math.random()*6),cloudMat);
      box.position.set(pi*4-(parts-1)*2,Math.random()*.9,Math.sin(pi)*1.5);
      g.add(box);
    }
    g.position.set((Math.random()-.5)*150,62+Math.random()*12,(Math.random()-.5)*150);
    cloudGroup.add(g);
  }
  scene.add(cloudGroup);

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
    worldId,
    worldName: (worldMeta && worldMeta.name) || params.get('name') || '새로운 월드',
    started: false,
    locked: false,
    ready: false,
    time: saved ? saved.time : .22,
    renderDist: saved ? saved.renderDist : CONFIG.RENDER_DIST,
    sound: saved ? saved.sound !== false : true,
    suppressPause: false,
    mode: saved && saved.version >= 2 && saved.mode
      ? saved.mode
      : ((worldMeta && worldMeta.mode) || (createRequested && params.get('mode')) || GAME_MODE.CREATIVE)
  };

  Player.setMode(state.mode);
  let savedInventory=null;
  if(saved&&Array.isArray(saved.inventory)) savedInventory=saved.inventory;
  else if(saved&&Array.isArray(saved.hotbar)) savedInventory=saved.hotbar.map(s=>(typeof s==='number'&&s>0)?{id:s,count:-1}:s);
  Inventory.init(state.mode,savedInventory);

  if (saved && saved.player) {
    const p = saved.player;
    Player.reset(p.x, p.y, p.z, p.yaw || 0, p.pitch || -.2, !!p.flying);
    if (saved.version >= 2) {
      if (typeof saved.hp === 'number') Player.hp = saved.hp <= 0 ? SURVIVAL.MAX_HP : saved.hp;
      if (typeof saved.food === 'number') Player.food = saved.food;
      if (typeof saved.xp === 'number' || typeof saved.level === 'number') Player.setXP(saved.xp || 0, saved.level || 0);
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
    else if (type === 'xp' && m && m.amount) {
      const gained=Player.addXP(m.amount);
      blip(520 + m.amount*22, .07, 'sine', .035);
      if(gained>0) UI.showToast('레벨 업! Lv.'+Player.level);
    } else if (type === 'explode') blip(85, .18, 'sawtooth', .09);
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
    const celestialAngle = state.time * Math.PI * 2;
    const celestialRadius = 135;
    const sx = Math.cos(celestialAngle) * celestialRadius;
    const sy = Math.sin(celestialAngle) * celestialRadius;
    const sz = Math.sin(celestialAngle) * 35;
    sunSprite.position.set(sx, sy, sz);
    moonSprite.position.set(-sx, -sy, -sz);
    sunSprite.material.opacity = Math.max(0, Math.min(1, f * 1.35));
    moonSprite.material.opacity = Math.max(0, Math.min(1, (1-f) * 1.45));
    stars.material.opacity = Math.max(0, Math.min(.9, (1-f) * 1.15));
    cloudMat.opacity = .05 + f * .22;
    cloudGroup.position.x = Player.pos.x * .92;
    cloudGroup.position.z = Player.pos.z * .92;
    cloudGroup.position.x += state.time * 10;
    cloudGroup.position.z += Math.sin(state.time * Math.PI * 2) * 2;
    sun.intensity = .08 + .82 * f;
    hemi.intensity = .07 + .25 * f;
    Mobs.setEnv(f < .28, f);
    const hours = (state.time * 24 + 6) % 24;
    const hh = String(Math.floor(hours)).padStart(2, '0');
    const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    UI.setTime(`${f > .45 ? '☀' : '☾'} ${hh}:${mm}`);
  }

  function doSave(silent) {
    const ok = SaveSystem.save({
      version: 4,
      worldName: state.worldName,
      savedAt: Date.now(),
      seed,
      time: state.time,
      renderDist: state.renderDist,
      sound: state.sound,
      mode: state.mode,
      hp: Player.hp,
      food: Player.food,
      xp: Player.xp,
      level: Player.level,
      spawn: { x: Player.spawnPoint.x, y: Player.spawnPoint.y, z: Player.spawnPoint.z },
      hotbar: Inventory.serialize().slice(0, Inventory.HOTBAR_SIZE),
      inventory: Inventory.serialize(),
      player: {
        x: Player.pos.x, y: Player.pos.y, z: Player.pos.z,
        yaw: Player.yaw, pitch: Player.pitch, flying: Player.flying
      },
      edits: World.getEdits()
    }, state.worldId, state.worldName);
    if (!silent) UI.showToast(ok ? state.worldName + ' 저장 완료' : '저장 실패: 저장 공간 부족');
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

  const touchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  let mobileLook = null;
  let mobileMove = {x:0,y:0};

  function mobileAction(kind) {
    if (!state.started || !state.locked || Player.dead) return;
    if (kind === 'jump') { keys['Space'] = true; setTimeout(() => keys['Space'] = false, 140); return; }
    if (kind === 'use') {
      const target = Interact.getTarget();
      if (target && target.id === BLOCK.CRAFTING_TABLE) {
        Interact.cancelBreak(); state.suppressPause = true; document.exitPointerLock(); UI.openCraftingTable(); return;
      }
      if (target && target.id === BLOCK.BED) {
        Player.setSpawn(target.x + .5, target.y + 1, target.z + .5); UI.showToast('침대가 새로운 리스폰 지점이 되었습니다'); blip(440,.08,'sine',.04);
      }
      return;
    }
    if (kind === 'break') {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const selected = Inventory.selectedSlot();
      const weaponDamage = selected && getToolDef(selected.id) ? getWeaponDamage(selected.id) : SURVIVAL.FIST_DMG;
      const hitMob = Mobs.tryAttack(camera.position, dir, 3.6, weaponDamage);
      if (hitMob) { Interact.cancelBreak(); Player.addExhaustion(SURVIVAL.ATTACK_COST); }
      else Interact.beginBreak(state.mode === GAME_MODE.SURVIVAL);
    } else if (kind === 'place') {
      const s = Inventory.selectedSlot(); if (!s) return;
      if (isFoodId(s.id)) {
        if (Player.eat(ITEMS[s.id].food)) { Inventory.consumeSelected(); UI.renderHotbar(); }
      } else if (isBlockId(s.id) && Interact.tryPlace(s.id)) {
        Inventory.consumeSelected(); UI.renderHotbar();
      }
    } else if (kind === 'inventory') {
      Interact.cancelBreak();
      state.suppressPause = true;
      UI.openInventory();
      document.exitPointerLock();
    }
  }

  function startGameInput() {
    if (touchMode) {
      state.started = true;
      state.locked = true;
      state.suppressPause = false;
      UI.showOverlay(null);
      ensureTouchControls();
    } else {
      canvas.requestPointerLock();
    }
  }

  function ensureTouchControls() {
    if (!touchMode || document.getElementById('touch-controls')) return;
    const style = document.createElement('style');
    style.id = 'touch-controls-style';
    style.textContent = `
      #touch-controls{position:fixed;inset:0;z-index:35;pointer-events:none;touch-action:none;font-family:Arial,sans-serif}
      #touch-stick{position:absolute;left:16px;bottom:18px;width:138px;height:138px;border-radius:50%;pointer-events:auto;background:rgba(20,28,36,.32);border:2px solid rgba(255,255,255,.22);box-sizing:border-box}
      #touch-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.22);border:2px solid rgba(255,255,255,.34);box-sizing:border-box}
      #touch-actions{position:absolute;right:16px;bottom:18px;display:grid;grid-template-columns:repeat(2,68px);gap:10px;pointer-events:auto}
      .touch-btn{width:68px;height:58px;border:1px solid rgba(255,255,255,.22);border-radius:14px;background:rgba(12,18,24,.68);color:#fff;font-weight:700;font-size:13px;backdrop-filter:blur(3px);user-select:none;-webkit-user-select:none}
      .touch-btn:active{transform:scale(.96);background:rgba(60,75,90,.82)}
      #touch-look-tip{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.32);color:rgba(255,255,255,.78);font-size:11px;pointer-events:none}
      @media(min-width:781px){#touch-controls{display:none}}
    `;
    document.head.appendChild(style);
    const root=document.createElement('div');
    root.id='touch-controls';
    root.innerHTML='<div id="touch-look-tip">오른쪽 화면 드래그: 시점 이동</div><div id="touch-stick"><div id="touch-knob"></div></div><div id="touch-actions"><button class="touch-btn" data-act="break">⛏ 캐기</button><button class="touch-btn" data-act="place">🧱 놓기</button><button class="touch-btn" data-act="use">🛠 사용</button><button class="touch-btn" data-act="jump">⬆ 점프</button><button class="touch-btn" data-act="inventory">🎒 가방</button></div>';
    document.body.appendChild(root);

    const stick=root.querySelector('#touch-stick'), knob=root.querySelector('#touch-knob');
    let stickId=null;
    const updateStick=e=>{
      const r=stick.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
      let dx=e.clientX-cx, dy=e.clientY-cy, d=Math.hypot(dx,dy), max=44;
      if(d>max){dx=dx/d*max;dy=dy/d*max;}
      knob.style.transform='translate('+dx+'px,'+dy+'px)';
      mobileMove.x=dx/max; mobileMove.y=dy/max;
      keys['KeyA']=mobileMove.x < -.22; keys['KeyD']=mobileMove.x > .22;
      keys['KeyW']=mobileMove.y < -.22; keys['KeyS']=mobileMove.y > .22;
    };
    stick.addEventListener('pointerdown',e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);updateStick(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)updateStick(e);});
    const clearStick=()=>{stickId=null;mobileMove.x=mobileMove.y=0;knob.style.transform='translate(0,0)';keys['KeyA']=keys['KeyD']=keys['KeyW']=keys['KeyS']=false;};
    stick.addEventListener('pointerup',clearStick); stick.addEventListener('pointercancel',clearStick);

    root.querySelectorAll('.touch-btn').forEach(btn=>{
      const act=btn.dataset.act;
      if(act==='break'){
        btn.addEventListener('pointerdown',e=>{e.preventDefault();mobileAction('break');});
        btn.addEventListener('pointerup',()=>Interact.cancelBreak());
        btn.addEventListener('pointercancel',()=>Interact.cancelBreak());
      } else btn.addEventListener('pointerdown',e=>{e.preventDefault();mobileAction(act);});
    });

    document.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch' || e.target.closest('#touch-controls')) return;
      mobileLook={id:e.pointerId,x:e.clientX,y:e.clientY};
    },{passive:false});
    document.addEventListener('pointermove',e=>{
      if(!mobileLook || e.pointerType!=='touch' || e.pointerId!==mobileLook.id) return;
      const dx=e.clientX-mobileLook.x, dy=e.clientY-mobileLook.y;
      mobileLook.x=e.clientX; mobileLook.y=e.clientY;
      Player.yaw-=dx*.004; Player.pitch=Math.max(-1.55,Math.min(1.55,Player.pitch-dy*.004));
    },{passive:false});
    document.addEventListener('pointerup',e=>{if(mobileLook&&e.pointerId===mobileLook.id)mobileLook=null;},{passive:false});
  }

  UI.renderHotbar();
  Interact.init(camera, scene);
  applyFog();
  updateSky(0);
  const modeLabel = state.mode === GAME_MODE.SURVIVAL ? '서바이벌' : '크리에이티브';
  document.getElementById('seed-label').textContent =
    `${state.worldName} · 시드: ${seed} · ${saved ? `${modeLabel} 월드 불러옴` : '새 월드 생성'}`;

  function setMode(mode) {
    state.mode = mode;
    Player.setMode(mode);
    Inventory.setMode(mode);
    Mobs.setMode(mode);
    UI.renderHotbar();
    syncModeBtn();
    doSave(true);
    UI.showToast(mode === GAME_MODE.SURVIVAL ? '서바이벌 모드 — 행운을 빕니다' : '크리에이티브 모드');
  }

  const keys = {};
  const canvas = renderer.domElement;
  window.addEventListener('webcraft-inventory-closed',()=>{
    if(state.started&&!Player.dead){state.suppressPause=true;startGameInput();}
  });

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'F3') { e.preventDefault(); const h = document.getElementById('hud-info'); h.style.display = h.style.display === 'none' ? '' : 'none'; }
    if(e.code==='KeyE'&&state.started&&!Player.dead){
      e.preventDefault();
      if(UI.isInventoryOpen()){state.suppressPause=true;UI.closeInventory();canvas.requestPointerLock();}
      else{Interact.cancelBreak();state.suppressPause=true;UI.openInventory();document.exitPointerLock();}
      return;
    }
    if(!state.locked)return;
    if(e.code.startsWith('Digit')){
      const n = +e.code[5];
      if (n >= 1 && n <= 9) { UI.setSelected(n - 1); blip(300, .04, 'square', .02); }
    }
    if (e.code === 'KeyF') {
      if (state.mode !== GAME_MODE.CREATIVE) { UI.showToast('서바이벌에서는 날 수 없습니다'); return; }
      Player.flying = !Player.flying;
      UI.showToast(Player.flying ? '비행 모드 ON' : '비행 모드 OFF');
      blip(Player.flying ? 520 : 260, .09, 'triangle', .04);
    }
    if(e.code==='KeyB'){
      if(state.mode!==GAME_MODE.CREATIVE){UI.showToast('블록 상자는 크리에이티브 전용입니다');return;}
      state.suppressPause=true;document.exitPointerLock();
      UI.openPicker(id=>{Inventory.setSlot(Inventory.getSelected(),id);UI.renderHotbar();blip(340,.05,'square',.03);canvas.requestPointerLock();});
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
      const weaponDamage = selected && getToolDef(selected.id) ? getWeaponDamage(selected.id) : SURVIVAL.FIST_DMG;
      const hitMob = Mobs.tryAttack(camera.position, dir, 3.6, weaponDamage);
      if (hitMob) {
        Interact.cancelBreak();
        Player.addExhaustion(SURVIVAL.ATTACK_COST);
        const weapon = selected && getToolDef(selected.id) && getToolDef(selected.id).type === 'sword';
        if (state.mode === GAME_MODE.SURVIVAL && weapon) {
          const result = Inventory.damageSelectedTool(1);
          if (result.broken) UI.showToast('검이 부서졌습니다');
          UI.renderHotbar();
        }
      } else {
        Interact.beginBreak(state.mode === GAME_MODE.SURVIVAL);
      }
    } else if (e.button === 2) {
      const target = Interact.getTarget();
      if (target && target.id === BLOCK.CRAFTING_TABLE) {
        Interact.cancelBreak();
        state.suppressPause = true;
        document.exitPointerLock();
        UI.openCraftingTable();
        return;
      }
      if (target && target.id === BLOCK.BED) {
        Player.setSpawn(target.x + .5, target.y + 1, target.z + .5);
        UI.showToast('침대가 새로운 리스폰 지점이 되었습니다');
        blip(440,.08,'sine',.04);
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
      UI.showOverlay(null);
    } else if (state.started && !Player.dead) {
      Interact.cancelBreak();
      if (state.suppressPause) { state.suppressPause = false; return; }
      UI.showOverlay('pause');
      doSave(true);
    }
  });

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
  startBtn.addEventListener('click', () => startGameInput());
  btnSurvival.addEventListener('click', () => {
    state.mode = GAME_MODE.SURVIVAL;
    Player.setMode(GAME_MODE.SURVIVAL);
    Inventory.init(GAME_MODE.SURVIVAL, null);
    Mobs.setMode(GAME_MODE.SURVIVAL);
    UI.renderHotbar();
    startGameInput();
  });
  btnCreative.addEventListener('click', () => {
    state.mode = GAME_MODE.CREATIVE;
    Player.setMode(GAME_MODE.CREATIVE);
    Inventory.init(GAME_MODE.CREATIVE, null);
    Mobs.setMode(GAME_MODE.CREATIVE);
    UI.renderHotbar();
    startGameInput();
  });

  document.getElementById('btn-resume').addEventListener('click', () => startGameInput());
  document.getElementById('btn-save').addEventListener('click', () => doSave(false));
  document.getElementById('btn-home').addEventListener('click', () => { doSave(true); location.href = 'index.html#worlds'; });
  document.getElementById('btn-respawn').addEventListener('click', () => {
    Player.respawn();
    UI.hideDeath();
    startGameInput();
  });
  document.getElementById('picker-close').addEventListener('click', () => { UI.closePicker(); startGameInput(); });

  function makeSeedShareUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('new', '1');
    u.searchParams.set('seed', String(seed));
    u.searchParams.set('mode', state.mode);
    u.searchParams.set('name', state.worldName);
    return u.toString();
  }

    const sharePanel = document.getElementById('share-panel');
  document.getElementById('btn-share').addEventListener('click', () => {
    UI.showOverlay(null);
    document.getElementById('share-name').value = '';
    document.getElementById('share-result').classList.add('hidden');
    sharePanel.classList.remove('hidden');
  });
  document.getElementById('share-close').addEventListener('click', () => {
    sharePanel.classList.add('hidden');
    startGameInput();
  });
  document.getElementById('btn-share-upload').addEventListener('click', async () => {
    const btn = document.getElementById('btn-share-upload');
    const edits = World.getEdits();
    let blockCount = 0;
    for (const [, list] of edits) blockCount += list.length;
    btn.disabled = true;
    btn.textContent = '공유 중…';
    try {
      const result = await Share.uploadWorld({
        name: document.getElementById('share-name').value,
        seed,
        mode: state.mode,
        blockCount,
        data: {
          edits,
          player: { x: Player.pos.x, y: Player.pos.y, z: Player.pos.z, yaw: Player.yaw, pitch: Player.pitch, flying: Player.flying },
          time: state.time,
          hotbar: Inventory.serialize().slice(0, Inventory.HOTBAR_SIZE),
          inventory: Inventory.serialize()
        }
      });
      document.getElementById('share-code').textContent = result.code;
      document.getElementById('share-result').classList.remove('hidden');
      blip(520, .08, 'triangle', .04);
      setTimeout(() => blip(700, .08, 'triangle', .04), 110);
    } catch (e) {
      UI.showToast('공유 실패: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '현재 월드 공유하기';
    }
  });
  const seedLinkBtn = document.getElementById('btn-share-seed-link');
  if (seedLinkBtn) seedLinkBtn.addEventListener('click', async () => {
    const link = makeSeedShareUrl();
    const input = document.getElementById('seed-share-link');
    input.value = link;
    try {
      await navigator.clipboard.writeText(link);
      UI.showToast('시드 공유 링크가 복사되었습니다');
    } catch (e) {
      input.focus();
      input.select();
      UI.showToast('링크를 선택했습니다. Ctrl+C로 복사하세요');
    }
  });
  document.getElementById('btn-share-copy').addEventListener('click', () => {
    const code = document.getElementById('share-code').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => UI.showToast('코드가 복사되었습니다: ' + code));
    } else UI.showToast('코드: ' + code);
  });
  document.getElementById('btn-share-load').addEventListener('click', async () => {
    const code = document.getElementById('load-code').value.trim().toLowerCase();
    if (!/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/.test(code)) {
      UI.showToast('6자리 공유 코드를 입력하세요');
      return;
    }
    const btn = document.getElementById('btn-share-load');
    btn.disabled = true;
    btn.textContent = '불러오는 중…';
    try {
      const w = await Share.fetchWorld(code);
      if (!confirm(`"${w.name}" 월드를 불러옵니다.\n현재 월드는 덮어써집니다. 계속할까요?`)) return;
      SaveSystem.save({
        version: 3,
        seed: w.seed,
        time: (w.data && w.data.time) || .22,
        renderDist: state.renderDist,
        sound: state.sound,
        mode: w.mode === 'creative' ? 'creative' : 'survival',
        hp: SURVIVAL.MAX_HP,
        food: SURVIVAL.MAX_FOOD,
        spawn: w.data && w.data.player ? { x: w.data.player.x, y: w.data.player.y, z: w.data.player.z } : null,
        hotbar: (w.data && w.data.hotbar) || null,
        inventory: (w.data && w.data.inventory) || (w.data && w.data.hotbar) || null,
        player: (w.data && w.data.player) || null,
        edits: (w.data && w.data.edits) || []
      });
      location.reload();
    } catch (e) {
      UI.showToast('불러오기 실패: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '불러오기';
    }
  });

  document.getElementById('btn-newworld').addEventListener('click', () => {
    if (!confirm('현재 월드는 저장하고 새 월드를 만들까요?')) return;
    doSave(true);
    const v = document.getElementById('seed-input').value.trim();
    const name = prompt('새 월드 이름을 입력하세요', '새로운 월드');
    if (name === null) return;
    const id = SaveSystem.createWorld(name, v || null, state.mode);
    location.href = 'play.html?world=' + encodeURIComponent(id);
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
      World.update(Player.pos.x, Player.pos.z, state.renderDist, 6, 10);
      if (World.isReady()) {
        state.ready = true;
        UI.showOverlay('start');
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

    const gameActive = state.ready && state.started && state.locked && !Player.dead;
    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'] && !Player.flying;
    const targetFov = sprinting ? 79 : 72;
    if (Math.abs(camera.fov - targetFov) > .1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }

    const movingBob = Math.min(1, Math.hypot(Player.vel.x, Player.vel.z) / 5.5);
    const bobTime = performance.now() * .010;
    const bobY = gameActive ? Math.sin(bobTime * 1.7) * .035 * movingBob : 0;
    const bobX = gameActive ? Math.cos(bobTime * .85) * .022 * movingBob : 0;
    camera.position.set(Player.pos.x + bobX, Player.pos.y + Player.eyeY + bobY, Player.pos.z);
    camera.rotation.set(Player.pitch + Math.sin(bobTime * 1.7) * .004 * movingBob, Player.yaw, 0);
    sun.position.set(Player.pos.x + 60, 100, Player.pos.z + 35);
    sun.target.position.set(Player.pos.x, Player.pos.y, Player.pos.z);
    if (!sun.target.parent) scene.add(sun.target);

    frames++;
    fpsTime += dt;
    if (fpsTime >= .5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }
    if (++hudTick % 10 === 0) {
      const p = Player.pos;
      const mc = Mobs.counts();
      UI.setHUD(`FPS ${fps} · x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} z ${p.z.toFixed(0)} · 청크 ${World.chunkCount()} · 몹 ${mc.total}`);
      UI.updateXP(Player.xp,Player.level,Player.xpNeeded);
      UI.updateSurvival(state.mode, Player.hp, Player.food, Player.air);
    }

    renderer.render(scene, camera);
  }
  loop();
})();
