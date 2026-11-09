'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Run the production frame function without booting a WebGL renderer or browser.
// Dependencies record calls, so these checks exercise the real pause/input gates.
const source = fs.readFileSync(path.join(__dirname, '..', 'js/game/mobile-test-main.js'), 'utf8');
const match = source.match(/  function loop\(\) \{[\s\S]*?\n  \}\n(?=  loop\(\);)/);
assert.ok(match, 'The active game frame function must be available for runtime checks');

function createGame(options = {}) {
  const calls = Object.create(null);
  const record = name => (...args) => {
    (calls[name] ||= []).push(args);
  };
  const state = {
    ready: true, started: true, paused: false, locked: true,
    thirdPersonView: 0, renderDist: 3, time: .22, mode: 'survival',
    ...options.state
  };
  const dialogs = { inventory: false, crafting: false, furnace: false, picker: false,
    chest: false, journal: false, ...options.dialogs };
  const deltas = [...(options.deltas || [.016])];
  const player = {
    pos: { x: 8.5, y: 30, z: 8.5 }, yaw: 0, pitch: 0, eyeY: 1.62,
    flying: false, dead: !!options.dead, headSubmerged: false,
    hp: 20, food: 20, air: 20,
    update: record('player'), survivalTick: record('survival')
  };
  const metrics = { weatherTime: 0, clockReads: 0 };
  const sandbox = {
    state, Player: player,
    keys: { KeyW: true, ControlLeft: true, ...(options.keys || {}) },
    isTouch: !!options.isTouch, touchActive: false,
    classicOptions: { fov: 72 },
    GAME_MODE: { SURVIVAL: 'survival', CREATIVE: 'creative' },
    CONFIG: { VERSION: 'test' },
    clock: {
      getDelta() {
        metrics.clockReads++;
        return deltas.length ? deltas.shift() : .016;
      }
    },
    requestAnimationFrame: record('animation'),
    document: { getElementById: id => id==='underwater-overlay'
      ? {classList:{toggle:record('underwaterEffect')}} : null },
    UI: {
      isInventoryOpen: () => dialogs.inventory,
      isCraftingOpen: () => dialogs.crafting,
      isFurnaceOpen: () => dialogs.furnace,
      isPickerOpen: () => dialogs.picker,
      setStartEnabled: record('startReady'),
      setMiningProgress: record('miningHUD'),
      renderFurnace: record('furnaceUI'),
      setHUD: record('hud'), updateSurvival: record('survivalHUD')
    },
    World: {
      update: record('worldStreaming'),
      isReady: () => !!options.worldReady,
      biomeAt: () => 'plains', chunkCount: () => 9,
      pendingCount: () => 0, dirtyCount: () => 0, getSeed: () => 123,
      getBlock: () => 0
    },
    BlockFurniture: { isChestOpen: () => dialogs.chest },
    WorldJournal: {
      isOpen: () => dialogs.journal,
      update: (...args) => { record('exploration')(...args); return null; },
      getStats: () => ({ found: 0, distance: 0 }), biomeName: () => '평원'
    },
    WorldMilestones: { syncExploration: record('milestones') },
    Interact: {
      update: record('interaction'), getTarget: () => null,
      miningProgress: () => 0, startBreak: record('startBreak'),
      updateMining: (...args) => { record('mining')(...args); return false; }
    },
    updateSky: dt => { state.time += dt; record('sky')(dt); },
    updateWeather: dt => { metrics.weatherTime += dt; record('weather')(dt); },
    Fluids: { update: record('fluids') },
    BlockPhysics: { update: record('physics') },
    FurnaceSystem: { update: record('furnace') },
    Farming:{update:record('farming')},
    ItemActions:{update:record('items')},
    Mobs: {
      getAttackCharge: () => 1, update: record('mobs'),
      counts: () => ({ total: 0, passive: 0, hostile: 0 })
    },
    Drops: { update: record('drops') },
    PlayerModel: { update: record('model'), swing: record('swing') },
    camera: {
      fov: 72, position: { set() {}, copy() {} }, rotation: { set() {} },
      updateProjectionMatrix: record('projection'), lookAt() {}
    },
    scene: {}, renderer: { render: record('render') },
    miningHeld: false, creativeBreakTimer: 0, miningSwingElapsed: 0,
    frames: 0, fpsTime: 0, fps: 0, hudTick: 0, milestoneTick: 0, furnaceUITick: 0,
    getItemName: id => String(id), isSolidBlock: () => false,
    blip: record('sound')
  };
  vm.createContext(sandbox);
  vm.runInContext(match[0] + '\nthis.runFrame = loop;', sandbox,
    { filename: 'active-game-loop.js' });
  return {
    state, player, dialogs, metrics, calls,
    frame: () => sandbox.runFrame(),
    count: name => calls[name]?.length || 0
  };
}

const simulation = ['sky', 'weather', 'fluids', 'physics', 'furnace', 'farming', 'items', 'survival', 'mobs', 'drops'];

function assertFrozen(game) {
  for (const name of simulation) assert.equal(game.count(name), 0, name + ' must stay paused');
  assert.equal(game.count('player'), 0, 'player physics must stay paused');
  assert.equal(game.count('interaction'), 0, 'world interactions must stay paused');
  assert.equal(game.state.time, .22);
  assert.equal(game.metrics.weatherTime, 0);
  assert.equal(game.calls.model[0][1], 0, 'player animation must receive zero elapsed time');
  assert.equal(game.count('render'), 1, 'a paused world still renders its current frame');
}

