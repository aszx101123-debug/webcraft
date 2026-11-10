'use strict';

window.webcraftBoot = (async () => {
  const params = new URLSearchParams(location.search);
  const room = await Multiplayer.prepare(params);
  let classicOptions = ClassicSettings.get();
  ClassicSettings.bind(options => { classicOptions = options; });

  function seedFromParam(v) {
    if (!v) return null;
    if (/^\d+$/.test(v)) return parseInt(v, 10) % 2147483647;
    let h = 5381;
    for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    return h % 2147483647;
  }

  let worldId = room ? 'room-'+room.room : params.get('world') || SaveSystem.getActiveId();
  if (!worldId) worldId = SaveSystem.ensureDefault(seedFromParam(params.get('seed')));
  if (!worldId) {
    document.body.textContent = '월드를 만들 수 없습니다. 브라우저 저장 공간을 확인해 주세요.';
    return;
  }
  if(!room)SaveSystem.setActiveId(worldId);
  let worldMeta = room ? {id:worldId,name:'멀티 '+room.room,seed:room.seed} : SaveSystem.get(worldId);
  let saved = room ? SaveSystem.loadRoom(room.room) : SaveSystem.load(worldId);
  if(room&&saved?.seed!==room.seed)saved=null;
  if (!worldMeta) {
    worldId = SaveSystem.ensureDefault(seedFromParam(params.get('seed')));
    worldMeta = SaveSystem.get(worldId);
    saved = SaveSystem.load(worldId);
  }
  if(room&&Multiplayer.initial){
    const initial=Multiplayer.initial;
    saved={...saved,version:8,seed:room.seed,generatorVersion:2,mode:room.mode,time:initial.time,
      edits:initial.edits,blockObjects:initial.metadata?.objects,furnaces:initial.metadata?.furnaces,farming:initial.metadata?.farming};
    if(!saved.player&&initial.spawn)saved.player={...initial.spawn};
    if(!saved.spawn&&initial.spawn)saved.spawn={...initial.spawn};
  }
  const seed = room ? room.seed : saved?.seed ?? worldMeta.seed;
  const generatorVersion = room ? 2 : SaveSystem.generatorVersion(saved);

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  const isTouch = params.get('controls') === 'touch' || (params.get('controls') !== 'desktop' && (matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(max-width: 800px)').matches)));
  const hardwareScale = isTouch ? 1 : ((navigator.hardwareConcurrency || 4) <= 4 ? 1.25 : 1.5);
  renderer.setPixelRatio(Math.min(devicePixelRatio, hardwareScale));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(classicOptions.fov, innerWidth / innerHeight, .1, 500);
  camera.rotation.order = 'YXZ';
  // Camera-attached first-person arms only render when the camera is in the scene graph.
  scene.add(camera);

  Graphics.configureRenderer(renderer);
  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x54492e, .8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3d0, .65);
  sun.position.set(60, 100, 35);
  scene.add(sun);

  Textures.init();
  await Textures.loadClassicPack();
  World.init(scene, seed, saved ? saved.edits : null, generatorVersion);
  WorldJournal.init(saved?.journal);
  WorldMilestones.init(saved?.milestones);
  WorldMilestones.syncExploration(WorldJournal.getStats());
  BlockFurniture.init(saved?.blockObjects);
  FurnaceSystem.init(saved?.furnaces);
  BlockPhysics.init();
  Fluids.init();
  PlayerModel.init(scene,camera);
  // Homepage edits override older world cosmetics, without disturbing world blocks.
  const homepageSkin = WebCraftSkins.load();
  const worldAppearanceAt = saved && Number.isFinite(saved.appearanceUpdatedAt)
    ? saved.appearanceUpdatedAt : 0;
  let appearanceUpdatedAt = worldAppearanceAt;
  if (homepageSkin && (!saved?.appearance || homepageSkin.updatedAt > worldAppearanceAt)) {
    PlayerModel.setAppearance(homepageSkin.appearance);
    appearanceUpdatedAt = homepageSkin.updatedAt;
  } else {
    PlayerModel.setAppearance(saved && saved.appearance ? saved.appearance : null);
  }
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
    thirdPersonView: saved && typeof saved.thirdPersonView === 'number'
      ? Math.max(0, Math.min(2, saved.thirdPersonView | 0))
      : (saved && saved.thirdPerson ? 1 : 0),
    time: saved ? saved.time : .22,
    renderDist: saved && Number.isFinite(saved.renderDist) ? Math.max(2, Math.min(5, saved.renderDist | 0)) : (isTouch ? 2 : CONFIG.RENDER_DIST),
    sound: saved ? saved.sound !== false : true,
    suppressPause: false,
    paused: false,
    mode: room ? room.mode : saved && saved.version >= 2 && saved.mode ? saved.mode : GAME_MODE.SURVIVAL,
    difficulty: Difficulty.normalize(room
      ? (Multiplayer.initial?.meta?.difficulty ?? saved?.difficulty)
      : saved?.difficulty)
  };

  Difficulty.set(state.difficulty);
  Player.setMode(state.mode);
  Mobs.setMode(state.mode);
  let savedHotbar = null;
  if (saved && Array.isArray(saved.hotbar)) {
    savedHotbar = saved.hotbar.map(s => (typeof s === 'number' && s > 0) ? { id: s, count: -1 } : s);
  }
  const savedInventory = saved && Array.isArray(saved.inventory)
    ? saved.inventory.map(s => (typeof s === 'number' && s > 0) ? { id: s, count: -1 } : s)
    : savedHotbar;
  Inventory.init(state.mode, savedInventory, saved && saved.equipment ? saved.equipment : null);
  // Restore ingredients held in the crafting grid, not only the inventory slots.
  if (saved?.crafting && Array.isArray(saved.crafting.grid) && saved.crafting.grid.length === 9) {
    Crafting.resetGrid(saved.crafting.size === 3 ? 3 : 2);
    saved.crafting.grid.forEach((id, index) => {
      if (Number.isInteger(id) && id > 0 && getItemDef(id) && !getToolDef(id) && !getArmorDef(id))
        Crafting.setCell(index, id);
    });
  }
  if (saved?.inventoryCursor) UI.restoreInventoryCursor(saved.inventoryCursor);

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

  Farming.init(saved?.farming);
  ItemActions.init(scene,camera,()=>state.time);

  Player.onHurt = () => {
    UI.flashVignette();
    blip(130, .18, 'sawtooth', .08);
  };
  Player.onDeath = cause => {
    ItemActions.cancel();
    state.suppressPause = true;
    disableTouchInput();
    miningHeld=false;
    Interact.cancelBreak();
    BlockFurniture.closeChest(false);
    WorldJournal.close(false);
    document.exitPointerLock?.();
    UI.showDeath(cause);
    const worldLabel=document.getElementById('death-world');
    if(worldLabel)worldLabel.textContent=worldMeta.name+' · 난이도: '+Difficulty.info().name;
    doSave(true);
  };
  Player.onEat = () => { };

  Mobs.onEvent = (type, m) => {
    if (type === 'hurt') blip(m.def.hostile ? 90 : 140, .1, 'triangle', .06);
    else if (type === 'die') blip(60, .22, 'sawtooth', .07);
    else if (type === 'shoot') blip(720, .06, 'square', .03);
    else if (type === 'fuse') {
      blip(600,.20,'sawtooth',.065);
      setTimeout(()=>blip(440,.16,'triangle',.035),120);
    } else if (type === 'explode') {
      blip(68,.26,'sawtooth',.12);
      if(!state.paused)UI.showToast('크리퍼 폭발!');
    }
  };


  // Rain/snow are determined by the local biome, including each particle's world position.
  // Older saves keep their terrain; the weather logic works in both generator versions.
  const weather = {
    type: 'clear', timer: 110,
    rng: Noise.mulberry32((seed ^ 0x51f15e) >>> 0),
    rainPoints: null, snowPoints: null,
    current: 'clear', biome: '', intensity: 0
  };
  const winterBiomes = new Set(['snowy','glacier']);
  const dryBiomes = new Set(['desert','badlands','savanna','volcanic']);
  const climate = {
    plains: .85, forest: 1, jungle: 1.5, swamp: 1.55,
    taiga: 1.1, snowy: 1.18, desert: 0, highland: .9,
    savanna: .23, badlands: 0, cherry: 1.1, bamboo: 1.45,
    mushroom: 1.25, volcanic: 0, glacier: 1, crystal: .7
  };
  function precipitationAt(x,z) {
    const biome=World.biomeAt(x,z);
    if(weather.type==='clear'||dryBiomes.has(biome) && climate[biome]===0)return 'clear';
    // Savannas have occasional brief showers, while jungles and swamps stay humid.
    if(biome==='savanna' &&
       Noise.hash2(Math.floor(x/32),Math.floor(z/32),seed+5531)>.24)return 'clear';
    return winterBiomes.has(biome)?'snow':'rain';
  }
  function makeWeatherPoints(count,color,size) {
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      pos[i*3]=(Math.random()-.5)*28;
      pos[i*3+1]=Math.random()*16;
      pos[i*3+2]=(Math.random()-.5)*28;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color,size,transparent:true,opacity:.75,depthWrite:false});
    return new THREE.Points(geo,mat);
  }
  weather.rainPoints=makeWeatherPoints(isTouch?180:460,0x9bcfff,.085);
  weather.snowPoints=makeWeatherPoints(isTouch?140:340,0xf2f6ff,.135);
  weather.rainPoints.visible=false;
  weather.snowPoints.visible=false;
  scene.add(weather.rainPoints,weather.snowPoints);

  function chooseWeather() {
    const r=weather.rng();
    weather.type=r<.55?'clear':'precipitation';
    weather.timer=95+weather.rng()*155;
  }
  const weatherWidget=document.createElement('div');
  weatherWidget.id='biome-weather-hud';
  weatherWidget.setAttribute('role','status');
  weatherWidget.style.cssText='position:fixed;right:12px;top:56px;z-index:11;color:#fff;background:#181d24c7;border:1px solid #ffffff55;padding:6px 9px;font:11px sans-serif;pointer-events:none;letter-spacing:.02em;text-shadow:1px 1px #111';
  document.body.appendChild(weatherWidget);

  function updateWeather(dt) {
    weather.timer-=dt;
    if(weather.timer<=0)chooseWeather();
    const biome=World.biomeAt(Player.pos.x,Player.pos.z);
    const precip=precipitationAt(Player.pos.x,Player.pos.z);
    weather.current=precip;
    weather.biome=biome;
    weather.intensity=climate[biome]??1;
    const playerSheltered=Player.headSubmerged || (()=>{
      const x=Math.floor(Player.pos.x),z=Math.floor(Player.pos.z);
      const roofStart=Math.ceil(Player.pos.y+1.6);
      for(let y=roofStart;y<Math.min(CONFIG.HEIGHT,roofStart+12);y++){
        const b=World.getBlock(x,y,z);
        if(b!==BLOCK.AIR && b!==BLOCK.WATER && b!==BLOCK.WATER_FLOW)return true;
      }
      return false;
    })();
    const updatePoints=(points,kind,fall,drift)=>{
      const attr=points.geometry.getAttribute('position'),a=attr.array;
      const originX=Player.pos.x,originZ=Player.pos.z;
      let visible=0;
      const density=Math.min(1,Math.max(.15,weather.intensity/1.4));
      for(let i=0;i<a.length;i+=3){
        a[i]+=drift*dt*(.65+(i%19)*.02);
        a[i+1]-=fall*dt;
        a[i+2]+=drift*dt*.38;
        if(a[i+1]<-1 || Math.abs(a[i])>17 || Math.abs(a[i+2])>17){
          a[i]=(Math.random()-.5)*29;
          a[i+1]=12+Math.random()*8;
          a[i+2]=(Math.random()-.5)*29;
        }
        const wx=originX+a[i],wz=originZ+a[i+2];
        const local=precipitationAt(wx,wz);
        const draw=local===kind && (i/3 % 10)/10<density && !playerSheltered && a[i+1]>=0;
        // Hide particles within the same geometry rather than showing snow in adjacent warm biomes.
        if(draw)visible++;else a[i+1]=-2;
      }
      attr.needsUpdate=true;
      points.visible=visible>0;
      points.position.set(originX,Player.pos.y,originZ);
    };
    updatePoints(weather.rainPoints,'rain',16.5,.65);
    updatePoints(weather.snowPoints,'snow',2.7,.21);
    if(weatherWidget){
      const names={plains:'평원',forest:'숲',jungle:'정글',swamp:'늪지',taiga:'침엽수림',snowy:'설산',desert:'사막',highland:'고지대',savanna:'사바나',badlands:'붉은 황무지',cherry:'벚꽃숲',bamboo:'대나무숲',mushroom:'버섯숲',volcanic:'화산',glacier:'빙하',crystal:'수정 지대'};
      const icons={clear:'☀',rain:'☂',snow:'❄'};
      const effects={clear:'맑음',rain:biome==='jungle'||biome==='swamp'?'강한 비':'비',snow:'눈'};
      weatherWidget.textContent=(names[biome]||biome)+' · '+icons[precip]+' '+effects[precip];
    }
  }

  const skyNow = new THREE.Color();
  const atmosphere = Graphics.create(scene, renderer, hemi, sun, seed);
  function applyFog() {
    const far = state.renderDist * 16 + 10;
    scene.fog = new THREE.Fog(skyNow.getHex(), far * .55, far);
    camera.far = Math.max(300, far * 2.2);
    camera.updateProjectionMatrix();
  }

  function updateSky(dt,advance=true) {
    state.time = (state.time + (advance?dt / CONFIG.DAY_LENGTH:0)) % 1;
    const f = atmosphere.update(state.time, Player.pos, weather.current === 'clear' ? 'clear' : 'rain', state.renderDist, Player.headSubmerged);
    World.setDaylight(f);
    Textures.animate(dt);
    Mobs.setEnv(f < .28, f);
    const hours = (state.time * 24 + 6) % 24;
    const hh = String(Math.floor(hours)).padStart(2, '0');
    const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0');
    const weatherIcon = Player.headSubmerged ? '◌' : (weather.current === 'rain' ? '☔' : weather.current === 'snow' ? '❄' : (f > .45 ? '☀' : '☾'));
    UI.setTime(`${weatherIcon} ${hh}:${mm}`);
  }

  let saveBadgeTimer=null;
  function doSave(silent) {
    const save = room ? data=>SaveSystem.saveRoom(room.room,data) : data=>SaveSystem.save(worldId,data);
    const ok = save({
      version: 8,
      savedAt: Date.now(),
      worldId,
      worldName: worldMeta.name,
      seed,
      generatorVersion,
      time: state.time,
      renderDist: state.renderDist,
      sound: state.sound,
      mode: state.mode,
      difficulty: state.difficulty,
      hp: Player.hp,
      food: Player.food,
      spawn: { x: Player.spawnPoint.x, y: Player.spawnPoint.y, z: Player.spawnPoint.z },
      hotbar: Inventory.serialize().slice(0, Inventory.HOTBAR_SIZE),
      inventory: Inventory.serialize(),
      equipment: Inventory.serializeEquipment(),
      appearance: PlayerModel.getAppearance(),
      appearanceUpdatedAt,
      crafting: { size: Crafting.getGridSize(), grid: Crafting.getGrid() },
      inventoryCursor: UI.getInventoryCursor(),
      thirdPerson: state.thirdPersonView > 0,
      thirdPersonView: state.thirdPersonView,
      player: {
        x: Player.pos.x, y: Player.pos.y, z: Player.pos.z,
        yaw: Player.yaw, pitch: Player.pitch, flying: Player.flying
      },
      edits: World.getEdits(),
      blockObjects: BlockFurniture.serialize(),
      furnaces: FurnaceSystem.serialize(),
      farming: Farming.serialize(),
      journal: WorldJournal.serialize(),
      milestones: WorldMilestones.serialize()
    });
    const badge=document.getElementById('save-indicator');
    if(badge && state.started){
      badge.textContent=ok?'✓ 월드 저장됨':'⚠ 저장 공간을 확인해 주세요';
      badge.classList.toggle('save-failed',!ok);
      badge.classList.add('show');
      clearTimeout(saveBadgeTimer);
      saveBadgeTimer=setTimeout(()=>badge.classList.remove('show'),ok?1800:7000);
    }
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
    if(room)return;
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
  let lastForwardPress=-Infinity;
  let touchActive = false;
  let resetTouchPad = () => {};
  let resetTouchTaps = () => {};
  let pauseBeganAt = -Infinity;
  function disableTouchInput() {
    touchActive = false;
    resetTouchPad();
    resetTouchTaps();
    lastSpaceTap=-Infinity;
    lastForwardPress=-Infinity;
    keys.DoubleTapSprint=false;
    cancelTouchGesture();
    document.body.classList.remove('touch-playing');
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']) keys[k] = false;
  }
  const touchControls = document.createElement('div');
  touchControls.id = 'touch-controls';
  let cancelTouchGesture = () => {};
  if (isTouch) {
    // Bedrock-inspired minimalist touch layout: movement + jump/sneak,
    // top inventory and pause, with tap/use and hold/break in the game world.
    touchControls.innerHTML =
      '<div id="touch-pad" role="group" aria-label="이동 조이스틱"><div id="touch-knob"></div></div>'+
      '<div id="touch-actions" role="group" aria-label="이동 동작">'+
      '<button type="button" data-act="jump" aria-label="점프">↥</button>'+
      '<button type="button" data-act="sneak" aria-label="웅크리기 / 비행 하강">◇</button>'+
      '</div>'+
      '<div id="touch-topbar" role="group" aria-label="게임 메뉴">'+
      '<button type="button" data-act="inventory" aria-label="인벤토리 열기">▦</button>'+
      '<button type="button" data-act="pause" aria-label="일시정지 메뉴">Ⅱ</button></div>';
    document.body.appendChild(touchControls);
    document.body.classList.add('touch-device');
    const pad = touchControls.querySelector('#touch-pad');
    const knob = touchControls.querySelector('#touch-knob');
    const moveKeys = ['KeyW','KeyA','KeyS','KeyD','ControlLeft'];
    const resetPad = () => {
      moveKeys.forEach(k=>keys[k]=false);
      knob.style.transform='';
    };
    resetTouchPad = resetPad;
    function movePad(e) {
      const r=pad.getBoundingClientRect();
      const dx=(e.clientX-r.left-r.width/2)/(r.width/2);
      const dy=(e.clientY-r.top-r.height/2)/(r.height/2);
      const x=Math.max(-1,Math.min(1,dx)),y=Math.max(-1,Math.min(1,dy));
      keys.KeyA=x<-.28;keys.KeyD=x>.28;
      keys.KeyW=y<-.28;keys.KeyS=y>.28;
      // Pushing the stick all the way up runs, no separate sprint button.
      keys.ControlLeft=y<-.86 && Math.abs(x)<.52;
      knob.style.transform='translate(calc(-50% + '+(x*r.width*.29)+'px),calc(-50% + '+(y*r.height*.29)+'px))';
    }
    pad.addEventListener('pointerdown',e=>{
      e.preventDefault();e.stopPropagation();
      if(!touchActive)return;
      pad.setPointerCapture(e.pointerId);movePad(e);
    });
    pad.addEventListener('pointermove',e=>{
      if(pad.hasPointerCapture(e.pointerId))movePad(e);
    });
    for(const eventName of ['pointerup','pointercancel','lostpointercapture'])
      pad.addEventListener(eventName,()=>{moveKeys.slice(0,5).forEach(k=>keys[k]=false);knob.style.transform='';});

    let lastJumpTap=-Infinity;
    resetTouchTaps=()=>{lastJumpTap=-Infinity;};
    for(const button of touchControls.querySelectorAll('button')){
      const act=button.dataset.act;
      button.addEventListener('pointerdown',e=>{
        e.preventDefault();e.stopPropagation();
        if(!touchActive)return;
        button.setPointerCapture?.(e.pointerId);
        if(act==='jump'){
          const now=performance.now();
          if(state.mode===GAME_MODE.CREATIVE && now-lastJumpTap<340){
            Player.flying=!Player.flying;
            UI.showToast(Player.flying?'비행 시작':'비행 종료');
            keys.Space=false;
            lastJumpTap=0;
          }else{keys.Space=true;lastJumpTap=now;}
        }
        if(act==='sneak') keys.ShiftLeft=true;
        if(act==='inventory'){
          state.suppressPause=true;
          disableTouchInput();
          if(UI.openInventory()===false)resumeInput();
        }
        if(act==='pause'){
          state.paused=true;
          pauseBeganAt=performance.now();
          disableTouchInput();
          UI.showOverlay('pause');doSave(true);
        }
      });
      if(act==='jump'||act==='sneak'){
        const release=()=>{keys[act==='jump'?'Space':'ShiftLeft']=false;};
        button.addEventListener('pointerup',release);
        button.addEventListener('pointercancel',release);
        button.addEventListener('lostpointercapture',release);
      }
    }

    // Mobile control uses only joystick, jump, inventory and pause.
    // Touch the world to place/use or hit a mob, hold to mine, drag to look.
    // Minecraft-style "joystick and tap to interact" on the world surface.
    let lookId=null,startX=0,startY=0,lastX=0,lastY=0;
    let holdTimer=null,repeatTimer=null,wasDrag=false,wasHold=false;
    const mineDown=()=>{
      Interact.update();
      canvas.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
    };
    function cancelTimers(){
      clearTimeout(holdTimer);clearInterval(repeatTimer);
      holdTimer=null;repeatTimer=null;
    }
    function finishWorldTouch(e,cancelled=false){
      if(e.pointerId!==lookId)return;
      cancelTimers();
      if(wasHold)canvas.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
      else if(!wasDrag && !cancelled && touchActive){
        // Try the tapped mob first; otherwise use/place the tapped block.
        Interact.setTouchAim(e.clientX,e.clientY,canvas);
        Interact.update();
        const aim=Interact.getTouchDirection();
        const prefersUse=ItemActions.canUse(Inventory.selectedId())||ItemActions.canUse(Inventory.getEquipment().offhand?.id);
        const mob=aim&&!prefersUse?Mobs.tryAttack(camera.position,aim,3.6):null;
        if(mob){
          PlayerModel.swing();
          if(Mobs.getLastAttackResult()?.landed)Player.addExhaustion(SURVIVAL.ATTACK_COST);
        }else canvas.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true}));
      }
      lookId=null;wasDrag=false;wasHold=false;
      Interact.clearTouchAim();
    }
    cancelTouchGesture=()=>{
      if(lookId!==null){
        cancelTimers();
        if(wasHold)canvas.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
      }
      lookId=null;wasDrag=false;wasHold=false;keys.Space=false;
      Interact.clearTouchAim();
    };
    document.addEventListener('pointerdown',e=>{
      if(!touchActive||e.pointerType==='mouse' || lookId!==null)return;
      if(e.target?.closest?.('#touch-controls, .overlay, #hotbar, #picker, button, input'))return;
      if(e.clientX<innerWidth*.28)return;
      lookId=e.pointerId;
      startX=lastX=e.clientX;startY=lastY=e.clientY;
      wasDrag=false;wasHold=false;
      Interact.setTouchAim(lastX,lastY,canvas);
      Interact.update();
      holdTimer=setTimeout(()=>{
        if(!touchActive||lookId!==e.pointerId||wasDrag)return;
        wasHold=true;mineDown();
        repeatTimer=setInterval(()=>{
          if(touchActive && wasHold && !miningHeld)mineDown();
        },560);
      },340);
    });
    document.addEventListener('pointermove',e=>{
      if(!touchActive||e.pointerId!==lookId)return;
      if(Math.hypot(e.clientX-startX,e.clientY-startY)>10 && !wasHold){
        wasDrag=true;clearTimeout(holdTimer);holdTimer=null;
        Interact.clearTouchAim();
      }
      if(wasDrag){
        Player.yaw-=(e.clientX-lastX)*.006*classicOptions.sensitivity/100;
        Player.pitch=Math.max(-1.55,Math.min(1.55,
          Player.pitch-(e.clientY-lastY)*.006*classicOptions.sensitivity/100*(classicOptions.invertY?-1:1)));
      }
      lastX=e.clientX;lastY=e.clientY;
    });
    document.addEventListener('pointerup',e=>finishWorldTouch(e));
    document.addEventListener('pointercancel',e=>finishWorldTouch(e,true));

    // Advanced features stay in the pause menu rather than obscuring gameplay.
    document.querySelectorAll('#mobile-pause-actions [data-mobile-act]').forEach(button=>{
      button.addEventListener('click',()=>{
        const act=button.dataset.mobileAct;
        const backToGame=()=>{UI.showOverlay(null);state.paused=false;resumeInput();};
        if(act==='camera'){
          state.thirdPersonView=(state.thirdPersonView+1)%3;
          UI.showToast(['1인칭','3인칭 뒤','3인칭 앞'][state.thirdPersonView]);
          backToGame();
        }else if(act==='fly'){
          if(state.mode!==GAME_MODE.CREATIVE){
            UI.showToast('크리에이티브에서만 비행할 수 있습니다');return;
          }
          Player.flying=!Player.flying;
          UI.showToast(Player.flying?'비행 시작':'비행 종료');
          backToGame();
        }else if(act==='blocks'){
          if(state.mode!==GAME_MODE.CREATIVE){
            UI.showToast('블록 상자는 크리에이티브 전용입니다');return;
          }
          UI.showOverlay(null);
          UI.openPicker(id=>{
            Inventory.setSlot(Inventory.getSelected(),id);
            UI.renderHotbar();resumeInput();
          });
        }else if(act==='drop'){
          if(state.mode===GAME_MODE.SURVIVAL){
            const dropped=UI.dropSelected(false);
            if(dropped){
              Drops.spawn(dropped.id,dropped.count,Player.pos.x,Player.pos.y+.7,Player.pos.z,dropped.durability);
              UI.renderHotbar();
            }
          }else UI.showToast('서바이벌에서 아이템을 버릴 수 있어요');
          backToGame();
        }
      });
    });
  }
  let miningHeld = false;
  let miningSwingElapsed = 0;
  let creativeBreakTimer = 0;
  let lastSpaceTap = -Infinity;
  const canvas = renderer.domElement;
  function resumeInput() {
    if(room&&!Multiplayer.ready){state.paused=true;UI.showOverlay('pause');UI.showToast('월드 연결을 기다려 주세요.');return;}
    if (isTouch) {
      touchActive = true;
      state.paused = false;
      document.body.classList.add('touch-playing');
    } else {
      try {
        const request = canvas.requestPointerLock?.();
        if (request?.catch) request.catch(() => UI.showToast('마우스 잠금을 허용해 주세요'));
      } catch (_) { UI.showToast('마우스 잠금을 시작할 수 없습니다'); }
    }
  }

  function beginGameplay(mode) {
    if(room&&!Multiplayer.ready)return;
    if(room)mode=room.mode;
    WorldJournal.close(false);
    BlockFurniture.closeChest(false);
    state.mode = mode;
    Player.setMode(mode);
    UI.setModeLabel(mode);
    Mobs.setMode(mode);
    state.started = true;
    state.paused = false;
    state.suppressPause = true;
    UI.renderHotbar();
    UI.showOverlay(null);
    resumeInput();
  }

  BlockFurniture.setOnClose(() => {
    state.suppressPause=true;
    doSave(true);
    resumeInput();
  });
  document.getElementById('chest-close')?.addEventListener('click', () => BlockFurniture.closeChest());
  WorldJournal.setOnClose(()=>{
    state.suppressPause=true;
    doSave(true);
    resumeInput();
  });
  document.getElementById('journal-close')?.addEventListener('click',()=>WorldJournal.close());
  WorldJournal.setOnChange(()=>doSave(true));
  document.getElementById('journal-bookmark-add')?.addEventListener('click',()=>{
    const input=document.getElementById('journal-bookmark-name');
    const added=WorldJournal.addBookmark(Player.pos,input?.value||'');
    if(!added){
      UI.showToast('이미 기록한 위치이거나 거점 5개가 모두 찼습니다');
      return;
    }
    if(input)input.value='';
    UI.showToast('새 거점 기록: '+added.name);
  });
  WorldMilestones.onUnlock(()=>{
    // Retain old progression in saved worlds without adding a custom HUD.
    // Save after the current crafting/placing action has committed its inventory change.
    clearTimeout(milestoneSaveTimer);
    milestoneSaveTimer=setTimeout(()=>doSave(true),220);
  });
  let milestoneSaveTimer=null;
  document.getElementById('journal-set-home')?.addEventListener('click',()=>{
    if(WorldJournal.setHome(Player.pos)){
      UI.showToast('현재 위치를 집으로 기록했습니다');
    }
  });
  let discoveryTimer=null;
  function announceDiscovery(entry){
    UI.showToast('새 바이옴 발견: '+WorldJournal.biomeName(entry.biome));
    const box=document.getElementById('journal-discovery');
    if(!box)return;
    box.textContent='✦ 새로운 바이옴 · '+WorldJournal.biomeName(entry.biome);
    box.classList.add('show');
    clearTimeout(discoveryTimer);
    discoveryTimer=setTimeout(()=>box.classList.remove('show'),2800);
  }

  document.addEventListener('keydown', e => {
    if(e.target?.closest?.('input,textarea,select,[contenteditable="true"]') && e.code!=='Escape')return;
    if (WorldJournal.isOpen()) {
      if(e.code==='Escape'||(e.code==='KeyJ' && !e.target?.closest?.('input,textarea,select'))){
        e.preventDefault();
        WorldJournal.close();
      }
      return;
    }
    if (BlockFurniture.isChestOpen()) {
      if (e.code==='Escape'||e.code==='KeyE') {
        e.preventDefault();
        if(!e.repeat)BlockFurniture.closeChest();
      }
      return;
    }
    if(UI.isCraftingOpen() || UI.isFurnaceOpen()){
      if(e.code==='Escape'||e.code==='KeyE'){
        e.preventDefault();
        if(!e.repeat && (UI.isFurnaceOpen()?UI.closeFurnace():UI.closeCrafting()))resumeInput();
      }
      return;
    }
    // The creative search input must not trigger movement, camera, or game shortcuts.
    if (UI.isPickerOpen()) {
      if (e.code === 'Escape') {
        e.preventDefault();
        UI.closePicker();
        resumeInput();
      }
      return;
    }
    // The open inventory captures E / Escape and Minecraft-style 1–9 swaps.
    // No movement or other game shortcuts should fire behind its dialog.
    if(UI.isInventoryOpen()){
      if(e.code==='KeyE' && e.target?.closest?.('input,textarea,select'))return;
      if(e.code==='KeyE'||e.code==='Escape'){
        e.preventDefault();
        if(!e.repeat && UI.closeInventory())resumeInput();
      }else if(/^Digit[1-9]$/.test(e.code) && !e.target?.closest?.('input,textarea,select')){
        e.preventDefault();
        UI.quickSwapHotbar(Number(e.code.slice(-1))-1);
      }
      return;
    }
    if(e.code==='F1' && state.started){
      e.preventDefault();
      if(!e.repeat)document.body.classList.toggle('classic-hud-hidden');
      return;
    }
    // Double-tap W to sprint, or hold Control. Releasing W ends the burst.
    if(e.code==='KeyW' && !e.repeat && !keys.KeyW && state.started &&
       (state.locked || (isTouch&&touchActive))){
      const now=performance.now();
      if(now-lastForwardPress>65 && now-lastForwardPress<340)
        keys.DoubleTapSprint=true;
      lastForwardPress=now;
    }
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if(e.code==='Space' && !e.repeat && state.mode===GAME_MODE.CREATIVE &&
       (state.locked || (isTouch&&touchActive))){
      const now=performance.now();
      if(now-lastSpaceTap<300){
        Player.flying=!Player.flying;
        lastSpaceTap=-Infinity;
      }else lastSpaceTap=now;
    }
    if (e.code === 'F3') {
      e.preventDefault();
      document.getElementById('debug-panel')?.classList.toggle('hidden');
      return;
    }
    if (e.code === 'F5') {
      e.preventDefault();
      if(e.repeat)return;
      state.thirdPersonView = (state.thirdPersonView + 1) % 3;
      const labels = ['1인칭 카메라', '3인칭 뒤', '3인칭 앞'];
      UI.showToast(labels[state.thirdPersonView] + ' ON');
      return;
    }
    if (e.code === 'Escape' && state.started && !state.locked && !UI.isInventoryOpen() && !UI.isCraftingOpen() && !UI.isFurnaceOpen()) {
      e.preventDefault();
      if(e.repeat)return;
      if(state.paused){
        if(window.WebCraftPauseMenu?.back())return;
        if(performance.now()-pauseBeganAt<180)return;
        state.paused=false;
        state.suppressPause=true;
        UI.showOverlay(null);
        resumeInput();
        return;
      }
      disableTouchInput();
      state.paused = true;
      pauseBeganAt=performance.now();
      UI.showOverlay('pause');
      doSave(true);
      return;
    }
    if (!(state.locked || (isTouch && touchActive))) return;
    if(e.code.startsWith('Key') || e.code.startsWith('Digit') ||
       e.code.startsWith('Arrow') || e.code.startsWith('Control') ||
       e.code.startsWith('Shift'))e.preventDefault();
    if (e.code.startsWith('Digit')) {
      const n = +e.code[5];
      if (n >= 1 && n <= 9) { UI.setSelected(n - 1); blip(300, .04, 'square', .02); }
    }
    if (e.code === 'KeyQ') {
      e.preventDefault();
      if(e.repeat)return;
      if (state.mode !== GAME_MODE.SURVIVAL) { UI.showToast('크리에이티브에서는 아이템이 사라지지 않습니다'); return; }
      const dropped = UI.dropSelected(e.ctrlKey);
      if (dropped) {
        Drops.spawn(dropped.id, dropped.count, Player.pos.x, Player.pos.y + .7, Player.pos.z,dropped.durability);
        UI.renderHotbar();
        blip(180, .06, 'square', .03);
      }
      return;
    }
    if (e.code === 'KeyF') {
      e.preventDefault();
      if(!e.repeat && Inventory.swapOffhand())UI.renderHotbar();
      return;
    }
    if (e.code === 'KeyE') {
      disableTouchInput();
      state.suppressPause = true;
      document.exitPointerLock?.();
      if (UI.openInventory() === false) resumeInput();
      return;
    }
  });
  document.addEventListener('keyup',e=>{
    keys[e.code]=false;
    if(e.code==='KeyW')keys.DoubleTapSprint=false;
  });

  document.addEventListener('mousemove', e => {
    if (!state.locked) return;
    const sensitivity=.0022*classicOptions.sensitivity/100;
    Player.yaw -= e.movementX * sensitivity;
    Player.pitch = Math.max(-1.55, Math.min(1.55,
      Player.pitch - e.movementY * sensitivity * (classicOptions.invertY?-1:1)));
  });

  document.addEventListener('mousedown', e => {
    if (e.target?.closest?.('#touch-controls, #hotbar, .overlay, #picker, button, input')) return;
    if (!(state.locked || (isTouch && touchActive)) || Player.dead || state.paused) return;
    if (e.button === 0) {
      miningSwingElapsed = 0;
      PlayerModel.swing();
      const dir = Interact.getTouchDirection() || new THREE.Vector3();
      if(!Interact.getTouchDirection())camera.getWorldDirection(dir);
      const hitMob = Mobs.tryAttack(camera.position, dir, 3.6);
      if (hitMob) {
        if (Mobs.getLastAttackResult()?.landed)
          Player.addExhaustion(SURVIVAL.ATTACK_COST);
      } else if (state.mode === GAME_MODE.SURVIVAL) {
        miningHeld = true;
        Interact.startBreak(true);
        UI.setMiningProgress(Interact.miningProgress());
      } else {
        miningHeld = true;
        creativeBreakTimer=.18;
        Interact.startBreak(false);
        UI.setMiningProgress(0);
        blip(95, .12, 'triangle', .09);
      }
    } else if (e.button === 2) {
      const target = Interact.getTarget();
      if (target && !Player.sneaking && (target.id===BLOCK.WOOD_DOOR || target.id===BLOCK.WOOD_DOOR_TOP)) {
        const opened=BlockFurniture.toggleDoor(target.x,target.y,target.z);
        blip(opened?310:225,.07,'square',.04);
        return;
      }
      if (target && !Player.sneaking && target.id===BLOCK.CHEST) {
        disableTouchInput();
        state.suppressPause=true;
        document.exitPointerLock?.();
        if(!BlockFurniture.openChest(target.x,target.y,target.z))resumeInput();
        return;
      }
      if (target && !Player.sneaking && (target.id === BLOCK.CRAFTING_TABLE || target.id === BLOCK.FURNACE)) {
        disableTouchInput();
        state.suppressPause = true;
        document.exitPointerLock?.();
        if (target.id === BLOCK.FURNACE) { if(UI.openFurnace(target)===false)resumeInput(); }
        else if (UI.openCrafting() === false) resumeInput();
        return;
      }
      for(const hand of ['main','offhand']){
        const s=hand==='main'?Inventory.selectedSlot():Inventory.getEquipment().offhand;
        if(!s)continue;
        const action=ItemActions.use(target,hand);
        if(action.handled){if(action.success)PlayerModel.swing();return;}
        if(isFoodId(s.id)){
          if(Player.eat(ITEMS[s.id].food)){
            PlayerModel.swing();blip(280,.07,'triangle',.05);
            if(hand==='offhand')Inventory.consumeOffhand();else Inventory.consumeSelected();
            UI.renderHotbar();
          }else UI.showToast('배가 부릅니다');
          return;
        }
        if(isBlockId(s.id)&&Interact.tryPlace(s.id)){
          PlayerModel.swing();
          if(hand==='offhand')Inventory.consumeOffhand();else Inventory.consumeSelected();
          blip(190,.07,'square',.05);UI.renderHotbar();return;
        }
      }
      ItemActions.use(target,'empty');
    } else if (e.button === 1) {
      if (UI.isInventoryOpen()) return;
      e.preventDefault();
      const id = Interact.pickBlock();
      if (id && Inventory.pickBlock(id)) {
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
    disableTouchInput();
    for(const code of Object.keys(keys))keys[code]=false;
    miningHeld = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
    if(state.started && !Player.dead){
      state.paused=true;
      pauseBeganAt=performance.now();
      UI.showOverlay('pause');
      doSave(true);
    }
  });
  document.addEventListener('pointerlockerror', () => UI.showToast('마우스 잠금을 시작하지 못했습니다. 게임 화면을 한 번 클릭해 주세요.'));
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('wheel', e => {
    if (!state.locked) return;
    e.preventDefault();
    if (e.metaKey) return;
    UI.setSelected(Inventory.getSelected() + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (state.locked) {
      state.started = true;
      state.paused = false;
      state.suppressPause = false;
      UI.showOverlay(null);
    } else if (state.started && !Player.dead) {
      for(const code of Object.keys(keys))keys[code]=false;
      lastSpaceTap=-Infinity;
      resetTouchTaps();
      miningHeld = false;
      Interact.cancelBreak();
      UI.setMiningProgress(0);
      if (state.suppressPause) { state.suppressPause = false; return; }
      state.paused = true;
      pauseBeganAt=performance.now();
      UI.showOverlay('pause');
      doSave(true);
    }
  });

  function createWorldAndOpen(name, rawSeed) {
    const parsed = seedFromParam(rawSeed);
    if(state.started && !doSave(true)){
      UI.showToast('현재 월드를 저장하지 못했습니다. 백업 후 다시 시도해 주세요.');
      return;
    }
    const meta = SaveSystem.create(name, parsed ?? undefined);
    if (!meta) {
      UI.showToast('새 월드를 만들지 못했습니다. 저장 공간을 확인해 주세요.');
      return;
    }
    location.href = 'play.html?world=' + encodeURIComponent(meta.id);
  }

  function openWorldMenu() {
    if(room){if(doSave(true)){void Multiplayer.leave();location.href='multiplayer.html';}return;}
    if(state.started && !doSave(true)){
      UI.showToast('저장하지 못했습니다. 월드 백업을 확인해 주세요.');
      return;
    }
    WorldJournal.close(false);
    BlockFurniture.closeChest(false);
    if (UI.isInventoryOpen() && !UI.closeInventory()) return;
    if (UI.isCraftingOpen() && !UI.closeCrafting()) return;
    disableTouchInput();
    state.suppressPause = true;
    state.started = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
    document.exitPointerLock?.();
    UI.closeCrafting();
    UI.showOverlay('start');
    UI.setStartEnabled(state.ready);
    UI.renderWorlds(SaveSystem.list(), worldId);
  }

  const startBtn = document.getElementById('start-btn');
  const btnSurvival = document.getElementById('btn-start-survival');
  const btnCreative = document.getElementById('btn-start-creative');
  if (saved || room) {
    btnSurvival.classList.add('hidden');
    btnCreative.classList.add('hidden');
    startBtn.textContent = room ? `멀티플레이 참가 (${modeLabel})` : `이어서 플레이 (${modeLabel})`;
  } else {
    startBtn.classList.add('hidden');
  }
  startBtn.addEventListener('click', () => {
    if (!state.ready) return;
    if(!room)SaveSystem.setActiveId(worldId);
    beginGameplay(state.mode);
  });
  btnSurvival.addEventListener('click', () => {
    if (!state.ready) return;
    Inventory.init(GAME_MODE.SURVIVAL, null);
    beginGameplay(GAME_MODE.SURVIVAL);
  });
  btnCreative.addEventListener('click', () => {
    if (!state.ready) return;
    Inventory.init(GAME_MODE.CREATIVE, null);
    beginGameplay(GAME_MODE.CREATIVE);
  });

  document.getElementById('inventory-close').addEventListener('click', () => {
    if (!UI.closeInventory()) return;
    state.paused = false;
    state.suppressPause = true;
    resumeInput();
  });
  document.getElementById('btn-resume').addEventListener('click', () => {
    state.paused = false;
    state.suppressPause = true;
    UI.showOverlay(null);
    resumeInput();
  });
  document.getElementById('btn-crafting').addEventListener('click', () => {
    state.suppressPause = true;
    document.exitPointerLock?.();
    UI.openInventory();
  });
  document.getElementById('btn-worlds').addEventListener('click', openWorldMenu);
  document.getElementById('crafting-close').addEventListener('click', () => {
    if (!UI.closeCrafting()) return;
    state.paused = false;
    state.suppressPause = true;
    resumeInput();
  });
  document.getElementById('furnace-close')?.addEventListener('click', () => {
    if (!UI.closeFurnace()) return;
    state.paused = false;
    state.suppressPause = true;
    resumeInput();
  });
  document.getElementById('btn-create-world').addEventListener('click', () => {
    const name = document.getElementById('world-name-input').value.trim();
    const rawSeed = document.getElementById('world-seed-input').value.trim();
    createWorldAndOpen(name, rawSeed);
  });
  document.addEventListener('webcraft-appearance-changed', () => {
    const record = WebCraftSkins.save(PlayerModel.getAppearance());
    appearanceUpdatedAt = record ? record.updatedAt : Date.now();
    if (state.started) doSave(true);
  });
  document.getElementById('btn-save').addEventListener('click', () => doSave(false));
  // Backup files are private local JSON downloads, not uploaded to any server.
  document.getElementById('btn-export-world')?.addEventListener('click', () => {
    if (!doSave(true)) { UI.showToast('월드 저장에 실패해 백업할 수 없습니다'); return; }
    const snapshot = room ? {type:'webcraft-world-export',formatVersion:1,exportedAt:new Date().toISOString(),meta:{name:worldMeta.name,seed},world:SaveSystem.loadRoom(room.room)} : SaveSystem.exportWorld(worldId);
    if (!snapshot) { UI.showToast('백업 데이터를 찾지 못했습니다'); return; }
    try {
      const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'WebCraft-' + String(worldMeta.name || 'world').replace(/[\\/:*?"<>|]/g, '_') + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      UI.showToast('월드 백업 파일 내려받기 시작');
    } catch (error) {
      UI.showToast('월드 백업 파일을 만들 수 없습니다');
    }
  });
  const worldImportInput = document.getElementById('world-import-file');
  document.getElementById('btn-import-world')?.addEventListener('click', () => worldImportInput?.click());
  worldImportInput?.addEventListener('change', async () => {
    const file = worldImportInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) {
        UI.showToast('8MB 이하의 WebCraft 백업 파일만 가져올 수 있습니다');
        return;
      }
      const parsed = JSON.parse(await file.text());
      if(state.started && !doSave(true)){
        UI.showToast('현재 월드를 저장하지 못했습니다. 백업 후 다시 시도해 주세요.');
        return;
      }
      const imported = SaveSystem.importWorld(parsed);
      if (!imported) {
        UI.showToast('올바른 WebCraft 월드 백업 파일이 아닙니다');
        return;
      }
      UI.showToast('새 월드로 가져왔습니다');
      location.href = 'play.html?world=' + encodeURIComponent(imported.id);
    } catch (error) {
      UI.showToast('파일을 읽을 수 없습니다. 백업 파일을 확인해 주세요');
    } finally {
      worldImportInput.value = '';
    }
  });

  document.getElementById('btn-home').addEventListener('click', () => {
    if(doSave(true))location.href='index.html';
    else UI.showToast('저장하지 못했습니다. 백업 후 다시 시도해 주세요.');
  });
  document.getElementById('btn-respawn').addEventListener('click', () => {
    miningHeld = false;
    Interact.cancelBreak();
    UI.setMiningProgress(0);
    Player.respawn();
    UI.hideDeath();
    resumeInput();
  });
  document.getElementById('btn-death-title')?.addEventListener('click',()=>{
    // Return to the saved spawn point before saving so reopening the world
    // never loads a healthy player at the previous death coordinates.
    Player.respawn();
    if(doSave(true))location.href='index.html';
    else UI.showToast('저장하지 못했습니다. 다시 시도해 주세요.');
  });
  document.getElementById('picker-close').addEventListener('click', () => { UI.closePicker(); resumeInput(); });
  document.getElementById('btn-newworld').addEventListener('click', () => {
    if (!confirm('현재 월드는 저장된 상태로 남기고 새 월드를 만들까요?')) return;
    const v = document.getElementById('seed-input').value.trim();
    const name = document.getElementById('world-name-input').value.trim();
    createWorldAndOpen(name, v);
  });
  const modeBtn = document.getElementById('btn-mode');
  function syncModeBtn() {
    if(room){modeBtn.textContent='방 모드: '+modeLabel;modeBtn.disabled=true;return;}
    modeBtn.textContent = state.mode === GAME_MODE.SURVIVAL
      ? '모드: 서바이벌 (전환)'
      : '모드: 크리에이티브 (전환)';
  }
  syncModeBtn();
  modeBtn.addEventListener('click', () => {
    setMode(state.mode === GAME_MODE.SURVIVAL ? GAME_MODE.CREATIVE : GAME_MODE.SURVIVAL);
  });
  const difficultyBtn=document.getElementById('btn-difficulty');
  const difficultyDescription=document.getElementById('wc-difficulty-description');
  function syncDifficultyBtn(){
    const value=Difficulty.INFO[state.difficulty]||Difficulty.INFO.normal;
    if(difficultyBtn){
      difficultyBtn.textContent='난이도: '+value.name;
      difficultyBtn.disabled=!!room && !Multiplayer.isHost;
      difficultyBtn.setAttribute('aria-label','난이도: '+value.name+' · 클릭하여 변경');
    }
    if(difficultyDescription)
      difficultyDescription.textContent=value.description+
        (room&&!Multiplayer.isHost?' (방장만 난이도를 변경할 수 있습니다.)':'');
  }
  syncDifficultyBtn();
  difficultyBtn?.addEventListener('click',()=>{
    if(room&&!Multiplayer.isHost)return;
    state.difficulty=Difficulty.next();
    syncDifficultyBtn();
    // The change is permanent for this world, including restored saves.
    doSave(true);
    Mobs.update(0,false);
    UI.showToast('난이도: '+Difficulty.info().name);
  });
  const rdSel = document.getElementById('sel-renderdist');
  rdSel.value = String(state.renderDist);
  rdSel.addEventListener('change', () => {
    state.renderDist = +rdSel.value;
    applyFog();
    UI.showToast(`렌더 거리: ${state.renderDist}청크`);
  });
  // Presets use the same controls as manual adjustment, so persisted settings
  // and live camera/fog stay synchronized.
  const settingsSummary=document.getElementById('settings-summary-live');
  function updateSettingsSummary(){
    if(!settingsSummary)return;
    const opts=ClassicSettings.get();
    settingsSummary.textContent='렌더 '+state.renderDist+'청크 · 시야 '+opts.fov+'° · 감도 '+opts.sensitivity+'% · '+(opts.invertY?'Y축 반전':'기본 Y축');
  }
  const settingPresets={
    fast:{fov:65,sensitivity:100,renderDist:2},
    balanced:{fov:70,sensitivity:100,renderDist:3},
    wide:{fov:90,sensitivity:100,renderDist:4}
  };
  document.querySelectorAll('[data-settings-preset]').forEach(btn=>btn.addEventListener('click',()=>{
    const preset=settingPresets[btn.dataset.settingsPreset];
    if(!preset)return;
    const fov=document.getElementById('classic-fov');
    const sensitivity=document.getElementById('classic-sensitivity');
    fov.value=String(preset.fov);
    fov.dispatchEvent(new Event('input',{bubbles:true}));
    sensitivity.value=String(preset.sensitivity);
    sensitivity.dispatchEvent(new Event('input',{bubbles:true}));
    rdSel.value=String(preset.renderDist);
    rdSel.dispatchEvent(new Event('change',{bubbles:true}));
    updateSettingsSummary();
    UI.showToast('설정 적용: '+btn.textContent.trim());
  }));
  for(const id of ['classic-fov','classic-sensitivity','classic-invert']){
    const el=document.getElementById(id);
    el?.addEventListener(id==='classic-invert'?'change':'input',updateSettingsSummary);
  }
  rdSel.addEventListener('change',updateSettingsSummary);
  document.getElementById('classic-options-reset')?.addEventListener('click',updateSettingsSummary);
  updateSettingsSummary();
  const shareSeedBtn = document.getElementById('btn-share-seed');
  shareSeedBtn.addEventListener('click', async () => {
    const url = room ? new URL('multiplayer.html?room='+room.room,location.href).href : location.origin + location.pathname + '?seed=' + encodeURIComponent(seed);
    try {
      await navigator.clipboard.writeText(url);
      UI.showToast(room?'초대 링크를 복사했습니다':'시드 링크를 복사했습니다');
    } catch (e) {
      prompt(room?'초대 링크를 복사하세요:':'시드 링크를 복사하세요:', url);
    }
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
  // Save as soon as the user switches apps; browser page suspension can skip unload.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.started) {
      WorldJournal.close(false);
      disableTouchInput();
      state.paused = true;
      pauseBeganAt=performance.now();
      UI.showOverlay('pause');
      doSave(true);
      document.exitPointerLock?.();
    }
  });
  addEventListener('beforeunload', () => { if (state.started) doSave(true); });
  setInterval(() => { if (state.started) doSave(true); }, CONFIG.AUTOSAVE_SEC * 1000);

  if(room){
    document.body.classList.add('multiplayer-playing');
    document.getElementById('mp-hud')?.classList.remove('hidden');
    document.querySelector('#overlay-start .world-section')?.classList.add('hidden');
    document.querySelector('#overlay-start .tip').textContent='최대 4명 협동 플레이 · 메뉴를 열어도 월드는 계속됩니다. 방장은 게임을 열어 두세요.';
    document.querySelector('#overlay-pause .tip').textContent='20초마다 자동 저장 · 멀티플레이에서는 메뉴를 열어도 월드가 계속됩니다.';
    document.getElementById('btn-worlds').textContent='저장하고 방 나가기';
    shareSeedBtn.textContent='친구 초대 링크 복사';
    const inviteBtn=document.getElementById('btn-invite-room');
    inviteBtn?.classList.remove('hidden');inviteBtn?.addEventListener('click',()=>shareSeedBtn.click());
    document.getElementById('btn-multiplayer')?.classList.add('hidden');
    document.getElementById('btn-import-world')?.classList.add('hidden');
    document.getElementById('btn-newworld').closest('.row').classList.add('hidden');
    MultiplayerEngine.bind({scene,state,seed,
      onResync:()=>{state.ready=false;UI.setStartEnabled(false);Interact.cancelBreak();miningHeld=false;},
      onStatus:value=>{
        if(value==='ready')return;
        for(const k of Object.keys(keys))keys[k]=false;
        disableTouchInput();miningHeld=false;Interact.cancelBreak();state.paused=true;
        if(state.started){UI.showOverlay('pause');document.exitPointerLock?.();}
      },onContainerDenied:()=>{state.paused=true;UI.showOverlay('pause');}});
  }

  // Vanilla-style first-person walk rhythm and a subtle landing dip.
  // All offsets are cosmetic and never alter collision/aim physics.
  let viewStep=0, viewBobWeight=0, viewLanding=0;
  let wasViewGrounded=false;
    let frames = 0, fpsTime = 0, fps = 0;
  const clock = new THREE.Clock();
  let hudTick = 0;
  let milestoneTick = 0;
  let furnaceUITick = 0;

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .05);
    const multiplayer = typeof Multiplayer!=='undefined'&&Multiplayer.active;
    const networkReady = !multiplayer||Multiplayer.ready;
    const authority = !multiplayer||Multiplayer.isHost;
    const worldRunning = state.ready && networkReady && (multiplayer ? state.started||authority : state.started&&!state.paused&&!Player.dead);

    if (!state.ready) {
      World.update(Player.pos.x, Player.pos.z, state.renderDist, isTouch ? 4 : 8, isTouch ? 6 : 12);
      if (World.isReady()) {
        state.ready = true;
        UI.setStartEnabled(true);
      }
    } else {
      const active = worldRunning && state.started && !state.paused && !Player.dead && !UI.isInventoryOpen() && !UI.isCraftingOpen() && !UI.isFurnaceOpen() && !UI.isPickerOpen() && !BlockFurniture.isChestOpen() && !WorldJournal.isOpen();
      if (active) {
        Player.update(dt, keys);
        const discovery=WorldJournal.update(dt,Player.pos,World.biomeAt(Player.pos.x,Player.pos.z));
        if(discovery || ++milestoneTick%12===0)WorldMilestones.syncExploration(WorldJournal.getStats());
        Interact.update();
        const aimed=Interact.getTarget();
        const targetLabel=document.getElementById('target-block-name');
        if(targetLabel){
          targetLabel.textContent=aimed?getItemName(aimed.id):'';
          targetLabel.classList.toggle('show',!!aimed);
        }
        if(miningHeld){
          if(state.mode===GAME_MODE.SURVIVAL && !Interact.miningProgress())Interact.startBreak(true);
          if(state.mode===GAME_MODE.CREATIVE){
            creativeBreakTimer-=dt;
            if(creativeBreakTimer<=0){
              Interact.startBreak(false);PlayerModel.swing();creativeBreakTimer=.18;
            }
          }
        }
        const mined = Interact.updateMining(dt, state.mode === GAME_MODE.SURVIVAL);
        const miningProgress = Interact.miningProgress();
        UI.setMiningProgress(miningProgress);
        const attackFill=document.getElementById('attack-charge-fill');
        const attackLabel=document.getElementById('attack-charge-label');
        const charge=Mobs.getAttackCharge();
        if(attackFill)attackFill.style.width=Math.round(charge*100)+'%';
        if(attackLabel)attackLabel.textContent=charge>.98?'공격 준비':'공격 회복 중';
        if (miningHeld && miningProgress > 0) {
          miningSwingElapsed += dt;
          if (miningSwingElapsed >= .48) {
            PlayerModel.swing();
            miningSwingElapsed = 0;
          }
        } else {
          miningSwingElapsed = 0;
        }
        if (mined) {
          blip(95, .12, 'triangle', .09);
        }
      } else if(worldRunning&&state.started&&!Player.dead){
        // Inventories do not pause a Minecraft-style world; player input does.
        Player.update(dt, {});
      }
      if(worldRunning){
        updateSky(dt,authority);
        updateWeather(dt);
        Fluids.update(Player.pos.x, Player.pos.y, Player.pos.z, dt);
        if(authority){BlockPhysics.update(dt);FurnaceSystem.update(dt);Farming.update(dt,state.time);}
        if(state.started&&!Player.dead)ItemActions.update(dt);
        if(UI.isFurnaceOpen() && ++furnaceUITick%6===0)UI.renderFurnace();
        const sprinting = active && Player.sprinting;
        if(state.started&&!Player.dead)Player.survivalTick(dt, sprinting);
        Mobs.update(dt, true);
        Drops.update(dt, Player.pos, state.started && state.mode === GAME_MODE.SURVIVAL && !Player.dead);
      }
      World.update(Player.pos.x, Player.pos.z, state.renderDist, isTouch ? 1 : 2, isTouch ? 2 : 4);
    }

    if(multiplayer)Multiplayer.frame(dt);
    const sprinting = worldRunning && !state.paused && !Player.dead &&
      (state.locked || (isTouch&&touchActive)) && Player.sprinting;
    const targetFov = Math.min(120,classicOptions.fov + (sprinting ? 8 : 0));
    if (Math.abs(camera.fov - targetFov) > .1) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }

    PlayerModel.update(Player, worldRunning ? dt : 0, state.thirdPersonView > 0);
    const waterFx = document.getElementById('underwater-overlay');
    if (waterFx) waterFx.classList.toggle('show', Player.headSubmerged);
    if (state.thirdPersonView > 0) {
      viewBobWeight*=Math.exp(-10*Math.min(.05,dt));
      wasViewGrounded=Player.onGround;
      const cp = new THREE.Vector3();
      const target = new THREE.Vector3(Player.pos.x, Player.pos.y + 1.15, Player.pos.z);
      const cy = Math.cos(Player.pitch), sy = Math.sin(Player.pitch);
      const side = state.thirdPersonView === 2 ? -1 : 1;
      cp.set(
        Player.pos.x + Math.sin(Player.yaw) * cy * 4.5 * side,
        Player.pos.y + 1.65 + sy * 2.0,
        Player.pos.z + Math.cos(Player.yaw) * cy * 4.5 * side
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
      const isActive=worldRunning && !state.paused && !Player.dead;
      const onGround=Player.onGround && !Player.flying && !Player.inWater;
      const hSpeed=Math.hypot(Player.vel.x,Player.vel.z);
      const bobTarget=isActive && onGround && classicOptions.viewBobbing
        ? Math.min(1.18,hSpeed / Math.max(.1,CONFIG.SPEED)):0;
      const rate=Math.min(.05,dt);
      viewBobWeight+=(bobTarget-viewBobWeight)*(1-Math.exp(-10*rate));
      if(bobTarget>.02)viewStep+=hSpeed*rate*2.25;
      if(isActive && onGround && !wasViewGrounded && classicOptions.viewBobbing)
        viewLanding=-.05;
      viewLanding*=Math.exp(-12*rate);
      if(!classicOptions.viewBobbing)viewLanding=0;
      wasViewGrounded=onGround;
      const sideways=Math.sin(viewStep)*.022*viewBobWeight;
      const vertical=-Math.abs(Math.cos(viewStep))*.027*viewBobWeight + viewLanding;
      camera.position.set(
        Player.pos.x+Math.cos(Player.yaw)*sideways,
        Player.pos.y+Player.eyeY+vertical,
        Player.pos.z-Math.sin(Player.yaw)*sideways
      );
      camera.rotation.set(Player.pitch,Player.yaw,Math.sin(viewStep)*.006*viewBobWeight);
    }

    frames++;
    fpsTime += dt;
    if (fpsTime >= .5) { fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0; }
    if (++hudTick % 10 === 0) {
      const p = Player.pos;
      const mc = Mobs.counts();
      UI.setHUD(`FPS ${fps} · x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} z ${p.z.toFixed(0)} · 청크 ${World.chunkCount()} · 몹 ${mc.total}`);
      const debug=document.getElementById('debug-panel');
      if(debug && !debug.classList.contains('hidden')){
        const biome=World.biomeAt(p.x,p.z);
        const direction=((Player.yaw%(Math.PI*2))*180/Math.PI+360)%360;
        const journal=WorldJournal.getStats();
        debug.textContent=[
          'WEBCRAFT v'+CONFIG.VERSION+' · DEBUG (F3)',
          'FPS: '+fps+' · 청크 로딩: '+World.chunkCount(),
          '위치: X '+p.x.toFixed(1)+' / Y '+p.y.toFixed(1)+' / Z '+p.z.toFixed(1),
          '바이옴: '+WorldJournal.biomeName(biome),
          '방향: '+Math.round(direction)+'°',
          '월드 시드: '+World.getSeed(),
          '몹: '+mc.total+' (야생 '+mc.passive+' / 적대 '+mc.hostile+')',
          '청크 대기: '+World.pendingCount()+' · 리빌드: '+World.dirtyCount(),
          '카메라: '+(state.thirdPersonView===0?'1인칭':'3인칭')
        ].join('\n');
      }
    }

    UI.updateSurvival(state.mode, Player.hp, Player.food, Player.air, Player.headSubmerged);

    renderer.render(scene, camera);
  }
  loop();
})();