test('a started, ready world advances all simulation systems with one shared delta', () => {
  const game = createGame();
  game.frame();
  for (const name of simulation) assert.equal(game.count(name), 1, name + ' should tick');
  assert.equal(game.calls.fluids[0][3], .016);
  for (const name of ['sky', 'weather', 'physics', 'furnace', 'survival', 'mobs', 'drops']) {
    assert.equal(game.calls[name][0][0], .016, name + ' should use frame delta');
  }
  assert.equal(game.state.time, .236);
  assert.equal(game.metrics.weatherTime, .016);
  assert.equal(game.calls.player[0][1].KeyW, true);
  assert.equal(game.calls.survival[0][1], true, 'active Ctrl+W input should sprint');
  assert.equal(game.count('interaction'), 1);
  assert.equal(game.count('render'), 1);
  assert.equal(game.count('animation'), 1, 'the next frame should be scheduled once');
});

test('the active game passes head submersion to the air HUD before oxygen decreases',()=>{
  const game=createGame();game.player.headSubmerged=true;game.player.air=10;
  game.frame();
  const call=game.calls.survivalHUD[0];
  assert.equal(call[3],10);assert.equal(call[4],true);
  assert.deepEqual(game.calls.underwaterEffect[0],['show',true]);
  game.player.headSubmerged=false;game.frame();
  assert.deepEqual(game.calls.underwaterEffect[1],['show',false]);
  assert.equal(game.calls.survivalHUD[1][4],false);
});

test('the Esc pause state freezes simulation while retaining rendering and streaming', () => {
  const game = createGame({ state: { paused: true } });
  game.frame();
  assertFrozen(game);
  assert.equal(game.count('worldStreaming'), 1);
});

test('an unstarted world-selection screen does not advance survival or smelting', () => {
  const game = createGame({ state: { started: false, locked: false } });
  game.frame();
  assertFrozen(game);
});

test('loading streams chunks without running world simulation', () => {
  const game = createGame({ state: { ready: false }, worldReady: false });
  game.frame();
  assertFrozen(game);
  assert.equal(game.count('worldStreaming'), 1);
  assert.equal(game.state.ready, false);
  assert.equal(game.count('startReady'), 0);
});

test('a newly ready world starts simulating on its next frame', () => {
  const game = createGame({ state: { ready: false }, worldReady: true });
  game.frame();
  assertFrozen(game);
  assert.equal(game.state.ready, true);
  assert.equal(game.calls.startReady[0][0], true);
  game.frame();
  assert.equal(game.count('furnace'), 1);
  assert.equal(game.count('sky'), 1);
});

test('the death screen freezes world time, physics and furnace progress', () => {
  const game = createGame({ dead: true });
  game.frame();
  assertFrozen(game);
});

for (const dialog of ['inventory', 'crafting', 'furnace', 'picker', 'chest', 'journal']) {
  test(dialog + ' GUI keeps the world ticking without accepting held gameplay input', () => {
    const game = createGame({ dialogs: { [dialog]: true }, state: { locked: false } });
    game.frame();
    for (const name of simulation) assert.equal(game.count(name), 1, name + ' should continue');
    assert.equal(game.count('player'), 1, 'gravity should continue without movement keys');
    assert.equal(Object.keys(game.calls.player[0][1]).length, 0, 'held keys must not leak through a GUI');
    assert.equal(game.calls.survival[0][1], false, 'a GUI must not consume sprint exhaustion');
    assert.equal(game.count('interaction'), 0, 'a GUI must not mine or place blocks');
    assert.equal(game.count('mining'), 0);
    assert.equal(game.count('exploration'), 0);
    assert.equal(game.state.time, .236);
  });
}

test('the furnace GUI refreshes periodically while processing continues', () => {
  const game = createGame({ dialogs: { furnace: true }, isTouch: true });
  for (let i = 0; i < 6; i++) game.frame();
  assert.equal(game.count('furnace'), 6);
  assert.equal(game.count('furnaceUI'), 1);
  assert.equal(game.count('interaction'), 0);
  assert.equal(game.count('render'), 6);
});

test('paused frames consume wall-clock deltas so resume does not catch up paused time', () => {
  const game = createGame({ state: { paused: true }, deltas: [12, .016] });
  game.frame();
  assertFrozen(game);
  game.state.paused = false;
  game.frame();
  assert.equal(game.metrics.clockReads, 2);
  assert.equal(game.calls.furnace[0][0], .016);
  assert.equal(game.state.time, .236);
});

test('a long resumed frame is capped instead of advancing twelve seconds at once', () => {
  const game = createGame({ state: { paused: true }, deltas: [.016, 12] });
  game.frame();
  game.state.paused = false;
  game.frame();
  for (const name of ['sky', 'weather', 'physics', 'furnace', 'survival', 'mobs', 'drops']) {
    assert.equal(game.calls[name][0][0], .05, name + ' should cap elapsed simulation time');
  }
  assert.equal(game.calls.fluids[0][3], .05);
  assert.equal(game.calls.player[0][0], .05);
  assert.equal(game.state.time, .27);
});
